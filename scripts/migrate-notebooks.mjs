#!/usr/bin/env node

/**
 * Migra los cuadernos de texto copiado (`excerpt`) a referencias con ancla.
 *
 *   node scripts/migrate-notebooks.mjs           informe, no toca nada
 *   node scripts/migrate-notebooks.mjs --write   reescribe data/notebooks/
 *
 * Cada excerpt se alinea contra los apartados del artículo: se busca el tramo
 * contiguo de apartados que mejor reproduce el texto guardado. Lo que no
 * alcanza el umbral no se migra a ciegas, se lista para decidirlo a mano.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseApartados, currentContent, findNode, normalizeText, hashText } from '../src/lib/refs-core.mjs';

const NOTEBOOKS = join(import.meta.dirname, '..', 'data', 'notebooks');
const LAWS = join(import.meta.dirname, '..', 'data', 'laws');
const WRITE = process.argv.includes('--write');
const UMBRAL = 0.86;
const TODAY = new Date().toISOString().slice(0, 10);

const lawCache = new Map();
function getLaw(slug, lang) {
  const key = slug + '/' + lang;
  if (!lawCache.has(key)) {
    try {
      lawCache.set(key, JSON.parse(readFileSync(join(LAWS, lang, slug + '.json'), 'utf8')));
    } catch {
      lawCache.set(key, null);
    }
  }
  return lawCache.get(key);
}

/** Coeficiente de Dice sobre bigramas: tolera deriva tipográfica, no reescrituras. */
function similar(a, b) {
  const bigrams = s => {
    const t = normalizeText(s).toLowerCase();
    const set = new Map();
    for (let i = 0; i < t.length - 1; i++) {
      const g = t.slice(i, i + 2);
      set.set(g, (set.get(g) || 0) + 1);
    }
    return set;
  };
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) || 0);
  let total = 0;
  for (const n of A.values()) total += n;
  for (const n of B.values()) total += n;
  return (2 * inter) / total;
}

/**
 * Puntúa un tramo de apartados contra el excerpt.
 *
 * Si el excerpt está contenido literalmente en el tramo, es una cita parcial de
 * ese apartado y vale como coincidencia plena: Dice penaliza la diferencia de
 * longitud y dejaría fuera media docena de citas correctas. Se marca `amplia`
 * porque la ficha pasará a mostrar el apartado entero, más texto que antes.
 */
function puntuar(tramo, excerpt) {
  const a = normalizeText(tramo).toLowerCase();
  // Los cuadernos cierran la cita con un punto aunque el apartado siga: se
  // quita la puntuación final antes de comprobar si está contenida.
  const b = normalizeText(excerpt).toLowerCase().replace(/[\s.,;:]+$/, '');
  if (b.length > 40 && a.includes(b)) return { score: 1, amplia: a.length > b.length * 1.15 };
  return { score: similar(tramo, excerpt), amplia: false };
}

/**
 * Busca el tramo contiguo de apartados que mejor reproduce el excerpt.
 * @returns {{paths: string[], score: number, text: string, amplia: boolean}|null}
 */
function alinear(apartados, excerpt) {
  if (!apartados.length) return null;
  let best = null;
  for (let i = 0; i < apartados.length; i++) {
    let acc = '';
    for (let j = i; j < Math.min(i + 6, apartados.length); j++) {
      acc = acc ? acc + '\n\n' + apartados[j].text : apartados[j].text;
      const { score, amplia } = puntuar(acc, excerpt);
      const largo = j - i + 1;
      // A igual puntuación gana el tramo más corto: si la cita cabe entera en un
      // apartado, ese es el ancla, no la ristra de seis que también lo contiene.
      const mejora = !best || score > best.score + 1e-9 ||
        (Math.abs(score - best.score) < 1e-9 && largo < best.largo);
      if (mejora) {
        best = { paths: apartados.slice(i, j + 1).map(a => a.path), score, text: acc, amplia, largo };
      }
    }
  }
  return best;
}

/**
 * Trocea un excerpt por sus propios marcadores. Muchas citas de los cuadernos
 * saltan de la letra d) a la j) sin pasar por las de en medio: como tramo
 * contiguo no alinean, pero pieza a pieza son exactas.
 */
