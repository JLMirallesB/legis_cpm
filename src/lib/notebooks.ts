import type {
  Lang, Law, NotebookDefinition, Ref, ResolvedFragment, ResolvedNotebook,
  Freshness, FreshnessLevel
} from './types';
import { getAllLaws } from './laws';
import { buildCitationData, apaReference, apaParenthetical } from './apa-citation';
import { renderContent } from './content-renderer';
import {
  findNode, currentContent, resolveApartado, resolveApartadoTree, refFreshness, worstFreshness
} from './refs-core.mjs';

const notebookModules = import.meta.glob('/data/notebooks/*.json', { eager: true });

const BASE = '/legis_cpmdem/';

// ── Helpers ─────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function lawShortLabel(law: Law): string {
  return `${law.type.replace(/_/g, ' ')} ${law.number}`;
}

// ── Resolución de referencias ───────────────────────────

/**
 * Resuelve una referencia contra la ley: saca el texto vigente del apartado y
 * comprueba si la cita sigue diciendo lo que decía cuando se guardó.
 *
 * Devuelve null solo si la ley entera no existe; una referencia con el ancla
 * rota SÍ se devuelve, marcada como tal, porque desaparecer en silencio es
 * exactamente lo que había que arreglar.
 */
export function resolveRef(ref: Ref, lang: Lang, lawMap: Map<string, Law>): ResolvedFragment | null {
  const law = lawMap.get(ref.law);
  if (!law) return null;

  const node = findNode(law.structure, ref.article);
  const content = node ? currentContent(node) : '';

  let text: string | null = null;
  let apartado: string | null = null;

  if (!node) {
    text = null;
  } else if (!ref.apartado) {
    text = content;
  } else {
    const found = ref.subtree
      ? resolveApartadoTree(content, ref.apartado)
      : resolveApartado(content, ref.apartado);
    if (found.ok) {
      text = found.text;
      apartado = found.path;
    }
  }

  const freshness: Freshness = refFreshness({
    law, node, ref, lang, resolvedText: text ?? undefined
  });

  const html = text ? renderContent(text) : '';
  const citData = buildCitationData(law);

  return {
    id: `${ref.law}_${ref.article}${ref.apartado ? '_' + ref.apartado : ''}`,
    text: text ? stripHtml(html) : '',
    html,
    articleId: ref.article,
    articleTitle: node ? node.title : ref.article,
    apartado,
    lawSlug: ref.law,
    lawShort: lawShortLabel(law),
    lawTitle: law.title,
    url: `${BASE}${lang}/${lang === 'va' ? 'llei' : 'ley'}/${ref.law}/#${ref.article}`,
    versionLabel: node?.versions?.[0]?.versionId ?? null,
    apaParenthetical: apaParenthetical(citData, ref.article),
    apaReference: apaReference(citData),
    savedAt: ref.checkedAt ?? '',
    freshness
  };
}

// ── API pública ─────────────────────────────────────────

export function getAllNotebooks(): NotebookDefinition[] {
  return Object.values(notebookModules).map((mod: any) => mod.default ?? mod);
}

export function getNotebookBySlug(slug: string): NotebookDefinition | undefined {
  return getAllNotebooks().find(n => n.slug === slug);
}

export function resolveNotebook(def: NotebookDefinition, lang: Lang): ResolvedNotebook {
  const lawMap = new Map<string, Law>();
  for (const law of getAllLaws(lang)) lawMap.set(law.slug, law);

  const fragments: ResolvedFragment[] = [];
  const seenLaws = new Set<string>();
  let peor: FreshnessLevel = 'ok';

  for (const ref of def.refs) {
    const resolved = resolveRef(ref, lang, lawMap);
    if (!resolved) {
      console.warn(`[cuadernos] ${def.slug}: ley no encontrada, ${ref.law}`);
      continue;
    }
    seenLaws.add(ref.law);
    peor = worstFreshness(peor, resolved.freshness.level) as FreshnessLevel;
    fragments.push(resolved);
  }

  return {
    id: def.id,
    slug: def.slug,
    title: def.title[lang],
    description: def.description[lang],
    updatedAt: def.updatedAt,
    fragments,
    lawCount: seenLaws.size,
    freshness: peor
  };
}
