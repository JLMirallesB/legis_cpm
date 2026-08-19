#!/usr/bin/env node

/**
 * Propone la curación de una ficha de órgano o cargo.
 *
 *   node scripts/organos-clasificar.mjs direccion            informe
 *   node scripts/organos-clasificar.mjs direccion --write    escribe la ficha
 *
 * A un cargo casi toda la normativa le nombra, así que el criterio no puede ser
 * «lo menciona» sino «le atribuye algo». Se propone incluir cuando el órgano
 * está en posición de sujeto de un deber —«la dirección aprobará», «corresponde
 * al claustro»— o cuando el artículo entero va de él; el resto se agrupa como
 * mención incidental, con su cuenta, para que el registro siga siendo legible.
 *
 * Propone: la decisión final es de quien lo revisa.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseApartados, currentContent, normalizeText } from '../src/lib/refs-core.mjs';

const DATA = join(import.meta.dirname, '..', 'data');
const slug = process.argv[2];
const WRITE = process.argv.includes('--write');

const ruta = join(DATA, 'organos', slug + '.json');
if (!existsSync(ruta)) { console.error('No existe: ' + slug); process.exit(1); }
const doc = JSON.parse(readFileSync(ruta, 'utf8'));

const fold0 = s => normalizeText(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * `exclude` tapa las expresiones que se parecen pero no son: la «dirección del
 * departamento» o la «dirección territorial» no son la dirección del centro.
 * Se sustituyen antes de buscar, así no pueden dar un falso positivo.
 */
const EXCLUDE = (doc.exclude || []).map(fold0);
const fold = s => {
  let t = fold0(s);
  for (const e of EXCLUDE) t = t.split(e).join(' ··· ');
  return t;
};

const terms = doc.terms.map(fold0);
// Términos para reconocer que un artículo ENTERO va del órgano; suelen ser más
// cortos («la dirección») y darían demasiado ruido buscándolos en el cuerpo.
const titleTerms = (doc.titleTerms || doc.terms).map(fold0);

const VERBOS = 'tendra|tendran|sera|seran|debera|deberan|podra|podran|ejercera|ejerceran|elaborara|elaboraran|'
  + 'aprobara|aprobaran|informara|informaran|coordinara|coordinaran|garantizara|velara|impulsara|convocara|'
  + 'presidira|designara|nombrara|remitira|adoptara|establecera|realizara|supervisara|promovera|fomentara|'
  + 'dirigira|organizara|planificara|evaluara|resolvera|autorizara|comunicara|custodiara|expedira|asumira|'
  + 'corresponde|competen|le corresponde|actuara|participara|propondra|revisara|firmara|dara|hara|estara|'
  + 'tiene|tienen|debe|deben|puede|pueden|asume|ejerce|elabora|aprueba|coordina|dirige|vela|impulsa';

/** ¿El apartado le atribuye algo al órgano, o solo lo nombra? */
function atribuye(texto, titulo) {
  const t = fold(texto);
  const ti = fold(titulo);

  // El artículo entero va de él: su título lo nombra.
  if (titleTerms.some(q => ti.includes(q))) return 'titulo';

  for (const q of terms) {
    const i = t.indexOf(q);
    if (i < 0) continue;
    // sujeto al principio del apartado, tras el marcador
    const cabeza = t.slice(0, 90);
    if (cabeza.includes(q) && new RegExp('\\b(' + VERBOS + ')\\b').test(t.slice(i, i + 220))) return 'sujeto';
    // «corresponde a la dirección…», «son funciones del claustro…»
    if (new RegExp('(corresponde[rn]?a?n? a|son (funciones|competencias) (de|del|de la)|competen a)\\s+(el |la |los |las )?' + q).test(t)) return 'atribucion';
  }
  return null;
}

/**
 * Normas fuera del ámbito de la v1 (conservatorios profesionales). Se descartan
 * enteras en cualquier ficha de órgano en vez de apartado por apartado.
 */
