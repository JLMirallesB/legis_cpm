import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import changelog from '../../data/changelog.json';

const TYPE_LABELS: Record<string, string> = {
  nou: 'Nou',
  millora: 'Millora',
  corregit: 'Corregit',
  actualitzat: 'Actualitzat',
  eliminat: 'Eliminat',
};

export function GET(context: APIContext) {
  return rss({
    title: 'Legis CPMDEM - Novetats',
    description: 'Novetats i actualitzacions de Legis CPMDEM, legislació de Conservatoris Professionals de Música i Dansa i Escoles de Música de la Generalitat Valenciana.',
    site: context.site!.toString(),
    items: changelog.map((release) => {
      const grouped: Record<string, number> = {};
      for (const entry of release.entries.va) {
        grouped[entry.type] = (grouped[entry.type] || 0) + 1;
      }
      const summary = Object.entries(grouped)
        .map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}`)
        .join(', ');

      const content = release.entries.va
        .map((e) => `<li><strong>${TYPE_LABELS[e.type] || e.type}:</strong> ${e.description}</li>`)
        .join('');

      return {
        title: `Versió ${release.version} (${summary})`,
        pubDate: new Date(release.date),
        link: `/legis_cpmdem/va/changelog/`,
        content: `<ul>${content}</ul>`,
      };
    }),
    customData: '<language>ca</language>',
  });
}
