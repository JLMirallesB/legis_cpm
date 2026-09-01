// Tipos principales del modelo de datos de Legis CPM

export type Lang = 'es' | 'va';

export type LawType =
  | 'ley_organica'
  | 'ley'
  | 'real_decreto'
  | 'decreto'
  | 'orden'
  | 'resolucion'
  | 'circular'
  | 'instrucciones'
  | 'documento'
  | 'correccion_errores';

export type VigencyStatus =
  | 'vigente'
  | 'vigente_parcial'
  | 'derogada_parcial'
  | 'derogada';

export type LawScope = 'general' | 'musica_y_danza' | 'musica' | 'danza' | 'escuelas_musica_artes_escenicas';
export type LawTerritory = 'estatal' | 'autonomico';
export type LawDocType = 'normativa' | 'documentos';

export interface LawTemporality {
  type: 'permanente' | 'anual';
  schoolYear?: string;   // e.g. "25-26" (only if type === 'anual')
  expiresDate?: string;  // e.g. "2026-09-01" (only if type === 'anual')
}

export type StructureNodeType =
  | 'preambulo'
  | 'titulo'
  | 'capitulo'
  | 'seccion'
  | 'articulo'
  | 'disposicion_adicional'
  | 'disposicion_transitoria'
  | 'disposicion_derogatoria'
  | 'disposicion_final'
  | 'anexo';

export interface PublicationInfo {
  source: 'DOGV' | 'BOE' | string;
  number: string;
  date: string; // YYYY-MM-DD
  url: string; // Ficha de la disposición (análisis jurídico) en DOGV/BOE
  pdfUrl?: string; // Enlace directo al PDF publicado
}

export interface Vigency {
  status: VigencyStatus;
  statusLabel: string;
  effectiveDate: string; // YYYY-MM-DD
  lastModifiedDate?: string; // YYYY-MM-DD
}

export interface ArticleVersion {
  versionId: string;
  effectiveDate: string; // YYYY-MM-DD
  modifiedBy: {
    lawId: string;
    title: string;
    articleRef?: string;
  } | null;
  content: string;
}

export interface StructureNode {
  type: StructureNodeType;
  id: string;
  number?: string;
  title: string;
  content?: string;
  versions?: ArticleVersion[];
  children?: StructureNode[];
}

export interface Affectation {
  lawId: string;
  title: string;
  type: 'modifica' | 'deroga' | 'deroga_parcial' | 'anade' | 'sustituye';
  articles?: string[];
  date?: string; // YYYY-MM-DD
  description?: string;
}

export interface LegalAnalysis {
  enactedPursuantTo: {
    lawId?: string;
    title: string;
    articles?: string[];
    relationship: 'habilitante' | 'desarrollo' | 'conformidad';
  }[];
  priorAffectations: Affectation[];
  posteriorAffectations: Affectation[];
  derogations: Affectation[];
  concordances: {
    lawId?: string;
    title: string;
    description?: string;
  }[];
}

export interface Signatory {
  name: string;
  role: string;
}

export interface Promulgation {
  place: string;
  date: string; // YYYY-MM-DD
  signatories: Signatory[];
}

export interface FormModel {
  id: string;
  title: string; // Button label, in the language of the Law JSON
  pdfUrl: string; // URL to download the model PDF
}

export interface ExternalResource {
  id: string;
  title: string;
  url: string;
}

export interface Law {
  id: string;
  slug: string;
  type: LawType;
  number: string;
  date: string; // YYYY-MM-DD
  publishedIn: PublicationInfo;
  title: string;
  titleShort: string;
  category: string;
  vigpiracy: Vigency;
  structure: StructureNode[];
  legalAnalysis: LegalAnalysis;
  promulgation?: Promulgation;
  formModels?: FormModel[];
  externalResources?: ExternalResource[];
  scope: LawScope;
  territory: LawTerritory;
  temporality: LawTemporality;
  docType: LawDocType;
}

export interface LawMetadata {
  id: string;
  slug: string;
  type: LawType;
  number: string;
  date: string;
  title: string;
  titleShort: string;
  category: string;
  vigpiracy: Vigency;
  scope: LawScope;
  territory: LawTerritory;
  temporality: LawTemporality;
  docType: LawDocType;
}

export interface Category {
  id: string;
  label: Record<Lang, string>;
  description?: Record<Lang, string>;
  icon?: string;
}

// ── Cuadernos pregrabados ───────────────────────────────

// ── Referencias con ancla ───────────────────────────────

/**
 * Apunta a un apartado concreto de un artículo. El texto NO se guarda aquí: se
 * resuelve desde la ley al compilar, para que una cita no pueda petrificarse.
 */
export interface Ref {
  law: string;                            // slug de la ley
  article: string;                        // id del nodo: art-121, da-1, anexo-2…
  apartado?: string;                      // ruta: "2", "1.k", "5.b.3"; ausente = nodo entero
  subtree?: boolean;                      // incluir también los sub-apartados que cuelgan
  part?: string;                          // id de la parte del documento a la que pertenece
  checkedAt?: string;                     // YYYY-MM-DD en que se revisó por última vez
  hash?: Partial<Record<Lang, string>>;   // huella del texto resuelto ese día
  note?: string;                          // por qué está aquí (uso editorial)
}

export type FreshnessLevel = 'ok' | 'caducado' | 'revisar' | 'derogado' | 'roto';

