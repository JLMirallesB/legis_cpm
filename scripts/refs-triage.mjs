#!/usr/bin/env node

/**
 * Criba el corpus buscando qué apartados hablan de una ficha: un documento de
 * centro, un órgano o un cuaderno.
 *
 *   node scripts/refs-triage.mjs pec              candidatos nuevos
 *   node scripts/refs-triage.mjs pec --all        también los ya decididos
 *   node scripts/refs-triage.mjs pec --ley slug   solo una ley
 *   node scripts/refs-triage.mjs --todas --ley slug   todas las fichas de golpe
 *
 * NO decide nada: propone. Cada candidato se acepta añadiéndolo a `refs` de la
 * ficha o se rechaza añadiéndolo a `discarded`, y lo que ya está decidido no
 * se vuelve a preguntar. Es el paso obligatorio de cada ingesta: así una ley
 * nueva no puede pasar sin que alguien mire si toca a algún documento.
 *
 * No todas las fichas se criban por términos. Una que se define por un tramo
 * de articulado («los arts. 15-24 de la Ley 40/2015») o por un tema difuso
 * declara `triage: { mode: "manual", reason }`: buscarla por palabra da ruido
 * y, peor, pierde apartados que la regulan sin nombrarla. `--todas` las lista
 * al final en vez de callárselas, para que el hueco se vea.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseApartados, currentContent, normalizeText } from '../src/lib/refs-core.mjs';

const DATA = join(import.meta.dirname, '..', 'data');
const CARPETAS = ['center-docs', 'organos', 'notebooks'];

const args = process.argv.slice(2);
const TODOS = args.includes('--all');
const TODAS = args.includes('--todas');
const soloLey = args.includes('--ley') ? args[args.indexOf('--ley') + 1] : null;
const slug = args.find(a => !a.startsWith('--') && a !== soloLey);

if (!slug && !TODAS) {
  console.error('Uso: node scripts/refs-triage.mjs <ficha> [--all] [--ley slug]');
  console.error('     node scripts/refs-triage.mjs --todas [--all] [--ley slug]');
  process.exit(1);
}

/** Las fichas a cribar, con la carpeta de la que salen. */
function fichas() {
  if (slug) {
    const ruta = CARPETAS.map(c => join(DATA, c, slug + '.json')).find(p => existsSync(p));
    if (!ruta) { console.error('No existe la ficha: ' + slug); process.exit(1); }
    return [ruta];
  }
  return CARPETAS.flatMap(c => {
    const dir = join(DATA, c);
    return existsSync(dir)
      ? readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => join(dir, f))
      : [];
  });
}

// Las leyes se leen una sola vez aunque se criben las treinta fichas.
const laws = [];
const dirLeyes = join(DATA, 'laws', 'es');
for (const f of readdirSync(dirLeyes).filter(f => f.endsWith('.json')).sort()) {
  laws.push(JSON.parse(readFileSync(join(dirLeyes, f), 'utf8')));
}

/**
 * ¿El apartado REGULA el documento o solo lo menciona de pasada?
 * Un artículo que dice «de acuerdo con el proyecto educativo» no explica nada
 * sobre el PEC; uno que dice «el proyecto educativo incluirá» sí.
 */
const VERBOS = /\b(elaborar[aá]?n?|elaboraci[oó]n|aprobar[aá]?n?|aprobaci[oó]n|incluir[aá]?n?|inclusi[oó]n|contendr[aá]n?|contener|recoger[aá]n?|recoge|comprender[aá]|definir[aá]|establecer[aá]|fijar[aá]|revisar[aá]|revisi[oó]n|modificar[aá]|publicidad|p[uú]blico|remitir[aá]|constituye|formar[aá] parte|se concreta|desarrollar[aá]|evaluar[aá]n?|informar[aá]|propuestas para la elaboraci[oó]n|elaborar|aprovar[aà]?n?|elaboraci[oó]|aprovaci[oó]|inclour[aà]|contindr[aà]|arreplegar[aà]|arreplega|establir[aà]|revisar[aà]|revisi[oó]|constituïx|constitueix|formar[aà] part|es concreta|desenvolupar[aà])\b/i;

