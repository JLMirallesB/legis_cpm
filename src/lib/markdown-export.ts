import type { Law, StructureNode } from './types';

/**
 * Genera Markdown consolidado (solo versión vigente).
 */
export function lawToMarkdownConsolidated(law: Law): string {
  const lines: string[] = [];

  lines.push(`# ${law.title}`);
  lines.push('');
  lines.push(renderHeader(law));
  lines.push(renderPublishedIn(law));
  lines.push(`Estado: ${law.vigpiracy.statusLabel}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  renderNodesConsolidated(law.structure, lines, 2);
  renderPromulgation(law, lines);

  return lines.join('\n');
}

/**
 * Genera Markdown con historial de versiones de cada artículo.
 */
export function lawToMarkdownWithHistory(law: Law): string {
  const lines: string[] = [];

  lines.push(`# ${law.title}`);
  lines.push('');
  lines.push(renderHeader(law));
  lines.push(renderPublishedIn(law));
  lines.push(`Estado: ${law.vigpiracy.statusLabel}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  renderNodesWithHistory(law.structure, lines, 2);
  renderPromulgation(law, lines);

  return lines.join('\n');
}

function headingPrefix(level: number): string {
  return '#'.repeat(Math.min(level, 6)) + ' ';
}

function renderHeader(law: Law): string {
  const type = law.type.replace(/_/g, ' ');
  return law.number
    ? `**${type}** ${law.number} — ${law.date}`
    : `**${type}** — ${law.date}`;
}

function renderPublishedIn(law: Law): string {
  const { source, number, date } = law.publishedIn;
  const num = number ? ` núm. ${number}` : '';
  return `Publicado en: ${source}${num} (${date})`;
}

function renderPromulgation(law: Law, lines: string[]): void {
  if (!law.promulgation) return;
  const { place, date, signatories } = law.promulgation;
  lines.push('---');
  lines.push('');
  lines.push(`${place}, ${date}`);
  lines.push('');
  for (const s of signatories ?? []) {
    lines.push(`${s.role}: ${s.name}`);
    lines.push('');
  }
}

function renderNodesConsolidated(nodes: StructureNode[], lines: string[], headingLevel: number): void {
  for (const node of nodes) {
    // Cualquier tipo de nodo (incluidos titulo/capitulo/seccion) puede llevar
    // content propio además de children: hay que volcar ambos.
    lines.push(headingPrefix(headingLevel) + node.title);
    lines.push('');
    const text = node.content ?? node.versions?.[0]?.content ?? '';
    if (text) {
      lines.push(text);
      lines.push('');
    }
    if (node.children) {
      renderNodesConsolidated(node.children, lines, headingLevel + 1);
    }
  }
}

function renderNodesWithHistory(nodes: StructureNode[], lines: string[], headingLevel: number): void {
  for (const node of nodes) {
    lines.push(headingPrefix(headingLevel) + node.title);
    lines.push('');

    if (node.versions && node.versions.length > 0) {
      for (const v of node.versions) {
        const label = v.modifiedBy
          ? `Versión de ${v.effectiveDate} (${v.modifiedBy.title})`
          : `Versión original (${v.effectiveDate})`;
        lines.push(`> **${label}**`);
        lines.push('');
        lines.push(v.content);
        lines.push('');
      }
    } else if (node.content) {
      lines.push(node.content);
      lines.push('');
    }

    if (node.children) {
      renderNodesWithHistory(node.children, lines, headingLevel + 1);
    }
  }
}
