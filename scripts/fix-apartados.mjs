#!/usr/bin/env node

/**
 * Repara artículos cuyos apartados quedaron pegados en un solo párrafo.
 *
 *   node scripts/fix-apartados.mjs            informe
 *   node scripts/fix-apartados.mjs --write    aplica
 *
 * Es un defecto conocido de ingesta (lo avisa CLAUDE.md): sin `\n\n` entre
 * apartados no se pueden anclar citas y el texto se lee peor en la web.
 *
 * El corte es conservador a propósito: solo parte donde aparece el marcador
 * que TOCA en la serie —tras «a)» busca «b)», tras «1.» busca «2.»— así que
 * una referencia interna como «el artículo 5. La evaluación…» no se rompe,
 * porque 5 no es el número que sigue.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const LAWS = join(import.meta.dirname, '..', 'data', 'laws');
const WRITE = process.argv.includes('--write');

const LETRAS = 'abcdefghijklmnñopqrstuvwxyz';

/** Siguiente marcador de cada serie a partir del último visto. */
function siguientes(ultimaLetra, ultimoNumero) {
  const out = [];
  if (ultimaLetra) {
    const i = LETRAS.indexOf(ultimaLetra);
    if (i >= 0 && i + 1 < LETRAS.length) out.push({ tipo: 'letra', token: LETRAS[i + 1] + ')' });
    // Unas normas usan la ñ en la serie de letras y otras la saltan, así que
    // tras la n hay que buscar tanto «ñ)» como «o)».
    if (LETRAS[i + 1] === 'ñ' && i + 2 < LETRAS.length) out.push({ tipo: 'letra', token: LETRAS[i + 2] + ')' });
  } else {
    out.push({ tipo: 'letra', token: 'a)' });
  }
  out.push({ tipo: 'num', token: (ultimoNumero + 1) + '.' });
  return out;
}

/**
 * Parte un bloque en sus apartados siguiendo la serie.
 * @returns {string|null} bloque reparado, o null si no hay nada que partir
 */
export function repararBloque(bloque) {
  const inicio = bloque.match(/^\s*(?:\*\*)?([a-zñç])\)\s|^\s*(?:\*\*)?(\d+)\.\s/);
  let ultimaLetra = inicio && inicio[1] ? inicio[1] : null;
  let ultimoNumero = inicio && inicio[2] ? parseInt(inicio[2], 10) : 0;

  let texto = bloque;
  let pos = inicio ? inicio[0].length : 0;
  let cortes = 0;

  for (;;) {
    let mejor = null;
    for (const cand of siguientes(ultimaLetra, ultimoNumero)) {
      // el marcador tiene que ir tras final de frase y abrir mayúscula o comilla
      const re = new RegExp('(?<=[.:»)])\\s(' + cand.token.replace(/[.)]/g, '\\$&') +
        ')\\s(?=[«"A-ZÁÉÍÓÚÑÀÈÌÒÙ])', 'g');
      re.lastIndex = pos;
      const m = re.exec(texto);
      if (m && (!mejor || m.index < mejor.m.index)) mejor = { m, cand };
    }
    if (!mejor) break;

    const at = mejor.m.index;
    texto = texto.slice(0, at) + '\n\n' + texto.slice(at + 1);
    pos = at + 2 + mejor.m[0].length;
    cortes++;
    if (mejor.cand.tipo === 'letra') ultimaLetra = mejor.cand.token[0];
    else { ultimoNumero = parseInt(mejor.cand.token, 10); ultimaLetra = null; }
  }

  return cortes ? texto : null;
}

export function repararContenido(content) {
  const bloques = content.split(/\n{2,}/);
  let tocado = false;
  const salida = bloques.map(b => {
    const r = repararBloque(b);
    if (r) { tocado = true; return r; }
    return b;
  });
  return tocado ? salida.join('\n\n') : null;
}

const ES_CLI = process.argv[1] && process.argv[1].endsWith('fix-apartados.mjs');

let nodos = 0, cortes = 0;

if (ES_CLI) for (const lang of ['es', 'va']) {
  const dir = join(LAWS, lang);
  for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
    const path = join(dir, file);
    const law = JSON.parse(readFileSync(path, 'utf8'));
    let tocada = false;

    const walk = nodes => {
      for (const n of nodes) {
        for (const campo of ['content']) {
          if (typeof n[campo] === 'string') {
            const r = repararContenido(n[campo]);
            if (r) {
              const n_cortes = (r.match(/\n\n/g) || []).length - (n[campo].match(/\n\n/g) || []).length;
              console.log(`  ${lang}/${law.slug}/${n.id}: +${n_cortes} párrafos`);
              n[campo] = r; tocada = true; nodos++; cortes += n_cortes;
            }
          }
        }
        for (const v of n.versions || []) {
          const r = typeof v.content === 'string' ? repararContenido(v.content) : null;
          if (r) { v.content = r; tocada = true; }
        }
        if (n.children) walk(n.children);
      }
    };
    walk(law.structure);

    if (tocada && WRITE) writeFileSync(path, JSON.stringify(law, null, 2) + '\n');
  }
}

if (ES_CLI) {
  console.log(`\n${nodos} nodos reparados, ${cortes} párrafos nuevos.`);
  if (!WRITE) console.log('(informe: añade --write para aplicar)');
}
