import type {
  Lang, Law, CenterDocDefinition, CenterDocGroup, CenterDocGroupId, Ref,
  ResolvedCenterDoc, ResolvedFragment, FreshnessLevel, DiscardLawGroup, ResolvedDiscard,
  ResolvedPart, ResolvedRelation
} from './types';
import { getAllLaws } from './laws';
import { resolveRef } from './notebooks';
import { worstFreshness, findNode, currentContent, resolveApartado } from './refs-core.mjs';

const docModules = import.meta.glob('/data/center-docs/*.json', { eager: true });
const organoModules = import.meta.glob('/data/organos/*.json', { eager: true });

/**
 * Dos colecciones, un solo motor. Los documentos de centro y los órganos y
 * cargos se resuelven igual —referencias con ancla, bloques por temporalidad,
 * partes, relaciones, descartes— pero viven en apartados distintos porque no
 * son la misma clase de cosa.
 */
export type Collection = 'documentos' | 'organos';

const MODULES: Record<Collection, Record<string, unknown>> = {
  documentos: docModules,
  organos: organoModules
};

/** Orden de los bloques en la ficha: del marco general a lo de este curso. */
const GROUP_ORDER: CenterDocGroupId[] = ['estatal', 'autonomico', 'curso', 'historico'];

/**
 * A qué bloque va una referencia.
 *
 * Lo anual se separa de lo permanente por fecha, no a mano: cuando vence el
 * `expiresDate` de unas instrucciones, sus citas caen solas al histórico sin
 * que nadie tenga que acordarse en septiembre.
 */
function groupOf(law: Law, today: string): CenterDocGroupId {
  if (law.temporality?.type === 'anual') {
    const expires = law.temporality.expiresDate;
    return expires && expires <= today ? 'historico' : 'curso';
  }
  return law.territory === 'estatal' ? 'estatal' : 'autonomico';
}

export function getAllCenterDocs(collection: Collection = 'documentos'): CenterDocDefinition[] {
  return Object.values(MODULES[collection])
    .map((mod: any) => mod.default ?? mod)
    .sort((a, b) => a.order - b.order);
}

export function getCenterDocBySlug(slug: string, collection: Collection = 'documentos'): CenterDocDefinition | undefined {
  return getAllCenterDocs(collection).find(d => d.slug === slug);
}

/**
 * Resuelve los descartes para poder repasarlos desde la ficha.
 *
 * Un descarte que solo vive en el JSON es un descarte que nadie vuelve a mirar,
 * y la lista de lo que se dejó fuera vale tanto como la de lo que entró: es la
 * respuesta a «¿y por qué no está aquí el artículo tal?».
 */
function resolveDiscarded(def: CenterDocDefinition, lang: Lang, lawMap: Map<string, Law>): DiscardLawGroup[] {
  const byLaw = new Map<string, ResolvedDiscard[]>();

  for (const item of def.discarded ?? []) {
    const law = lawMap.get(item.law);
    if (!law) continue;

    // Descarte agrupado: una sola línea con la cuenta, sin muestra de texto.
    if (item.items?.length) {
      if (!byLaw.has(item.law)) byLaw.set(item.law, []);
      byLaw.get(item.law)!.push({
        lawSlug: item.law,
        lawShort: law.titleShort,
        articleId: '*',
        articleTitle: law.titleShort,
        apartado: null,
        reason: item.reason,
        preview: '',
        count: item.items.length,
        url: `/legis_cpmdem/${lang}/${lang === 'va' ? 'llei' : 'ley'}/${item.law}/`
      });
      continue;
    }

    const node = item.article === '*' ? null : findNode(law.structure, item.article!);
    let preview = '';

    if (node) {
      const content = currentContent(node);
      const texto = item.apartado
        ? (resolveApartado(content, item.apartado) as any).text ?? ''
        : content;
      preview = texto.replace(/\s+/g, ' ').trim().slice(0, 220);
      if (texto.length > 220) preview += '…';
    }

    if (!byLaw.has(item.law)) byLaw.set(item.law, []);
    byLaw.get(item.law)!.push({
      lawSlug: item.law,
      lawShort: law.titleShort,
      articleId: item.article,
      articleTitle: node ? node.title : law.title,
      apartado: item.apartado ?? null,
      reason: item.reason,
      preview,
      url: node
        ? `/legis_cpmdem/${lang}/${lang === 'va' ? 'llei' : 'ley'}/${item.law}/#${item.article}`
        : `/legis_cpmdem/${lang}/${lang === 'va' ? 'llei' : 'ley'}/${item.law}/`
    });
  }

  return [...byLaw.entries()].map(([lawSlug, items]) => ({
    lawSlug,
    lawShort: items[0].lawShort,
    items
  }));
}

