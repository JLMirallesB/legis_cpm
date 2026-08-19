import type { APIRoute } from 'astro';
import type { Law, StructureNode } from '../../lib/types';
import { getAllLaws } from '../../lib/laws';

/**
 * Índice de vigencia para el cuaderno personal.
 *
 * Los fragmentos que la gente guarda en su navegador llevan el texto copiado y
 * la fecha en que se guardaron, y hasta ahora nada les decía que la ley había
 * cambiado desde entonces. Con esto el panel puede comparar `savedAt` contra la
 * última fecha en que se tocó ese artículo y avisar.
 *
 * Es un fichero de servicio del propio sitio, no un dataset público: por eso va
 * como endpoint junto a los índices de búsqueda y no bajo public/data/.
 */

interface LawVigencia {
  status: string;
  lastModified: string | null;
  expires: string | null;
  articles: Record<string, string>;
}

/** Última fecha conocida en que cambió cada artículo de la ley. */
function articleChanges(law: Law): Record<string, string> {
  const out: Record<string, string> = {};

  const walk = (nodes: StructureNode[]) => {
    for (const node of nodes) {
      const newest = node.versions?.[0];
      if (newest?.effectiveDate) out[node.id] = newest.effectiveDate;
      if (node.children) walk(node.children);
    }
  };
  walk(law.structure);

  for (const aff of law.legalAnalysis?.posteriorAffectations ?? []) {
    if (!aff.date) continue;
    for (const id of aff.articles ?? []) {
      if (!out[id] || aff.date > out[id]) out[id] = aff.date;
    }
  }

  return out;
}

export const GET: APIRoute = () => {
  const laws: Record<string, LawVigencia> = {};

  for (const law of getAllLaws('es')) {
    laws[law.slug] = {
      status: law.vigpiracy.status,
      lastModified: law.vigpiracy.lastModifiedDate ?? null,
      expires: law.temporality?.type === 'anual' ? law.temporality.expiresDate ?? null : null,
      articles: articleChanges(law),
    };
  }

  return new Response(JSON.stringify({ generated: new Date().toISOString().slice(0, 10), laws }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
