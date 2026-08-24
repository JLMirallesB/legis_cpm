/**
 * Enlaces citados dentro del articulado de una ley.
 *
 * Se derivan del texto en tiempo de compilación en vez de transcribirse a mano
 * en el JSON: una lista escrita a mano se desincroniza el día que se corrige
 * una URL del articulado, y obligaría a repetir el trabajo en cada ingesta.
 *
 * `externalResources` sigue siendo el sitio de los enlaces que NO están en el
 * texto (calculadora de prelación, corrección de errores, ADMINOVA…).
 */

import type { Lang, Law, StructureNode } from './types';
import linkCorrections from '../../data/metadata/link-corrections.json';

export interface CitedLink {
  /** URL tal y como aparece en el texto, sin tocar */
  url: string;
  /** Destino real del enlace: igual que `url`, con esquema si el texto lo omite */
  href: string;
  /** Nombre legible derivado de la propia URL */
  label: string;
  /** id del nodo donde se cita por primera vez (ancla dentro de la página) */
  nodeId: string;
  /** Título de ese nodo, para situar al lector */
  nodeTitle: string;
  /** Dirección correcta, cuando la de la norma es una errata conocida */
  correctedUrl?: string;
  /** Por qué se corrige, en el idioma de la página */
  note?: string;
}

interface LinkCorrection {
  url: string;
  correctedUrl: string;
  note: Record<string, string>;
}

/**
 * Erratas de enlace conocidas (`data/metadata/link-corrections.json`).
 *
 * El articulado NO se toca: si el DOGV publicó una dirección equivocada, esa es
 * la que dice la norma y así se transcribe. La corrección se anota aquí y sale
 * solo en el bloque de enlaces citados, señalada como tal, para que el lector
 * llegue al sitio correcto sin que el texto legal deje de ser el publicado.
 */
const CORRECTIONS = new Map<string, LinkCorrection>(
  (linkCorrections as LinkCorrection[]).map((c) => [c.url, c])
);

/**
 * Misma captura que el autoenlazado de content-renderer.ts: URLs con esquema y
 * dominios que empiezan por `www.`. Los correos quedan fuera a propósito: son
 * direcciones de contacto, no recursos que consultar.
 */
const URL_RE = /(https?:\/\/[^\s<)]+[^\s<).,;:])|(\bwww\.[^\s<)]+[^\s<).,;:])/g;

/**
 * Segmentos de ruta que no dicen nada: si la URL acaba en uno de ellos hay que
 * seguir subiendo para encontrar la parte que nombra el recurso.
 */
const GENERIC_SEGMENTS = new Set([
  'es', 'va', 'ca', 'en', 'web', 'www', 'index', 'index.html', 'index.jsp',
  'inici', 'inicio', 'home', 'portada', 'portada.html', 'documents', 'media',
  'portal', 'guias', 'guies', 'docs', 'pdf', 'pdfs', 'default.aspx', '-',
]);

/** Endpoints de script: el nombre del programa no dice qué documento sirve */
const SCRIPT_EXT = /\.(php|jsp|aspx?|cgi)$/i;
/** Extensiones de documento: sobran en el nombre, no en la identificación */
const DOC_EXT = /\.(pdf|html?|docx?|xlsx?|odt|ods)$/i;

/**
 * Solo la query que identifica al recurso merece salir en el nombre. Un
 * `?id_proc=19970` distingue dos trámites que comparten ruta; un `?t=17615…`
 * o un `?idioma=val` son ruido de la plataforma.
 */
const IDENTIFYING_QUERY = /(^|&)(id|ids|sig|signatura|id_proc|idProc|codigo|codi|expediente|numero)=[^&]/i;

/** Un segmento que solo es un identificador no sirve como nombre */
function isOpaqueSegment(seg: string): boolean {
  if (SCRIPT_EXT.test(seg)) return true;
  const bare = seg.replace(DOC_EXT, '');
  return (
    GENERIC_SEGMENTS.has(bare.toLowerCase()) ||
    /^\d+$/.test(bare) ||                                  // 161863053
    /^[0-9a-f]{6,}(-[0-9a-f]+)*$/i.test(bare) ||           // uuid o hash
    bare.length < 3
  );
}

/** Convierte un segmento de ruta en algo legible: separadores → espacios */
function humanize(seg: string): string {
  const text = seg
    .replace(DOC_EXT, '')
    .replace(/[+_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Query identificativa, sin los parámetros vacíos que arrastran algunos portales */
function identifyingQuery(search: string): string {
  const raw = search.replace(/^\?/, '');
  if (!raw || !IDENTIFYING_QUERY.test(raw)) return '';
  const kept = raw
    .split('&')
    .filter((param) => param.includes('=') && !param.endsWith('='))
    .join('&');
  try {
    return decodeURIComponent(kept);
  } catch {
    return kept;
  }
}

/** Un dominio escrito sin esquema se navega igual: por https */
export function toHref(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * Nombre legible a partir de la URL: el último segmento de ruta que diga algo.
 * Si la ruta entera es opaca, se cae al dominio, que al menos identifica quién
 * publica el recurso.
 */
export function deriveLabel(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(toHref(url));
  } catch {
    return url;
  }

  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname);
  } catch {
    path = parsed.pathname;
  }

  const query = identifyingQuery(parsed.search);
  const segments = path.split('/').filter(Boolean);

  for (let i = segments.length - 1; i >= 0; i--) {
    if (isOpaqueSegment(segments[i])) continue;
    const label = humanize(segments[i]);
    if (!label) continue;
    return query ? `${label} (${query})` : label;
  }

  const host = parsed.hostname.replace(/^www\./, '');
  return query ? `${host} (${query})` : host;
}

function walk(nodes: StructureNode[]): StructureNode[] {
  const out: StructureNode[] = [];
  for (const node of nodes) {
    out.push(node);
    if (node.children) out.push(...walk(node.children));
  }
  return out;
}

/**
 * Recorre el articulado en orden y devuelve los enlaces citados, uno por URL:
 * si la misma dirección aparece en varios apartados se conserva el primero, que
 * es el que el lector encontrará antes.
 *
 * Solo se mira el texto vigente (`content`), no las versiones derogadas: la
 * lista de arriba describe la ley que está en vigor.
 */
export function collectCitedLinks(law: Law, lang: Lang): CitedLink[] {
  const seen = new Map<string, CitedLink>();

  for (const node of walk(law.structure ?? [])) {
    const content = node.content ?? node.versions?.[0]?.content;
    if (!content) continue;
    for (const match of content.matchAll(URL_RE)) {
      const url = match[1] ?? match[2];
      if (seen.has(url)) continue;
      const correction = CORRECTIONS.get(url);
      seen.set(url, {
        url,
        href: toHref(url),
        label: deriveLabel(url),
        nodeId: node.id,
        nodeTitle: node.title,
        ...(correction && {
          correctedUrl: correction.correctedUrl,
          note: correction.note[lang],
        }),
      });
    }
  }

  return [...seen.values()];
}