/**
 * Las relaciones se declaran una vez y se leen en las dos direcciones: si el
 * PEC dice que contiene al PAT, la ficha del PAT enseña que es parte del PEC
 * sin que nadie lo escriba dos veces.
 */
function resolveRelations(def: CenterDocDefinition, lang: Lang, collection: Collection): ResolvedRelation[] {
  const docs = getAllCenterDocs(collection);
  const byslug = new Map(docs.map(d => [d.slug, d]));
  const inversa = { contiene: 'parte-de', 'parte-de': 'contiene', 'deriva-de': 'origina' } as const;

  const out: ResolvedRelation[] = [];
  const push = (slug: string, relation: ResolvedRelation['relation']) => {
    const otro = byslug.get(slug);
    if (!otro || out.some(r => r.slug === slug)) return;
    out.push({ slug, title: otro.title[lang], short: otro.short[lang], relation });
  };

  for (const rel of def.related ?? []) push(rel.slug, rel.relation);
  for (const otro of docs) {
    for (const rel of otro.related ?? []) {
      if (rel.slug === def.slug) push(otro.slug, inversa[rel.relation]);
    }
  }
  return out;
}

/**
 * Resuelve una ficha. `partId` la recorta a una de sus partes: mismas
 * referencias, mismo origen, otra ventana. Nada se duplica en los datos.
 */
export function resolveCenterDoc(
  def: CenterDocDefinition, lang: Lang, today?: string, partId?: string,
  collection: Collection = 'documentos'
): ResolvedCenterDoc {
  const now = today ?? new Date().toISOString().slice(0, 10);
  const lawMap = new Map<string, Law>();
  for (const law of getAllLaws(lang)) lawMap.set(law.slug, law);

  const buckets = new Map<CenterDocGroupId, Map<string, ResolvedFragment[]>>();
  const seenLaws = new Set<string>();
  let peor: FreshnessLevel = 'ok';
  let refCount = 0;

  const refs: Ref[] = partId ? def.refs.filter(r => r.part === partId) : def.refs;

  for (const ref of refs) {
    const law = lawMap.get(ref.law);
    const resolved = resolveRef(ref, lang, lawMap);
    if (!law || !resolved) {
      console.warn(`[documentos] ${def.slug}: no se resuelve ${ref.law}/${ref.article}`);
      continue;
    }

    const gid = groupOf(law, now);
    if (!buckets.has(gid)) buckets.set(gid, new Map());
    const byLaw = buckets.get(gid)!;
    if (!byLaw.has(ref.law)) byLaw.set(ref.law, []);
    byLaw.get(ref.law)!.push(resolved);

    seenLaws.add(ref.law);
    peor = worstFreshness(peor, resolved.freshness.level) as FreshnessLevel;
    refCount++;
  }

  const groups: CenterDocGroup[] = [];
  for (const gid of GROUP_ORDER) {
    const byLaw = buckets.get(gid);
    if (!byLaw) continue;
    groups.push({
      id: gid,
      laws: [...byLaw.entries()].map(([lawSlug, fragments]) => ({
        lawSlug,
        // titleShort es la forma legible y bilingüe («D 57/2020 - Organización
        // y funcionamiento de conservatorios»), mejor que el tipo + número.
        lawShort: lawMap.get(lawSlug)?.titleShort ?? fragments[0].lawShort,
        lawTitle: fragments[0].lawTitle,
        schoolYear: lawMap.get(lawSlug)?.temporality?.schoolYear,
        fragments
      }))
    });
  }

  return {
    id: def.id,
    slug: def.slug,
    short: def.short[lang],
    title: def.title[lang],
    description: def.description[lang],
    updatedAt: def.updatedAt,
    groups,
    parts: (def.parts ?? []).map(p => ({
      id: p.id,
      slug: p.slug,
      title: p.title[lang],
      description: p.description[lang],
      refCount: def.refs.filter(r => r.part === p.id).length
    })),
    related: resolveRelations(def, lang, collection),
    // Los descartes son de la ficha entera: en la vista de una parte sobran.
    discarded: partId ? [] : resolveDiscarded(def, lang, lawMap),
    refCount,
    lawCount: seenLaws.size,
    freshness: peor
  };
}
