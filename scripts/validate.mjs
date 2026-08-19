#!/usr/bin/env node

/**
 * Script de validación para los JSON de leyes en data/laws/
 * Ejecutar: npm run validate
 *
 * Valida: esquema, versiones, paridad es/va, cross-refs, IDs únicos, fechas
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  findNode, currentContent, resolveApartado, resolveApartadoTree, refFreshness, hashText, parseApartados
} from '../src/lib/refs-core.mjs';

const DATA_DIR = join(import.meta.dirname, '..', 'data');
const LAWS_DIR = join(DATA_DIR, 'laws');
const CATEGORIES_FILE = join(DATA_DIR, 'metadata', 'categories.json');
const REFS_DIRS = [join(DATA_DIR, 'notebooks'), join(DATA_DIR, 'center-docs'), join(DATA_DIR, 'organos')];

// Enums from types.ts
const LAW_TYPES = ['ley_organica', 'ley', 'real_decreto', 'decreto', 'orden', 'resolucion', 'circular', 'instrucciones', 'documento', 'correccion_errores'];
const VIGENCY_STATUSES = ['vigente', 'vigente_parcial', 'derogada_parcial', 'derogada'];
const STRUCTURE_NODE_TYPES = ['preambulo', 'titulo', 'capitulo', 'seccion', 'articulo', 'disposicion_adicional', 'disposicion_transitoria', 'disposicion_derogatoria', 'disposicion_final', 'anexo'];
const AFFECTATION_TYPES = ['modifica', 'deroga', 'deroga_parcial', 'anade', 'sustituye'];
const RELATIONSHIP_TYPES = ['habilitante', 'desarrollo', 'conformidad'];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

let errors = 0;
let warnings = 0;

function error(file, msg) {
  console.error(`  ERROR  ${file}: ${msg}`);
  errors++;
}

function warn(file, msg) {
  console.warn(`  WARN   ${file}: ${msg}`);
  warnings++;
}

function isValidDate(str) {
  if (!DATE_RE.test(str)) return false;
  const d = new Date(str + 'T00:00:00');
  return !isNaN(d.getTime());
}

function requireString(obj, field, file, context = '') {
  const path = context ? `${context}.${field}` : field;
  if (typeof obj[field] !== 'string' || obj[field].trim() === '') {
    error(file, `Campo requerido ausente o vacío: ${path}`);
    return false;
  }
  return true;
}

function requireDate(obj, field, file, context = '') {
  const path = context ? `${context}.${field}` : field;
  if (!requireString(obj, field, file, context)) return false;
  if (!isValidDate(obj[field])) {
    error(file, `Fecha inválida en ${path}: "${obj[field]}" (esperado YYYY-MM-DD)`);
    return false;
  }
  return true;
}

function requireEnum(obj, field, allowed, file, context = '') {
  const path = context ? `${context}.${field}` : field;
  if (!allowed.includes(obj[field])) {
    error(file, `Valor inválido en ${path}: "${obj[field]}" (permitidos: ${allowed.join(', ')})`);
    return false;
  }
  return true;
}

// Load categories
let validCategories = [];
try {
  const catData = JSON.parse(readFileSync(CATEGORIES_FILE, 'utf-8'));
  validCategories = catData.categories.map(c => c.id);
} catch (e) {
  console.error(`No se pudo leer categories.json: ${e.message}`);
  process.exit(1);
}

// Collect all law slugs across both languages
const allSlugs = new Set();

function getLawFiles(lang) {
  const dir = join(LAWS_DIR, lang);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort();
}

const esFiles = getLawFiles('es');
const vaFiles = getLawFiles('va');

// Check language parity
const esSlugs = new Set(esFiles.map(f => f.replace('.json', '')));
const vaSlugs = new Set(vaFiles.map(f => f.replace('.json', '')));

for (const slug of esSlugs) {
  if (!vaSlugs.has(slug)) error(slug, `Existe en es/ pero falta en va/`);
  allSlugs.add(slug);
}
for (const slug of vaSlugs) {
  if (!esSlugs.has(slug)) error(slug, `Existe en va/ pero falta en es/`);
  allSlugs.add(slug);
}

// Validate structure nodes recursively
function validateStructure(nodes, file, ids, parentContext = 'structure') {
  if (!Array.isArray(nodes)) {
    error(file, `${parentContext} no es un array`);
    return;
  }

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const ctx = `${parentContext}[${i}]`;

    requireEnum(node, 'type', STRUCTURE_NODE_TYPES, file, ctx);
    requireString(node, 'id', file, ctx);
    requireString(node, 'title', file, ctx);

    // Check unique IDs
    if (node.id) {
      if (ids.has(node.id)) {
        error(file, `ID de estructura duplicado: "${node.id}"`);
      }
      ids.add(node.id);
    }

    // Validate versions
    if (node.versions && Array.isArray(node.versions)) {
      if (node.versions.length === 0) {
        error(file, `${ctx} (${node.id}): versions es un array vacío (eliminar si no hay versiones)`);
      }

      for (let v = 0; v < node.versions.length; v++) {
        const ver = node.versions[v];
        const vctx = `${ctx}.versions[${v}]`;

        requireString(ver, 'versionId', file, vctx);
        requireDate(ver, 'effectiveDate', file, vctx);
        requireString(ver, 'content', file, vctx);

        if (ver.modifiedBy !== null && ver.modifiedBy !== undefined) {
          requireString(ver.modifiedBy, 'lawId', file, `${vctx}.modifiedBy`);
          requireString(ver.modifiedBy, 'title', file, `${vctx}.modifiedBy`);
        }
      }

      // Check versions sorted newest-first
      for (let v = 1; v < node.versions.length; v++) {
        if (node.versions[v].effectiveDate > node.versions[v - 1].effectiveDate) {
          error(file, `${ctx} (${node.id}): versions no están ordenadas de más reciente a más antigua`);
          break;
        }
      }

      // Check content matches newest version
      if (node.versions.length > 0 && node.content !== undefined) {
        if (node.content !== node.versions[0].content) {
          error(file, `${ctx} (${node.id}): content no coincide con versions[0].content`);
        }
      }
    }

    // Recurse into children
    if (node.children) {
      validateStructure(node.children, file, ids, `${ctx}.children`);
    }
  }
}

// Validate affectations
function validateAffectations(affs, file, context) {
  if (!Array.isArray(affs)) return;
  for (let i = 0; i < affs.length; i++) {
    const aff = affs[i];
    const ctx = `${context}[${i}]`;
    requireString(aff, 'lawId', file, ctx);
    requireString(aff, 'title', file, ctx);
    requireEnum(aff, 'type', AFFECTATION_TYPES, file, ctx);
    if (aff.date) requireDate(aff, 'date', file, ctx);
  }
}

// Validate a single law file
function validateLaw(filePath, lang) {
  const fileName = basename(filePath);
  const label = `${lang}/${fileName}`;
  let law;

  try {
    law = JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (e) {
    error(label, `JSON inválido: ${e.message}`);
    return;
  }

  // Top-level required fields
  requireString(law, 'id', label);
  requireString(law, 'slug', label);
  requireEnum(law, 'type', LAW_TYPES, label);
  const isDocumentos = law.docType === 'documentos' || (law.publishedIn && law.publishedIn.source === 'Documentos');
  if (!isDocumentos) requireString(law, 'number', label);
  requireDate(law, 'date', label);
  requireString(law, 'title', label);
  requireString(law, 'titleShort', label);

  // slug should match filename
  const expectedSlug = fileName.replace('.json', '');
  if (law.slug !== expectedSlug) {
    error(label, `slug "${law.slug}" no coincide con nombre de archivo "${expectedSlug}"`);
  }

  // id should match slug
  if (law.id !== law.slug) {
    error(label, `id "${law.id}" no coincide con slug "${law.slug}"`);
  }

  // Category
  if (!validCategories.includes(law.category)) {
    error(label, `Categoría inválida: "${law.category}" (permitidas: ${validCategories.join(', ')})`);
  }

  // publishedIn
  if (law.publishedIn) {
    requireString(law.publishedIn, 'source', label, 'publishedIn');
    if (!isDocumentos) requireString(law.publishedIn, 'number', label, 'publishedIn');
    requireDate(law.publishedIn, 'date', label, 'publishedIn');
    if (!isDocumentos) requireString(law.publishedIn, 'url', label, 'publishedIn');
  } else {
    error(label, 'Campo requerido ausente: publishedIn');
  }

  // vigpiracy
  if (law.vigpiracy) {
    requireEnum(law.vigpiracy, 'status', VIGENCY_STATUSES, label, 'vigpiracy');
    requireString(law.vigpiracy, 'statusLabel', label, 'vigpiracy');
    requireDate(law.vigpiracy, 'effectiveDate', label, 'vigpiracy');
    if (law.vigpiracy.lastModifiedDate) {
      requireDate(law.vigpiracy, 'lastModifiedDate', label, 'vigpiracy');
    }
  } else {
    error(label, 'Campo requerido ausente: vigpiracy');
  }

  // structure
  if (law.structure) {
    const ids = new Set();
    validateStructure(law.structure, label, ids);
  } else {
    error(label, 'Campo requerido ausente: structure');
  }

  // legalAnalysis
  if (law.legalAnalysis) {
    const la = law.legalAnalysis;

    // enactedPursuantTo
    if (Array.isArray(la.enactedPursuantTo)) {
      for (let i = 0; i < la.enactedPursuantTo.length; i++) {
        const ep = la.enactedPursuantTo[i];
        const ctx = `legalAnalysis.enactedPursuantTo[${i}]`;
        requireString(ep, 'title', label, ctx);
        requireEnum(ep, 'relationship', RELATIONSHIP_TYPES, label, ctx);
      }
    }

    validateAffectations(la.priorAffectations, label, 'legalAnalysis.priorAffectations');
    validateAffectations(la.posteriorAffectations, label, 'legalAnalysis.posteriorAffectations');
    validateAffectations(la.derogations, label, 'legalAnalysis.derogations');

    // concordances
    if (Array.isArray(la.concordances)) {
      for (let i = 0; i < la.concordances.length; i++) {
        requireString(la.concordances[i], 'title', label, `legalAnalysis.concordances[${i}]`);
      }
    }
  } else {
    error(label, 'Campo requerido ausente: legalAnalysis');
  }
}

// Cross-reference integrity
function checkCrossRefs(lang) {
  const dir = join(LAWS_DIR, lang);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const filePath = join(dir, file);
    const label = `${lang}/${file}`;
    let law;
    try {
      law = JSON.parse(readFileSync(filePath, 'utf-8'));
    } catch { continue; }

    if (!law.legalAnalysis) continue;

    // Check all lawId references
    const refs = [
      ...law.legalAnalysis.priorAffectations,
      ...law.legalAnalysis.posteriorAffectations,
      ...law.legalAnalysis.derogations,
    ];

    for (const ref of refs) {
      if (ref.lawId) {
        const targetFile = join(dir, `${ref.lawId}.json`);
        if (!existsSync(targetFile)) {
          warn(label, `Referencia a ley inexistente: "${ref.lawId}" (se creará enlace roto hasta que se ingeste)`);
        }
      }
    }

    // Check modifiedBy in article versions
    function checkVersionRefs(nodes) {
      for (const node of nodes) {
        if (node.versions) {
          for (const ver of node.versions) {
            if (ver.modifiedBy && ver.modifiedBy.lawId) {
              const targetFile = join(dir, `${ver.modifiedBy.lawId}.json`);
              if (!existsSync(targetFile)) {
                warn(label, `Artículo ${node.id} versión ${ver.versionId} referencia ley inexistente: "${ver.modifiedBy.lawId}"`);
              }
            }
          }
        }
        if (node.children) checkVersionRefs(node.children);
      }
    }

    if (law.structure) checkVersionRefs(law.structure);
  }
}

// --- Main ---
console.log('\nValidando leyes en data/laws/...\n');

// Validate all law files
for (const lang of ['es', 'va']) {
  const dir = join(LAWS_DIR, lang);
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    validateLaw(join(dir, file), lang);
  }
}

// Cross-reference check (only on es/ to avoid duplicate warnings)
console.log('');
checkCrossRefs('es');

// ── Referencias con ancla (cuadernos) ───────────────────
//
// Aquí es donde se detecta que una cita ha dejado de decir lo que decía.
// Ancla que no resuelve = ERROR: preferimos romper el build a publicar un
// cuaderno al que le falta un fragmento sin que nadie se entere.

function loadLaws(lang) {
  const map = new Map();
  const dir = join(LAWS_DIR, lang);
  if (!existsSync(dir)) return map;
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    map.set(f.replace('.json', ''), JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
  return map;
}

function validateRefs() {
  const laws = { es: loadLaws('es'), va: loadLaws('va') };
  let total = 0;
  let aRevisar = 0;

  for (const dir of REFS_DIRS) {
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const nb = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    const ctx = basename(dir) + '/' + file;

    if (!Array.isArray(nb.refs)) {
      error(ctx, 'falta el array refs[] (¿cuaderno sin migrar a referencias con ancla?)');
      continue;
    }

    nb.refs.forEach((ref, i) => {
      total++;
      const donde = `${ctx} refs[${i}] ${ref.law}/${ref.article}${ref.apartado ? '#' + ref.apartado : ''}`;

      for (const lang of ['es', 'va']) {
        const law = laws[lang].get(ref.law);
        if (!law) { error(donde, `la ley no existe en ${lang}/`); continue; }

        const node = findNode(law.structure, ref.article);
        if (!node) { error(donde, `el artículo no existe en ${lang}/`); continue; }

        const content = currentContent(node);
        let texto = content;

        if (ref.apartado) {
          const res = ref.subtree
            ? resolveApartadoTree(content, ref.apartado)
            : resolveApartado(content, ref.apartado);
          if (!res.ok) {
            error(donde, res.reason === 'ambiguo'
              ? `apartado ambiguo en ${lang}, candidatos: ${res.candidates.join(', ')}`
              : `el apartado no existe en ${lang}; hay: ${res.candidates.slice(0, 12).join(', ')}`);
            continue;
          }
          texto = res.text;
        }

        const estado = refFreshness({ law, node, ref, lang, resolvedText: texto });
        if (estado.level !== 'ok') {
          aRevisar++;
          const motivos = estado.reasons.map(r => r.code + (r.detail ? ` (${r.detail})` : '')).join('; ');
          warn(donde, `${lang}: ${estado.level} — ${motivos}`);
        }
      }
    });
  }
  }

  // Un artículo con distinto número de apartados en cada idioma delata una
  // extracción incompleta: es lo que impide anclar una cita en valenciano.
  const va = loadLaws('va');
  for (const [slug, law] of loadLaws('es')) {
    const otro = va.get(slug);
    if (!otro) continue;
    const walk = nodes => {
      for (const n of nodes) {
        const c = currentContent(n);
        if (c && n.type === 'articulo') {
          const nodoVa = findNode(otro.structure, n.id);
          if (nodoVa) {
            const a = parseApartados(c).length;
            const b = parseApartados(currentContent(nodoVa)).length;
            if (a && b && Math.abs(a - b) > Math.max(2, a * 0.25)) {
              warn(`${slug}/${n.id}`, `apartados desiguales entre idiomas: ${a} en es, ${b} en va`);
            }
          }
        }
        if (n.children) walk(n.children);
      }
    };
    walk(law.structure);
  }

  console.log(`Referencias comprobadas: ${total} (${aRevisar} necesitan revisión)`);
  return total;
}

console.log('\nValidando referencias de los cuadernos...\n');
validateRefs();

// Summary
console.log(`\n${'='.repeat(50)}`);
console.log(`Leyes validadas: ${allSlugs.size} (${esFiles.length} es, ${vaFiles.length} va)`);
console.log(`Errores: ${errors}`);
console.log(`Avisos:  ${warnings}`);
console.log(`${'='.repeat(50)}\n`);

if (errors > 0) {
  console.error('La validación falló con errores.');
  process.exit(1);
} else if (warnings > 0) {
  console.log('Validación OK (con avisos).');
} else {
  console.log('Validación OK.');
}
