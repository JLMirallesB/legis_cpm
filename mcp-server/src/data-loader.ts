import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Resolve repo root: mcp-server/src/data-loader.ts → repo root is ../../
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

export interface StructureNode {
  type: string;
  id: string;
  number?: string;
  title: string;
  content?: string;
  versions?: { versionId: string; effectiveDate: string; modifiedBy: { lawId: string; title: string } | null; content: string }[];
  children?: StructureNode[];
}

export interface Law {
  id: string;
  slug: string;
  type: string;
  number: string;
  date: string;
  title: string;
  titleShort: string;
  category: string;
  scope: string;
  territory: string;
  temporality: { type: string; schoolYear?: string };
  docType: string;
  vigpiracy: { status: string; statusLabel: string; effectiveDate: string };
  structure: StructureNode[];
  publishedIn: { source: string; url: string; pdfUrl?: string };
  promulgation?: { place: string; date: string; signatories: { name: string; role: string }[] };
}

let lawCache: Map<string, { es: Law; va: Law }> | null = null;

function loadAllLaws(): Map<string, { es: Law; va: Law }> {
  if (lawCache) return lawCache;
  lawCache = new Map();

  const esDir = join(REPO_ROOT, 'data', 'laws', 'es');
  const vaDir = join(REPO_ROOT, 'data', 'laws', 'va');

  for (const file of readdirSync(esDir)) {
    if (!file.endsWith('.json')) continue;
    const slug = file.replace('.json', '');
    const esLaw = JSON.parse(readFileSync(join(esDir, file), 'utf-8')) as Law;
    const vaFile = join(vaDir, file);
    let vaLaw: Law;
    try {
      vaLaw = JSON.parse(readFileSync(vaFile, 'utf-8')) as Law;
    } catch {
      vaLaw = esLaw; // fallback if VA doesn't exist
    }
    lawCache.set(slug, { es: esLaw, va: vaLaw });
  }

  return lawCache;
}

export function listLaws(lang: 'es' | 'va', filters?: { category?: string; scope?: string; territory?: string; type?: string }): { slug: string; title: string; titleShort: string; type: string; category: string; scope: string; territory: string; status: string }[] {
  const laws = loadAllLaws();
  const results: ReturnType<typeof listLaws> = [];

  for (const [slug, pair] of laws) {
    const law = pair[lang];
    if (filters?.category && law.category !== filters.category) continue;
    if (filters?.scope && law.scope !== filters.scope) continue;
    if (filters?.territory && law.territory !== filters.territory) continue;
    if (filters?.type && law.type !== filters.type) continue;
    results.push({
      slug,
      title: law.title,
      titleShort: law.titleShort,
      type: law.type,
      category: law.category,
      scope: law.scope,
      territory: law.territory,
      status: law.vigpiracy.status,
    });
  }

  return results.sort((a, b) => a.title.localeCompare(b.title));
}

export function getLaw(slug: string, lang: 'es' | 'va'): Law | null {
  const laws = loadAllLaws();
  const pair = laws.get(slug);
  return pair ? pair[lang] : null;
}

function findNode(nodes: StructureNode[], id: string): StructureNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function getArticle(lawSlug: string, articleId: string, lang: 'es' | 'va'): { node: StructureNode; lawTitle: string } | null {
  const law = getLaw(lawSlug, lang);
  if (!law) return null;
  const node = findNode(law.structure, articleId);
  if (!node) return null;
  return { node, lawTitle: law.title };
}

export function searchArticles(query: string, lang: 'es' | 'va', maxResults = 20): { lawSlug: string; lawTitle: string; articleId: string; articleTitle: string; snippet: string }[] {
  const laws = loadAllLaws();
  const results: ReturnType<typeof searchArticles> = [];
  const q = query.toLowerCase();

  function searchNodes(nodes: StructureNode[], lawSlug: string, lawTitle: string) {
    for (const node of nodes) {
      if (results.length >= maxResults) return;

      const titleMatch = node.title.toLowerCase().includes(q);
      const contentMatch = node.content?.toLowerCase().includes(q);

      if (titleMatch || contentMatch) {
        let snippet = '';
        if (contentMatch && node.content) {
          const idx = node.content.toLowerCase().indexOf(q);
          const start = Math.max(0, idx - 80);
          const end = Math.min(node.content.length, idx + query.length + 80);
          snippet = (start > 0 ? '...' : '') + node.content.slice(start, end) + (end < node.content.length ? '...' : '');
        } else {
          snippet = node.content?.slice(0, 150) || '';
        }

        results.push({
          lawSlug,
          lawTitle,
          articleId: node.id,
          articleTitle: node.title,
          snippet,
        });
      }

      if (node.children) searchNodes(node.children, lawSlug, lawTitle);
    }
  }

  for (const [slug, pair] of laws) {
    if (results.length >= maxResults) break;
    const law = pair[lang];
    searchNodes(law.structure, slug, law.title);
  }

  return results;
}

export function getChangelog(): { version: string; date: string; entries: { es: { type: string; description: string }[]; va: { type: string; description: string }[] } }[] {
  const file = join(REPO_ROOT, 'data', 'changelog.json');
  return JSON.parse(readFileSync(file, 'utf-8'));
}

export function getArticleVersions(lawSlug: string, articleId: string, lang: 'es' | 'va'): { articleTitle: string; versions: { versionId: string; effectiveDate: string; modifiedBy: string | null; contentPreview: string }[] } | null {
  const result = getArticle(lawSlug, articleId, lang);
  if (!result || !result.node.versions) return null;

  return {
    articleTitle: result.node.title,
    versions: result.node.versions.map((v) => ({
      versionId: v.versionId,
      effectiveDate: v.effectiveDate,
      modifiedBy: v.modifiedBy ? v.modifiedBy.title : null,
      contentPreview: v.content.slice(0, 200) + (v.content.length > 200 ? '...' : ''),
    })),
  };
}