function trocear(excerpt) {
  const marcador = '(?:\\d+\\.\\s|[a-zñç]\\)\\s|\\d+\\)\\s)';
  const re = new RegExp('(?:\\n+|(?<=[.:»)])\\s)(?=' + marcador + ')', 'g');
  // Los propios cuadernos marcan el salto entre apartados con «[...]»: es un
  // corte explícito y vale más que cualquier heurística.
  return excerpt
    .split(/\s*\[\.\.\.\]\s*/)
    .flatMap(t => t.split(re))
    .map(t => t.trim())
    .filter(Boolean);
}

/** Alinea pieza a pieza, permitiendo apartados no contiguos. */
function alinearPiezas(apartados, excerpt) {
  const piezas = trocear(excerpt);
  if (piezas.length < 2) return null;
  const paths = [];
  let peor = 1;
  let amplia = false;
  for (const pieza of piezas) {
    const m = alinear(apartados, pieza);
    if (!m) return null;
    peor = Math.min(peor, m.score);
    amplia = amplia || m.amplia;
    for (const p of m.paths) if (!paths.includes(p)) paths.push(p);
  }
  return { paths, score: peor, amplia };
}

/**
 * Reanclajes decididos a mano.
 *
 * La Orden 32/2011 se reingestó desde otra fuente y su texto se movió de sitio:
 * lo que el cuaderno guardó como art-4 está hoy en el art. 3.4 literalmente, y
 * lo que guardó como art-3 se reescribió y hoy es el art. 3.1 (mismo derecho,
 * otra redacción: cita el Decreto 39/2008 y dice «rendimiento escolar»).
 * Es justo el fallo que este cambio viene a evitar, y queda anotado aquí en vez
 * de arreglarse en silencio.
 */
const REANCLAJES = {
  'orden-32-2011/art-3': { article: 'art-3', apartado: '1' },
  'orden-32-2011/art-4': { article: 'art-3', apartado: '4' }
};

const informe = { migrados: 0, completos: 0, dudosos: [], rotos: [], ampliados: [] };
const salida = [];

