import type { Lang } from '../lib/types';
import esStrings from './es.json';
import vaStrings from './va.json';

const strings: Record<Lang, Record<string, string>> = {
  es: esStrings,
  va: vaStrings,
};

/**
 * Obtiene el idioma actual a partir de la URL.
 * Si la ruta empieza por /va, devuelve 'va'. En caso contrario, 'es'.
 */
export function getLang(url: URL): Lang {
  const path = url.pathname.replace(/^\/legis_cpmdem/, '');
  return path.startsWith('/va') ? 'va' : 'es';
}

/**
 * Traduce una clave de i18n al idioma indicado.
 * Soporta interpolación con {param}: t('law.version', 'es', { date: '01/01/2024' })
 */
export function t(key: string, lang: Lang, params?: Record<string, string>): string {
  let text = strings[lang]?.[key] ?? strings['es']?.[key] ?? key;

  if (params) {
    for (const [param, value] of Object.entries(params)) {
      text = text.replace(`{${param}}`, value);
    }
  }

  return text;
}

/**
 * Segmentos de ruta que cambian de palabra según el idioma. Cualquier sección
 * nueva con nombre traducido tiene que entrar aquí: si falta, el selector de
 * idioma manda al lector a un 404 (le pasó a «documentos» y a «órganos»).
 */
const TRANSLATED_SEGMENTS: Record<Lang, string>[] = [
  { es: 'ley', va: 'llei' },
  { es: 'documentos', va: 'documents' },
  { es: 'organos', va: 'organs' },
  { es: 'cuadernos', va: 'quaderns' },
  { es: 'datos', va: 'dades' },
];

/** Índice inverso: cualquier forma del segmento → sus formas en ambos idiomas. */
const SEGMENT_INDEX = new Map<string, Record<Lang, string>>(
  TRANSLATED_SEGMENTS.flatMap(forms =>
    (Object.values(forms) as string[]).map(form => [form, forms] as const)
  )
);

/**
 * Genera la URL equivalente en el otro idioma.
 * /es/ley/slug → /va/llei/slug y viceversa.
 */
export function getAlternateUrl(url: URL, targetLang: Lang): string {
  const base = '/legis_cpmdem';
  const path = url.pathname.startsWith(base)
    ? url.pathname.slice(base.length)
    : url.pathname;

  // ['', 'es', 'documentos', 'pec', ''] — el segmento 1 es el idioma y el 2 la sección.
  const segments = path.split('/');
  if (segments[1] === 'es' || segments[1] === 'va') {
    segments[1] = targetLang;
    const forms = SEGMENT_INDEX.get(segments[2]);
    if (forms) segments[2] = forms[targetLang];
  }

  return `${base}${segments.join('/')}`;
}

/**
 * Devuelve el idioma alternativo.
 */
export function getOtherLang(lang: Lang): Lang {
  return lang === 'es' ? 'va' : 'es';
}
