/**
 * Renderizado de contenido markdown simplificado → HTML.
 * Extraído de ArticleContent.astro para reutilización en build time.
 */

/** Convert a markdown table block into HTML <table> */
export function mdTableToHtml(block: string): string {
  const lines = block.split('\n').filter(l => l.trim().startsWith('|'));
  if (lines.length < 2) return `<p>${block}</p>`;

  const parseRow = (line: string) =>
    line.split('|').slice(1, -1).map(c => c.trim());

  const headerCells = parseRow(lines[0]);
  // lines[1] is the separator (|---|---|...)
  const bodyRows = lines.slice(2);

  let html = '<div class="table-wrapper"><table>';
  html += '<thead><tr>' + headerCells.map(c => `<th>${renderInline(c)}</th>`).join('') + '</tr></thead>';
  html += '<tbody>';
  for (const row of bodyRows) {
    const cells = parseRow(row);
    html += '<tr>' + cells.map(c => {
      const bold = c.startsWith('**') && c.endsWith('**') && c.length > 4;
      const text = renderInline(bold ? c.slice(2, -2) : c);
      return bold ? `<td><strong>${text}</strong></td>` : `<td>${text}</td>`;
    }).join('') + '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

/**
 * Un solo barrido de autoenlazado, con tres alternativas en el mismo regex para
 * que ninguna pueda morder dentro de lo que otra ya ha capturado: una URL con
 * esquema se lleva por delante el `www.` que contiene, y un `@` dentro de una
 * URL no se confunde con un correo.
 *
 * Los textos del DOGV escriben las direcciones tal cual, sin marcado, así que
 * lo que no reconozca este regex se queda en texto plano: es el único punto del
 * proyecto donde una dirección se convierte en enlace.
 */
const LINKIFY_RE =
  /(https?:\/\/[^\s<)]+[^\s<).,;:])|(\bwww\.[^\s<)]+[^\s<).,;:])|([^\s<>()[\]{}«»,;:"']+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/g;

function anchor(href: string, label: string): string {
  return `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>`;
}

/** Render inline markdown: **bold**, and auto-link URLs, bare domains and e-mails */
export function renderInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(LINKIFY_RE, (match, url, bare, mail) => {
      if (url) return anchor(url, url);
      if (bare) return anchor(`https://${bare}`, bare);
      return anchor(`mailto:${mail}`, mail);
    });
}

/** Render a content block: table, section heading, image, or paragraph */
export function renderBlock(block: string): string {
  if (block.trimStart().startsWith('|') && block.includes('|---')) {
    return mdTableToHtml(block);
  }
  // Markdown image: ![alt](url)
  const imgMatch = block.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
  if (imgMatch) {
    return `<figure class="content-image"><img src="${imgMatch[2]}" alt="${imgMatch[1]}" loading="lazy"><figcaption>${imgMatch[1]}</figcaption></figure>`;
  }
  // A block that is entirely bold = section sub-heading
  if (block.startsWith('**') && block.endsWith('**') && !block.slice(2, -2).includes('**')) {
    return `<p class="content-heading">${renderInline(block.slice(2, -2))}</p>`;
  }
  // Preserve single line breaks as <br> within a paragraph
  return `<p>${renderInline(block.replace(/\n/g, '<br>'))}</p>`;
}

/** Render full content string (paragraphs separated by double newlines) */
export function renderContent(content: string): string {
  return content.split('\n\n').map(renderBlock).join('');
}