for (const file of readdirSync(NOTEBOOKS).filter(f => f.endsWith('.json')).sort()) {
  const nb = JSON.parse(readFileSync(join(NOTEBOOKS, file), 'utf8'));
  const refs = [];
  console.log('\n### ' + nb.slug);

  for (const fr of nb.fragments) {
    const esLaw = getLaw(fr.lawSlug, 'es');
    const vaLaw = getLaw(fr.lawSlug, 'va');
    const esNode = esLaw && findNode(esLaw.structure, fr.articleId);
    const vaNode = vaLaw && findNode(vaLaw.structure, fr.articleId);

    if (!esNode || !vaNode) {
      informe.rotos.push([nb.slug, fr.lawSlug, fr.articleId, 'artículo inexistente en ' + (!esNode ? 'es' : 'va')]);
      console.log('  ✗ ' + fr.lawSlug + '/' + fr.articleId + ' — artículo inexistente');
      continue;
    }

    // Sin excerpt: la referencia es el artículo entero, se migra sin más.
    if (!fr.excerpt) {
      refs.push(conHash({ law: fr.lawSlug, article: fr.articleId }, esNode, vaNode));
      informe.completos++;
      console.log('  · ' + fr.lawSlug + '/' + fr.articleId + ' — artículo completo');
      continue;
    }

    const excEs = typeof fr.excerpt === 'string' ? fr.excerpt : fr.excerpt.es;
    const excVa = typeof fr.excerpt === 'string' ? fr.excerpt : fr.excerpt.va;
    const apEs = parseApartados(currentContent(esNode));
    const apVa = parseApartados(currentContent(vaNode));
    const mEs = alinear(apEs, excEs);
    const mVa = excVa ? alinear(apVa, excVa) : null;

    const scoreVa = mVa ? mVa.score : 0;
    const coinciden = mVa && mEs && mEs.paths.join() === mVa.paths.join();

    let mejor = mEs;
    if (!mejor || mejor.score < UMBRAL) {
      const porPiezas = alinearPiezas(apEs, excEs);
      if (porPiezas && porPiezas.score >= UMBRAL) mejor = porPiezas;
    }

    const reancla = REANCLAJES[fr.lawSlug + '/' + fr.articleId];
    if ((!mejor || mejor.score < UMBRAL) && reancla) {
      const destinoEs = findNode(esLaw.structure, reancla.article);
      const destinoVa = findNode(vaLaw.structure, reancla.article);
      refs.push(conHash({ law: fr.lawSlug, article: reancla.article, apartado: reancla.apartado }, destinoEs, destinoVa));
      informe.migrados++;
      console.log('  ↻ ' + fr.lawSlug + '/' + fr.articleId + ' → reanclado a ' +
        reancla.article + ' [' + reancla.apartado + '] (decisión manual)');
      continue;
    }

    if (!mejor || mejor.score < UMBRAL) {
      informe.dudosos.push([nb.slug, fr.lawSlug, fr.articleId, mejor ? mejor.score : 0, mejor ? mejor.paths.join(',') : '—']);
      console.log('  ? ' + fr.lawSlug + '/' + fr.articleId + ' — mejor coincidencia ' +
        (mejor ? mejor.paths.join(',') + ' al ' + (mejor.score * 100).toFixed(0) + '%' : 'ninguna') + ' — SIN MIGRAR');
      continue;
    }

    for (const path of mejor.paths) {
      refs.push(conHash({ law: fr.lawSlug, article: fr.articleId, apartado: path }, esNode, vaNode));
    }
    informe.migrados++;
    if (mejor.amplia) informe.ampliados.push([nb.slug, fr.lawSlug, fr.articleId, mejor.paths.join(',')]);
    const avisoVa = coinciden ? '' : '   ⚠ va→' + (mVa ? mVa.paths.join(',') + ' ' + (scoreVa * 100).toFixed(0) + '%' : 'sin coincidencia');
    console.log('  ✓ ' + fr.lawSlug + '/' + fr.articleId + ' → ' + mejor.paths.join(', ') +
      ' (' + (mejor.score * 100).toFixed(0) + '%)' + avisoVa);
  }

  salida.push([file, {
    id: nb.id,
    slug: nb.slug,
    title: nb.title,
    description: nb.description,
    updatedAt: nb.updatedAt,
    refs
  }]);
}

/** Añade fecha de revisión y hash del texto resuelto en cada idioma. */
function conHash(ref, esNode, vaNode) {
  const texto = (node) => {
    const content = currentContent(node);
    if (!ref.apartado) return content;
    const ap = parseApartados(content).find(a => a.path === ref.apartado);
    return ap ? ap.text : null;
  };
  const es = texto(esNode), va = texto(vaNode);
  const hash = {};
  if (es) hash.es = hashText(es);
  if (va) hash.va = hashText(va);
  return { ...ref, checkedAt: TODAY, hash };
}

console.log('\n── Resumen ──────────────────────────────');
console.log('  Migrados con ancla de apartado: ' + informe.migrados);
console.log('  Migrados como artículo entero:  ' + informe.completos);
console.log('  Sin migrar (por debajo del ' + (UMBRAL * 100) + '%): ' + informe.dudosos.length);
console.log('  Rotos (artículo inexistente):   ' + informe.rotos.length);

if (informe.ampliados.length) {
  console.log('\nCitas que pasan a mostrar el apartado entero (antes era un recorte):');
  for (const [nb, law, art, paths] of informe.ampliados) console.log('  ' + nb + '  ' + law + '/' + art + ' → ' + paths);
}

if (informe.dudosos.length) {
  console.log('\nPendientes de decidir a mano:');
  for (const [nb, law, art, score, paths] of informe.dudosos) {
    console.log('  ' + nb + '  ' + law + '/' + art + '  mejor: ' + paths + ' (' + (score * 100).toFixed(0) + '%)');
  }
}

if (WRITE) {
  for (const [file, nb] of salida) {
    writeFileSync(join(NOTEBOOKS, file), JSON.stringify(nb, null, 2) + '\n');
  }
  console.log('\nEscritos ' + salida.length + ' cuadernos.');
} else {
  console.log('\n(informe: no se ha tocado nada; añade --write para aplicar)');
}
