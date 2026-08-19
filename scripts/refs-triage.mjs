#!/usr/bin/env node

/**
 * Criba el corpus buscando qué apartados hablan de un documento de centro.
 *
 *   node scripts/refs-triage.mjs pec              candidatos nuevos
 *   node scripts/refs-triage.mjs pec --all        también los ya decididos
 *   node scripts/refs-triage.mjs pec --ley slug   solo una ley
 *
 * NO decide nada: propone. Cada candidato se acepta añadiéndolo a `refs` de la
 * ficha o se rechaza añadiéndolo a `discarded`, y lo que ya está decidido no
 * se vuelve a preguntar. Es el paso obligatorio de cada ingesta: así una ley
 * nueva no puede pasar sin que alguien mire si toca a algún documento.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseApartados, currentContent, normalizeText } from '../src/lib/refs-core.mjs';

const DATA = join(import.meta.dirname, '..', 'data');
const slug = process.argv[2];
const TODOS = process.argv.includes('--all');
const soloLey = process.argv.includes('--ley') ? process.argv[process.argv.indexOf('--ley') + 1] : null;

if (!slug) {
  console.error('Uso: node scripts/refs-triage.mjs <documento> [--all] [--ley slug]');
  process.exit(1);
}

// la ficha puede ser de documentos o de órganos: se busca en las dos carpetas
const rutaDoc = ['center-docs', 'organos']
  .map(c => join(DATA, c, slug + '.json'))
  .find(p => existsSync(p));
if (!rutaDoc) { console.error('No existe la ficha: ' + slug); process.exit(1); }
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

const terms = doc.terms.map(fold);

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

/**
 * ¿El apartado REGULA el documento o solo lo menciona de pasada?
 * Un artículo que dice «de acuerdo con el proyecto educativo» no explica nada
 * sobre el PEC; uno que dice «el proyecto educativo incluirá» sí.
 */
const VERBOS = /\b(elaborar[aá]?n?|elaboraci[oó]n|aprobar[aá]?n?|aprobaci[oó]n|incluir[aá]?n?|inclusi[oó]n|contendr[aá]n?|contener|recoger[aá]n?|recoge|comprender[aá]|definir[aá]|establecer[aá]|fijar[aá]|revisar[aá]|revisi[oó]n|modificar[aá]|publicidad|p[uú]blico|remitir[aá]|constituye|formar[aá] parte|se concreta|desarrollar[aá]|evaluar[aá]n?|informar[aá]|propuestas para la elaboraci[oó]n|elaborar|aprovar[aà]?n?|elaboraci[oó]|aprovaci[oó]|inclour[aà]|contindr[aà]|arreplegar[aà]|arreplega|establir[aà]|revisar[aà]|revisi[oó]|constituïx|constitueix|formar[aà] part|es concreta|desenvolupar[aà])\b/i;

const laws = [];
const dir = join(DATA, 'laws', 'es');
for (const f of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  laws.push(JSON.parse(readFileSync(join(dir, f), 'utf8')));
}

let nuevos = 0, decididos = 0;

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
  console.log(`\n### ${law.slug}  (${law.territory}, ${law.vigpiracy.status})${anual}`);
  for (const h of hits) {
    const marca = h.estado ? `[${h.estado}] ` : h.regula ? '★ ' : '· ';
    const texto = h.ap.text.replace(/\s+/g, ' ').slice(0, 150);
    console.log(`  ${marca}${h.node.id}#${h.ap.path}  ${texto}`);
  }
}

console.log(`\n${nuevos} candidatos sin decidir` + (TODOS ? `, ${decididos} ya decididos` : ''));
console.log('★ = el apartado parece regular el documento, no solo mencionarlo');