const FUERA_DE_AMBITO = {
  'ley-1-2024': 'Enseñanzas artísticas superiores: fuera del ámbito de la v1',
  'circular-5-2025-iseacv': 'ISEACV y enseñanzas superiores: fuera del ámbito de la v1',
  'decreto-2-2022': 'Escuelas de enseñanza artística no formal: fuera del ámbito de la v1',
  'decreto-46-2026': 'Modifica el Decreto 2/2022, de escuelas: fuera del ámbito de la v1',
  'ley-2-1998': 'Escuelas de música y danza: fuera del ámbito de la v1',
  'ley-organica-3-2020': 'Modifica la LOE; el texto vigente se cita en la LOE'
};

const laws = [];
for (const f of readdirSync(join(DATA, 'laws', 'es')).filter(f => f.endsWith('.json')).sort()) {
  laws.push(JSON.parse(readFileSync(join(DATA, 'laws', 'es', f), 'utf8')));
}

const refs = [];
const grupos = new Map();
let nIncl = 0, nDesc = 0;

const fueraUsadas = new Map();

for (const law of laws) {
  const walk = nodes => {
    for (const node of nodes) {
      const content = currentContent(node);
      if (content) {
        // Si el artículo entero va del órgano, se ancla entero: trocearlo en
        // apartados dejaría fuera sus letras, que son justo sus funciones.
        if (titleTerms.some(q => fold(node.title).includes(q))) {
          refs.push({ law: law.slug, article: node.id, _motivo: 'titulo' });
          nIncl++;
          if (node.children) walk(node.children);
          continue;
        }
        for (const ap of parseApartados(content)) {
          const texto = fold(ap.text);
          if (!terms.some(q => texto.includes(q))) continue;
          const motivo = atribuye(ap.text, node.title);
          if (motivo) {
            // Si lo que casa es la cabecera del artículo, sus letras son el
            // desarrollo: se ancla el artículo entero. En la LOE los títulos
            // son solo «Competencias.» y el órgano se nombra en la cabecera.
            if (ap.path === '0') {
              refs.push({ law: law.slug, article: node.id, _motivo: 'cabecera' });
              nIncl++;
              break;
            }
            refs.push({ law: law.slug, article: node.id, apartado: ap.path, _motivo: motivo });
            nIncl++;
          } else {
            if (!grupos.has(law.slug)) grupos.set(law.slug, []);
            grupos.get(law.slug).push(node.id + '#' + ap.path);
            nDesc++;
          }
        }
      }
      if (node.children) walk(node.children);
    }
  };
  if (FUERA_DE_AMBITO[law.slug]) continue;
  walk(law.structure);
}

console.log(`\n══ ${slug}: ${nIncl} propuestas para incluir, ${nDesc} menciones incidentales`);
const porLey = {};
for (const r of refs) (porLey[r.law] = porLey[r.law] || []).push(r.article + (r.apartado ? '#' + r.apartado : ' (entero)') + ' [' + r._motivo + ']');
for (const [l, v] of Object.entries(porLey)) {
  console.log(`  ${l}  (${v.length})`);
  console.log('     ' + v.slice(0, 14).join('  ') + (v.length > 14 ? '  …' : ''));
}
console.log('  descartes agrupados: ' + [...grupos.entries()].map(([l, v]) => l + ' (' + v.length + ')').join(', '));

if (WRITE) {
  doc.refs = refs.map(({ _motivo, ...r }) => r);
  doc.discarded = [
    ...Object.entries(FUERA_DE_AMBITO).map(([law, reason]) => ({ law, article: '*', reason })),
    ...[...grupos.entries()].map(([law, items]) => ({
      law, items, reason: 'Menciones incidentales: la norma nombra la figura sin atribuirle nada'
    }))
  ];
  writeFileSync(ruta, JSON.stringify(doc, null, 2) + '\n');
  console.log('  → escrito');
}
