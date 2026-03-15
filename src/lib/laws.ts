import type { Lang, Law, LawMetadata, Category } from './types';

// Importar todos los JSON de leyes estáticamente.
// Astro necesita imports estáticos para generar páginas en build time.
const lawModulesEs = import.meta.glob('/data/laws/es/*.json', { eager: true });
const lawModulesVa = import.meta.glob('/data/laws/va/*.json', { eager: true });
const categoriesModule = import.meta.glob('/data/metadata/categories.json', { eager: true });

/**
 * Obtiene todas las leyes para un idioma dado.
 */
export function getAllLaws(lang: Lang): Law[] {
  const modules = lang === 'va' ? lawModulesVa : lawModulesEs;
  return Object.values(modules).map((mod: any) => mod.default ?? mod);
}

/**
 * Obtiene los metadatos ligeros de todas las leyes (sin contenido).
 */
export function getAllLawMetadata(lang: Lang): LawMetadata[] {
  return getAllLaws(lang).map((law) => ({
    id: law.id,
    slug: law.slug,
    type: law.type,
    number: law.number,
    date: law.date,
    title: law.title,
    titleShort: law.titleShort,
    category: law.category,
    vigpiracy: law.vigpiracy,
  }));
}

/**
 * Obtiene una ley por su slug.
 */
export function getLawBySlug(slug: string, lang: Lang): Law | undefined {
  return getAllLaws(lang).find((law) => law.slug === slug);
}

/**
 * Obtiene las categorías.
 */
export function getCategories(): Category[] {
  const mod: any = Object.values(categoriesModule)[0];
  const data = mod.default ?? mod;
  return data.categories;
}

/**
 * Agrupa las leyes por categoría.
 */
export function getLawsByCategory(lang: Lang): Map<string, LawMetadata[]> {
  const laws = getAllLawMetadata(lang);
  const grouped = new Map<string, LawMetadata[]>();

  for (const law of laws) {
    const cat = law.category;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(law);
  }

  // Ordenar cada grupo por fecha descendente
  for (const [, laws] of grouped) {
    laws.sort((a, b) => b.date.localeCompare(a.date));
  }

  return grouped;
}