export interface FreshnessReason {
  code: 'ancla-rota' | 'texto-cambiado' | 'ley-derogada' | 'articulo-modificado'
      | 'articulo-afectado' | 'articulo-derogado' | 'curso-caducado';
  detail?: string;
}

export interface Freshness {
  level: FreshnessLevel;
  reasons: FreshnessReason[];
}

/**
 * Por qué una ficha se queda fuera del cribado por términos. No todo lo que
 * este repositorio agrupa tiene una palabra que lo nombre: un cuaderno puede
 * definirse por «los artículos 15 a 24 de la Ley 40/2015» o por un tema
 * difuso que se leyó, no que se buscó. Buscarlo por término da mucho ruido y,
 * peor, pierde apartados que sí lo regulan sin nombrarlo.
 *
 * Se declara para que el hueco quede escrito: `refs-triage.mjs --todas` las
 * lista al final en vez de callárselas.
 */
export interface TriagePolicy {
  mode: 'manual';
  reason: string;
}

export interface NotebookDefinition {
  id: string;
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  updatedAt: string;
  refs: Ref[];

  /**
   * Términos para el cribado de cada ingesta, en los dos idiomas y sin tildes
   * (el cribado compara plegado). Solo lo llevan los cuadernos que se definen
   * por un nombre propio; el resto declara `triage`.
   */
  terms?: string[];

  /** Homónimos que se tapan antes de comparar. */
  exclude?: string[];

  /** Decisiones de «esto no va aquí», mismo formato que en los documentos. */
  discarded?: CenterDocDefinition['discarded'];

  /** Presente solo si el cuaderno NO se criba por términos. */
  triage?: TriagePolicy;
}

export interface ResolvedFragment {
  id: string;
  text: string;
  html: string;
  articleId: string;
  articleTitle: string;
  apartado: string | null;
  lawSlug: string;
  lawShort: string;
  lawTitle: string;
  url: string;
  versionLabel: string | null;
  apaParenthetical: string;
  apaReference: string;
  savedAt: string;
  freshness: Freshness;
}

export interface ResolvedNotebook {
  id: string;
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  fragments: ResolvedFragment[];
  lawCount: number;
  freshness: FreshnessLevel;
}

// ── Documentos de centro ────────────────────────────────

/**
 * Ficha de un documento de centro: recoge todo lo que la normativa dice sobre
 * él. No guarda texto de las leyes, solo referencias con ancla.
 */
export interface CenterDocDefinition {
  id: string;
  slug: string;
  order: number;
  short: Record<Lang, string>;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  terms: string[];                  // para el cribado de cada ingesta
  updatedAt: string;

  /**
   * Partes con nombre propio que viven dentro de este documento. No duplican
   * nada: agrupan referencias que ya están en `refs` mediante `part`, y se
   * publican como página aparte para que quien busque «proyecto curricular»
   * llegue a algún sitio.
   */
  parts?: {
    id: string;
    slug: string;
    title: Record<Lang, string>;
    description: Record<Lang, string>;
  }[];

  /** Cómo encaja con otros documentos: la matrioska, dicha en voz alta. */
  related?: { slug: string; relation: 'contiene' | 'parte-de' | 'deriva-de' }[];
  // «origina» no se declara nunca: es la inversa calculada de «deriva-de».
  refs: Ref[];
  /**
   * Decisiones de «esto no va aquí». Dos formas:
   * - una referencia concreta: { law, article, apartado?, reason }
   * - un grupo: { law, items: ["art-9#1.a", …], reason } — para cuando una
   *   norma nombra al órgano treinta veces de pasada y enumerarlas una a una
   *   volvería el registro ilegible.
   */
  discarded: {
    law: string;
    article?: string;               // "*" = la ley entera
    apartado?: string;
    items?: string[];               // "art-9#1.a"
    reason: string;
  }[];
}

/** Los cuatro bloques en que se ordena una ficha. */
export type CenterDocGroupId = 'estatal' | 'autonomico' | 'curso' | 'historico';

export interface CenterDocLawGroup {
  lawSlug: string;
  lawShort: string;
  lawTitle: string;
  schoolYear?: string;
  fragments: ResolvedFragment[];
}

export interface CenterDocGroup {
  id: CenterDocGroupId;
  laws: CenterDocLawGroup[];
}

/** Un descarte, resuelto para poder revisarlo sin abrir el JSON. */
export interface ResolvedDiscard {
  lawSlug: string;
  lawShort: string;
  articleId: string;      // "*" = la ley entera
  articleTitle: string;
  apartado: string | null;
  reason: string;
  preview: string;        // primeras líneas del texto descartado
  url: string | null;
  count?: number;         // descarte agrupado: cuántas menciones cubre
}

export interface DiscardLawGroup {
  lawSlug: string;
  lawShort: string;
  items: ResolvedDiscard[];
}

export interface ResolvedPart {
  id: string;
  slug: string;
  title: string;
  description: string;
  refCount: number;
}

export interface ResolvedRelation {
  slug: string;
  title: string;
  short: string;
  relation: 'contiene' | 'parte-de' | 'deriva-de' | 'origina';
}

export interface ResolvedCenterDoc {
  id: string;
  slug: string;
  short: string;
  title: string;
  description: string;
  updatedAt: string;
  groups: CenterDocGroup[];
  parts: ResolvedPart[];
  related: ResolvedRelation[];
  discarded: DiscardLawGroup[];
  refCount: number;
  lawCount: number;
  freshness: FreshnessLevel;
}
