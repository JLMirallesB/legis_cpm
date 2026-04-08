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
 * Genera la URL equivalente en el otro idioma.
 * /es/ley/slug → /va/llei/slug y viceversa.
 */
export function getAlternateUrl(url: URL, targetLang: Lang): string {
  const base = '/legis_cpmdem';
  let path = url.pathname.replace(base, '');

  if (targetLang === 'va') {
    path = path.replace(/^\/es/, '/va').replace('/ley/', '/llei/');
  } else {
    path = path.replace(/^\/va/, '/es').replace('/llei/', '/ley/');
  }

  return `${base}${path}`;
}

/**
 * Devuelve el idioma alternativo.
 */
export function getOtherLang(lang: Lang): Lang {
  return lang === 'es' ? 'va' : 'es';
}
