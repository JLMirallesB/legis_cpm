/**
 * APA 7 citation generator for Spanish/Valencian legislation.
 *
 * Reference format:
 *   Decreto 158/2007, de 21 de septiembre, por el que se establece...
 *   Diari Oficial de la Generalitat Valenciana, 5606, de 25 de septiembre de 2007.
 *   https://dogv.gva.es/...
 *
 * Parenthetical:
 *   (Decreto 158/2007, 2007)
 *   (Decreto 158/2007, 2007, art. 6)
 */

import type { LawType } from './types';

export interface CitationData {
  /** Official title of the law including type, number and description */
  title: string;
  /** Short type + number, e.g. "Decreto 158/2007" */
  typeNumber: string;
  /** Year of the law (from date field), e.g. "2007" */
  year: string;
  /** Full name of the official journal */
  journalName: string;
  /** Issue number of the journal */
  journalNumber: string;
  /** Formatted publication date, e.g. "de 25 de septiembre de 2007" */
  pubDateFormatted: string;
  /** URL to the official source */
  url: string;
}

/** Map law types to their APA citation prefix (capitalized) */
const TYPE_LABELS_ES: Record<LawType, string> = {
  ley_organica: 'Ley Orgánica',
  ley: 'Ley',
  real_decreto: 'Real Decreto',
  decreto: 'Decreto',
  orden: 'Orden',
  resolucion: 'Resolución',
  circular: 'Circular',
  instrucciones: 'Instrucciones',
  documento: 'Documento',
  correccion_errores: 'Corrección de errores',
};

const JOURNAL_NAMES: Record<string, string> = {
  DOGV: 'Diari Oficial de la Generalitat Valenciana',
  BOE: 'Boletín Oficial del Estado',
};

function formatDateLong(dateStr: string, locale: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function buildCitationData(law: {
  title: string;
  type: LawType;
  number: string;
  date: string;
  publishedIn: { source: string; number: string; date: string; url: string };
}): CitationData {
  const typeLabel = TYPE_LABELS_ES[law.type] || law.type;
  const typeNumber = `${typeLabel} ${law.number}`;
  const year = law.date.slice(0, 4);
  const journalName = JOURNAL_NAMES[law.publishedIn.source] || law.publishedIn.source;
  const pubDate = formatDateLong(law.publishedIn.date, 'es-ES');

  return {
    title: law.title,
    typeNumber,
    year,
    journalName,
    journalNumber: law.publishedIn.number,
    pubDateFormatted: `de ${pubDate}`,
    url: law.publishedIn.url,
  };
}

/** Full APA reference for the bibliography */
export function apaReference(c: CitationData): string {
  return `${c.title}. ${c.journalName}, ${c.journalNumber}, ${c.pubDateFormatted}. ${c.url}`;
}

/** Parenthetical citation: (Decreto 158/2007, 2007) */
export function apaParenthetical(c: CitationData, articleId?: string): string {
  const artSuffix = articleId ? `, ${formatArticleRef(articleId)}` : '';
  return `(${c.typeNumber}, ${c.year}${artSuffix})`;
}

/** Format article ID to readable ref: "art-6" → "art. 6", "da-1" → "disp. adic. 1ª" */
function formatArticleRef(nodeId: string): string {
  if (nodeId.startsWith('art-')) return `art. ${nodeId.slice(4)}`;
  if (nodeId.startsWith('da-')) return `disp. adic. ${nodeId.slice(3)}ª`;
  if (nodeId.startsWith('dt-')) return `disp. trans. ${nodeId.slice(3)}ª`;
  if (nodeId.startsWith('dd-')) return `disp. derog. ${nodeId.slice(3)}`;
  if (nodeId.startsWith('df-')) return `disp. final ${nodeId.slice(3)}ª`;
  if (nodeId.startsWith('anexo-')) return `anexo ${nodeId.slice(6).toUpperCase()}`;
  if (nodeId === 'preambulo') return 'preámbulo';
  return nodeId;
}