/** Criba una ficha. Devuelve cuántos candidatos deja sin decidir. */
function cribar(rutaDoc) {
  const doc = JSON.parse(readFileSync(rutaDoc, 'utf8'));

  /** Compara sin tildes: los términos de búsqueda se escriben sin ellas y así
   *  «règim» y «régimen» caen bajo la misma consulta. */
  const EXCLUDE = (doc.exclude || []).map(s =>
    normalizeText(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

  /** Compara sin tildes y tapando los homónimos declarados en `exclude`. */
  const fold = s => {
    let t = normalizeText(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const e of EXCLUDE) t = t.split(e).join(' ··· ');
    return t;
  };

  const terms = (doc.terms || []).map(fold);

  const yaPuestos = new Set((doc.refs || []).map(r => r.law + '/' + r.article + '#' + (r.apartado || '')));
  const yaDescartados = new Set([
    ...(doc.discarded || []).filter(d => d.article).map(d => d.law + '/' + d.article + '#' + (d.apartado ?? '')),
    ...(doc.discarded || []).flatMap(d => (d.items || []).map(i => d.law + '/' + i))
  ]);
  const leyesDescartadas = new Set((doc.discarded || []).filter(d => d.article === '*' && !d.items).map(d => d.law));

  // Un artículo citado entero cubre todos sus apartados: si no, el cribado
  // volvería a preguntar por cada apartado del art. 121 de la LOE en cada ingesta.
  const subarboles = (doc.refs || []).filter(r => r.subtree && r.apartado)
    .map(r => r.law + '/' + r.article + '#' + r.apartado);

  const nodosCompletos = new Set([
    ...(doc.refs || []).filter(r => !r.apartado).map(r => r.law + '/' + r.article),
    ...(doc.discarded || []).filter(d => d.article && !d.apartado && d.article !== '*' && !d.items).map(d => d.law + '/' + d.article)
  ]);

  let nuevos = 0, decididos = 0;
  const lineas = [];

  for (const law of laws) {
    if (soloLey && law.slug !== soloLey) continue;
    if (leyesDescartadas.has(law.slug) && !TODOS) continue;

    const hits = [];

    const walk = (nodes) => {
      for (const node of nodes) {
        const content = currentContent(node);
        if (content) {
          for (const ap of parseApartados(content)) {
            const texto = fold(ap.text);
            if (!terms.some(t => texto.includes(t))) continue;
            const clave = law.slug + '/' + node.id + '#' + ap.path;
            const nodo = law.slug + '/' + node.id;
            const bajoSubarbol = subarboles.some(sa => clave.startsWith(sa + '.'));
            const estado = yaPuestos.has(clave) || yaPuestos.has(nodo + '#') ? 'EN LA FICHA'
              : bajoSubarbol ? 'cubierto por el apartado padre'
              : nodosCompletos.has(nodo) ? 'cubierto por el nodo entero'
                : yaDescartados.has(clave) ? 'descartado'
                  : null;
            if (estado && !TODOS) { decididos++; continue; }
            if (!estado) nuevos++;
            hits.push({ node, ap, estado, regula: VERBOS.test(ap.text) });
          }
        }
        if (node.children) walk(node.children);
      }
    };
    walk(law.structure);

    if (!hits.length) continue;

    const anual = law.temporality?.type === 'anual' ? `  [anual ${law.temporality.schoolYear}]` : '';
    lineas.push(`\n### ${law.slug}  (${law.territory}, ${law.vigpiracy.status})${anual}`);
    for (const h of hits) {
      const marca = h.estado ? `[${h.estado}] ` : h.regula ? '★ ' : '· ';
      const texto = h.ap.text.replace(/\s+/g, ' ').slice(0, 150);
      lineas.push(`  ${marca}${h.node.id}#${h.ap.path}  ${texto}`);
    }
  }

  return { nuevos, decididos, lineas };
}

const rutas = fichas();
const manuales = [];
let totalNuevos = 0, totalDecididos = 0;

for (const ruta of rutas) {
  const doc = JSON.parse(readFileSync(ruta, 'utf8'));

  // Sin términos no hay nada que cribar. Si además lo declara, se dice por qué.
  if (doc.triage?.mode === 'manual' || !(doc.terms || []).length) {
    manuales.push({ slug: doc.slug, reason: doc.triage?.reason || 'La ficha no declara `terms`.' });
    continue;
  }

  const { nuevos, decididos, lineas } = cribar(ruta);
  totalNuevos += nuevos;
  totalDecididos += decididos;

  if (rutas.length > 1) {
    if (!nuevos && !TODOS) continue;          // en modo masivo, callar lo que no pide nada
    console.log(`\n══════ ${doc.slug} ══════`);
  }
  for (const l of lineas) console.log(l);
  if (rutas.length > 1) console.log(`  → ${nuevos} candidatos sin decidir`);
}

console.log(`\n${totalNuevos} candidatos sin decidir` + (TODOS ? `, ${totalDecididos} ya decididos` : ''));
console.log('★ = el apartado parece regular el documento, no solo mencionarlo');

// El hueco se dice en voz alta: son las fichas que nadie va a cribar por ti.
if (manuales.length) {
  console.log(`\n⚠ ${manuales.length} ficha(s) en revisión manual — el cribado por términos no las cubre:`);
  for (const m of manuales) console.log(`  · ${m.slug}: ${m.reason}`);
}
