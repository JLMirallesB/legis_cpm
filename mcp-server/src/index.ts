#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { listLaws, getLaw, getArticle, searchArticles, getChangelog, getArticleVersions } from './data-loader.js';

const server = new McpServer({
  name: 'legis-cpmdem',
  version: '1.0.0',
});

// Tool: list_laws
server.tool(
  'list_laws',
  'List all available laws with optional filters. Returns slug, title, type, category, scope, territory, and vigency status.',
  {
    lang: z.enum(['es', 'va']).default('es').describe('Language: es (Spanish) or va (Valencian)'),
    category: z.string().optional().describe('Filter by category (curriculo, organizacion, acceso, evaluacion, profesorado, titulaciones, general)'),
    scope: z.string().optional().describe('Filter by scope (general, musica_y_danza, musica, danza)'),
    territory: z.string().optional().describe('Filter by territory (estatal, autonomico)'),
    type: z.string().optional().describe('Filter by law type (decreto, orden, ley_organica, ley, real_decreto, resolucion)'),
  },
  async (args) => {
    const results = listLaws(args.lang, {
      category: args.category,
      scope: args.scope,
      territory: args.territory,
      type: args.type,
    });
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }],
    };
  }
);

// Tool: get_law
server.tool(
  'get_law',
  'Get full metadata and structure of a specific law by its slug. Returns title, date, publication info, vigency, promulgation, and structure tree (without article content for brevity).',
  {
    slug: z.string().describe('Law slug (e.g., decreto-158-2007, orden-28-2011)'),
    lang: z.enum(['es', 'va']).default('es').describe('Language'),
  },
  async (args) => {
    const law = getLaw(args.slug, args.lang);
    if (!law) return { content: [{ type: 'text' as const, text: `Law not found: ${args.slug}` }] };

    // Return metadata + structure outline (without content)
    function outlineNodes(nodes: typeof law.structure): object[] {
      return nodes.map((n) => ({
        type: n.type,
        id: n.id,
        title: n.title,
        hasContent: !!n.content,
        hasVersions: !!(n.versions && n.versions.length > 0),
        children: n.children ? outlineNodes(n.children) : undefined,
      }));
    }

    const result = {
      slug: law.slug,
      type: law.type,
      number: law.number,
      date: law.date,
      title: law.title,
      titleShort: law.titleShort,
      category: law.category,
      scope: law.scope,
      territory: law.territory,
      temporality: law.temporality,
      docType: law.docType,
      vigpiracy: law.vigpiracy,
      publishedIn: law.publishedIn,
      promulgation: law.promulgation,
      structure: outlineNodes(law.structure),
    };

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Tool: get_article
server.tool(
  'get_article',
  'Get the full content of a specific article/section within a law.',
  {
    slug: z.string().describe('Law slug'),
    article_id: z.string().describe('Article/node ID (e.g., art-1, preambulo, da-1, anexo-1)'),
    lang: z.enum(['es', 'va']).default('es').describe('Language'),
  },
  async (args) => {
    const result = getArticle(args.slug, args.article_id, args.lang);
    if (!result) return { content: [{ type: 'text' as const, text: `Article not found: ${args.slug} / ${args.article_id}` }] };

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          lawTitle: result.lawTitle,
          type: result.node.type,
          id: result.node.id,
          title: result.node.title,
          content: result.node.content,
          hasVersions: !!(result.node.versions && result.node.versions.length > 0),
          children: result.node.children?.map((c) => ({ type: c.type, id: c.id, title: c.title })),
        }, null, 2),
      }],
    };
  }
);

// Tool: search_articles
server.tool(
  'search_articles',
  'Search across all laws for articles matching a text query. Returns matching articles with context snippets.',
  {
    query: z.string().describe('Search text (searches in article titles and content)'),
    lang: z.enum(['es', 'va']).default('es').describe('Language'),
    max_results: z.number().default(20).describe('Maximum number of results'),
  },
  async (args) => {
    const results = searchArticles(args.query, args.lang, args.max_results);
    return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] };
  }
);

// Tool: get_changelog
server.tool(
  'get_changelog',
  'Get the recent changelog/news entries. Returns version numbers, dates, and change descriptions.',
  {
    limit: z.number().default(5).describe('Number of recent versions to return'),
  },
  async (args) => {
    const changelog = getChangelog();
    const limited = changelog.slice(0, args.limit);
    return { content: [{ type: 'text' as const, text: JSON.stringify(limited, null, 2) }] };
  }
);

// Tool: get_article_versions
server.tool(
  'get_article_versions',
  'Get the version history of a specific article (shows how it changed over time through modifications by other laws).',
  {
    slug: z.string().describe('Law slug'),
    article_id: z.string().describe('Article ID'),
    lang: z.enum(['es', 'va']).default('es').describe('Language'),
  },
  async (args) => {
    const result = getArticleVersions(args.slug, args.article_id, args.lang);
    if (!result) return { content: [{ type: 'text' as const, text: `No versions found for ${args.slug} / ${args.article_id}` }] };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
  }
);

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Legis CPMDEM MCP server running on stdio');
}

main().catch(console.error);
