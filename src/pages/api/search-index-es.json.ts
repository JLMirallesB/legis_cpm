import type { APIRoute } from 'astro';
import type { StructureNode } from '../../lib/types';
import { getAllLaws } from '../../lib/laws';

interface SearchEntry {
  slug: string;
  title: string;
  titleShort: string;
  number: string;
  type: string;
  date: string;
  vigpiracy: string;
  vigencia: string;
  source: string;
  year: number;
  scope: string;
  territory: string;
  temporality: { type: string; schoolYear?: string; expiresDate?: string };
  docType: string;
  signatories: { name: string; role: string }[];
  fragments: { id: string; title: string; text: string }[];
}

function extractFragments(nodes: StructureNode[]): { id: string; title: string; text: string }[] {
  const fragments: { id: string; title: string; text: string }[] = [];
  for (const node of nodes) {
    if (node.content) {
      fragments.push({ id: node.id, title: node.title, text: node.content });
    }
    if (node.versions && node.versions.length > 0) {
      // Index the latest version content
      fragments.push({ id: node.id, title: node.title, text: node.versions[0].content });
    }
    if (node.children) {
      fragments.push(...extractFragments(node.children));
    }
  }
  return fragments;
}

export const GET: APIRoute = () => {
  const laws = getAllLaws('es');
  const now = new Date();
  const index: SearchEntry[] = laws.map((law) => {
    const isDerogada = law.vigpiracy.status === 'derogada' || law.vigpiracy.status === 'derogada_parcial';
    const isExpiredAnual = law.temporality?.type === 'anual'
      && law.temporality.expiresDate
      && new Date(law.temporality.expiresDate) < now;
    return {
      slug: law.slug,
      title: law.title,
      titleShort: law.titleShort,
      number: law.number,
      type: law.type,
      date: law.date,
      vigpiracy: law.vigpiracy.status,
      vigencia: (isDerogada || isExpiredAnual) ? 'historico' : 'vigente',
      source: law.publishedIn.source === 'CEICE' ? 'Documentos' : law.publishedIn.source,
      year: new Date(law.publishedIn.date).getFullYear(),
      scope: law.scope,
      territory: law.territory,
      temporality: law.temporality,
      docType: law.docType,
      signatories: law.promulgation?.signatories ?? [],
      fragments: extractFragments(law.structure),
    };
  });

  return new Response(JSON.stringify(index), {
    headers: { 'Content-Type': 'application/json' },
  });
};
