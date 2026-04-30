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
  | 'documento'
  | 'correccion_errores';

export type VigencyStatus =
  | 'vigente'
  | 'vigente_parcial'
  | 'derogada_parcial'
  | 'derogada';

export type LawScope = 'general' | 'musica_y_danza' | 'musica' | 'danza';
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

export interface NotebookFragmentRef {
  lawSlug: string;
  articleId: string;
  excerpt?: string | Record<Lang, string>;
}

export interface NotebookDefinition {
  id: string;
  slug: string;
  title: Record<Lang, string>;
  description: Record<Lang, string>;
  updatedAt: string;
  fragments: NotebookFragmentRef[];
}

export interface ResolvedFragment {
  id: string;
  text: string;
  html: string;
  articleId: string;
  articleTitle: string;
  lawSlug: string;
  lawShort: string;
  lawTitle: string;
  url: string;
  versionLabel: string | null;
  apaParenthetical: string;
  apaReference: string;
  savedAt: string;
}

export interface ResolvedNotebook {
  id: string;
  slug: string;
  title: string;
  description: string;
  updatedAt: string;
  fragments: ResolvedFragment[];
  lawCount: number;
}
