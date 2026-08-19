#!/usr/bin/env node

/**
 * Vuelve a sellar las referencias: recalcula el hash del texto citado y pone la
 * fecha de revisión a hoy.
 *
 *   node scripts/refs-refresh.mjs           informe de qué cambiaría
 *   node scripts/refs-refresh.mjs --write   aplica
 *
 * OJO: esto da por bueno el texto actual. Ejecutarlo solo DESPUÉS de mirar qué
 * ha cambiado y comprobar que la cita sigue diciendo lo que se quería citar;
 * si se lanza a ciegas, silencia justo el aviso que hace falta.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { findNode, currentContent, resolveApartado, resolveApartadoTree, hashText } from '../src/lib/refs-core.mjs';

const DATA = join(import.meta.dirname, '..', 'data');
const WRITE = process.argv.includes('--write');
const TODAY = new Date().toISOString().slice(0, 10);

const laws = {};
for (const lang of ['es', 'va']) {
  laws[lang] = new Map();
  const dir = join(DATA, 'laws', lang);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
    laws[lang].set(f.replace('.json', ''), JSON.parse(readFileSync(join(dir, f), 'utf8')));
  }
}

function textoDe(ref, lang) {
  const law = laws[lang].get(ref.law);
  if (!law) return null;
  const node = findNode(law.structure, ref.article);
  if (!node) return null;
  const content = currentContent(node);
  if (!ref.apartado) return content;
  const res = ref.subtree
    ? resolveApartadoTree(content, ref.apartado)
    : resolveApartado(content, ref.apartado);
  return res.ok ? res.text : null;
}

let cambiados = 0, rotos = 0, total = 0;
const fuentes = [join(DATA, 'notebooks'), join(DATA, 'center-docs'), join(DATA, 'organos')];

for (const dir of fuentes) for (const file of readdirSync(dir).filter(f => f.endsWith('.json')).sort()) {
  const path = join(dir, file);
  const nb = JSON.parse(readFileSync(path, 'utf8'));
  let tocado = false;

  for (const ref of nb.refs || []) {
    total++;
    const nuevo = {};
    let roto = false;

    for (const lang of ['es', 'va']) {
      const texto = textoDe(ref, lang);
      if (texto === null) { roto = true; continue; }
      nuevo[lang] = hashText(texto);
    }

    const donde = `${nb.slug}  ${ref.law}/${ref.article}${ref.apartado ? '#' + ref.apartado : ''}`;
    if (roto) {
      console.log(`  ✗ ${donde} — no resuelve, se deja como estaba`);
      rotos++;
      continue;
    }

    const antes = JSON.stringify(ref.hash || {});
    if (antes !== JSON.stringify(nuevo)) {
      console.log(`  ↻ ${donde}`);
      ref.hash = nuevo;
      ref.checkedAt = TODAY;
      cambiados++;
      tocado = true;
    }
  }

  if (tocado && WRITE) writeFileSync(path, JSON.stringify(nb, null, 2) + '\n');
}

console.log(`\n${total} referencias · ${cambiados} resselladas · ${rotos} sin resolver`);
if (!WRITE) console.log('(informe: añade --write para aplicar)');
