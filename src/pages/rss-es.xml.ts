import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import changelog from '../../data/changelog.json';

const TYPE_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  mejora: 'Mejora',
  corregido: 'Corregido',
  actualizado: 'Actualizado',
  eliminado: 'Eliminado',
};

export function GET(context: APIContext) {
  return rss({
    title: 'Legis CPMDEM - Novedades',
    description: 'Novedades y actualizaciones de Legis CPMDEM, legislación de Conservatorios Profesionales de Música y Danza y Escuelas de Música de la Generalitat Valenciana.',
    site: context.site!.toString(),
    items: changelog.map((release) => {
      const grouped: Record<string, number> = {};
      for (const entry of release.entries.es) {
        grouped[entry.type] = (grouped[entry.type] || 0) + 1;
      }
      const summary = Object.entries(grouped)
        .map(([type, count]) => `${count} ${TYPE_LABELS[type] || type}`)
        .join(', ');

      const content = release.entries.es
        .map((e) => `<li><strong>${TYPE_LABELS[e.type] || e.type}:</strong> ${e.description}</li>`)
        .join('');

      return {
        title: `Versión ${release.version} (${summary})`,
        pubDate: new Date(release.date),
        link: `/legis_cpmdem/es/changelog/`,
        content: `<ul>${content}</ul>`,
      };
    }),
    customData: '<language>es</language>',
  });
}
