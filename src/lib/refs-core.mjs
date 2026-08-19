/**
 * Núcleo de referencias con ancla.
 *
 * Una referencia apunta a un apartado concreto de un artículo (`art-121` + `2`)
 * y el texto se resuelve desde la ley en tiempo de compilación. Nunca se copia:
 * así una cita no puede quedarse petrificada cuando la ley cambia.
 *
 * JS puro a propósito, sin nada de Astro: lo importan igual el sitio (desde
 * refs.ts) y los scripts de Node (validate, migración, refresco de hashes).
 */

// ── Normalización ───────────────────────────────────────

/**
 * Texto comparable: quita la variación tipográfica que introduce cada
 * re-extracción de PDF (apóstrofes curvos, comillas, guiones largos) para que
 * solo dispare aviso un cambio real de redacción.
 * @param {string} s
 * @returns {string}
 */
export function normalizeText(s) {
  return (s || '')
    .normalize('NFC')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Hash corto y estable del texto ya normalizado (FNV-1a de 32 bits).
 * Sin dependencias: funciona igual en Node y en el navegador.
 * @param {string} s
 * @returns {string} 8 dígitos hex
 */
export function hashText(s) {
  const t = normalizeText(s);
  let h = 0x811c9dc5;
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Recorrido de la estructura ──────────────────────────

/**
 * @param {any[]} nodes
 * @param {string} id
 * @returns {any|undefined}
 */
export function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Texto vigente del nodo: si tiene versiones, la primera es la vigente.
 * @param {any} node
 * @returns {string}
 */
export function currentContent(node) {
  if (!node) return '';
  if (node.versions && node.versions.length) return node.versions[0].content || '';
  return node.content || '';
}

// ── Parseo de apartados ─────────────────────────────────

// Ordinales con los que las leyes modificadoras numeran sus modificaciones.
// Hacen falta los dos idiomas y las formas compuestas: la LOMLOE encadena más
// de ochenta, y en valenciano se escriben con guion («vint-i-u», «trenta-dos»).
const ORD_WORDS = [
  'uno', 'un', 'u', 'dos', 'tres', 'cuatro', 'quatre', 'cinco', 'cinc', 'seis', 'sis',
  'siete', 'set', 'ocho', 'vuit', 'huit', 'nueve', 'nou', 'diez', 'deu',
  'once', 'onze', 'doce', 'dotze', 'trece', 'tretze', 'catorce', 'catorze', 'quince', 'quinze',
  'dieciseis', 'dieciséis', 'setze', 'diecisiete', 'disset', 'dèsset', 'dísset',
  'dieciocho', 'divuit', 'díhuit', 'diecinueve', 'dinou', 'dènou', 'dénou',
  'veinte', 'vint', 'treinta', 'trenta', 'cuarenta', 'quaranta', 'cincuenta', 'cinquanta',
  'sesenta', 'seixanta', 'setenta', 'setanta', 'ochenta', 'vuitanta', 'huitanta',
  'noventa', 'noranta', 'cien', 'ciento', 'cent',
  'primera', 'segunda', 'segona', 'tercera', 'cuarta', 'quarta', 'quinta', 'cinquena',
  'sexta', 'sisena', 'septima', 'séptima', 'setena', 'octava', 'vuitena', 'novena',
  'decima', 'décima', 'desena', 'unica', 'única', 'únic'
].sort((a, b) => b.length - a.length);

const ORD_COMPOUND = [
  'veinti[a-záéíóúñ]+',
  'vint-i-[a-zàèéíòóúï]+',
  '(?:treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|ciento)\\s+y\\s+[a-záéíóú]+',
  '(?:trenta|quaranta|cinquanta|seixanta|setanta|vuitanta|huitanta|noranta)-[a-zàèéíòóúï]+'
];

const ORDINALS = ORD_COMPOUND.concat(ORD_WORDS).join('|');

/**
 * Valor numérico de cada ordinal, para que la ruta no dependa del idioma.
 * «Cuarta.» en castellano y «Quarta.» en valenciano son el mismo apartado, y
 * una referencia es neutra: si la clave fuera la palabra, resolvería en un
 * idioma y fallaría en el otro.
 */
const ORD_VALUES = {
  1: ['uno', 'un', 'u', 'primera', 'primer'],
  2: ['dos', 'segunda', 'segona', 'segon'],
  3: ['tres', 'tercera', 'tercer'],
  4: ['cuatro', 'quatre', 'cuarta', 'quarta'],
  5: ['cinco', 'cinc', 'quinta', 'cinquena'],
  6: ['seis', 'sis', 'sexta', 'sisena'],
  7: ['siete', 'set', 'septima', 'séptima', 'setena'],
  8: ['ocho', 'vuit', 'huit', 'octava', 'vuitena'],
  9: ['nueve', 'nou', 'novena'],
  10: ['diez', 'deu', 'decima', 'décima', 'desena'],
  11: ['once', 'onze'], 12: ['doce', 'dotze'], 13: ['trece', 'tretze'],
  14: ['catorce', 'catorze'], 15: ['quince', 'quinze'],
  16: ['dieciseis', 'dieciséis', 'setze'],
  17: ['diecisiete', 'disset', 'dèsset', 'dísset'],
  18: ['dieciocho', 'divuit', 'díhuit'],
  19: ['diecinueve', 'dinou', 'dènou', 'dénou'],
  20: ['veinte', 'vint'], 30: ['treinta', 'trenta'], 40: ['cuarenta', 'quaranta'],
  50: ['cincuenta', 'cinquanta'], 60: ['sesenta', 'seixanta'], 70: ['setenta', 'setanta'],
  80: ['ochenta', 'vuitanta', 'huitanta'], 90: ['noventa', 'noranta'], 100: ['cien', 'cent', 'ciento']
};

const ORD_MAP = new Map();
for (const [n, palabras] of Object.entries(ORD_VALUES)) {
  for (const w of palabras) ORD_MAP.set(w, n);
}

/**
 * Convierte un ordinal escrito en su número. Entiende las formas compuestas
 * («veintiuno», «vint-i-u», «treinta y dos», «trenta-dos»); si no reconoce
 * algo, devuelve la palabra tal cual, que es mejor que perder el apartado.
 */
function ordinalToNumber(palabra) {
  const w = palabra.toLowerCase().normalize('NFC');
  if (ORD_MAP.has(w)) return ORD_MAP.get(w);

  const compuesto = w.match(/^(?:veinti(\w+)|vint-i-([\w·]+)|(\w+)\s+y\s+(\w+)|(\w+)-([\w·]+))$/);
  if (compuesto) {
    const [decena, unidad] = compuesto[1] ? ['veinte', compuesto[1]]
      : compuesto[2] ? ['vint', compuesto[2]]
        : compuesto[3] ? [compuesto[3], compuesto[4]]
          : [compuesto[5], compuesto[6]];
    const d = ORD_MAP.get(decena), u = ORD_MAP.get(unidad);
    if (d && u) return String(Number(d) + Number(u));
  }
  return w;
}

const MARKERS = [
  { kind: 'num', re: new RegExp('^(\\d+(?:\\.\\d+)+)\\.?\\s+') },        // 7.1.1
  { kind: 'num', re: new RegExp('^(\\d+)\\.\\s+') },                     // 1.
  { kind: 'letter', re: new RegExp('^([a-zñç])\\)\\s+') },               // a)
  { kind: 'nparen', re: new RegExp('^(\\d+)\\)\\s+') },                  // 1)
  { kind: 'roman', re: new RegExp('^([IVXLC]+)\\.\\s+') },               // III.
  { kind: 'ordinal', re: new RegExp('^(' + ORDINALS + ')\\.\\s+', 'i') } // Uno.
];

/**
 * Marcador con el que abre un bloque, si lo tiene.
 * Se ignoran los asteriscos de negrita: en las resoluciones el marcador viene
 * dentro del encabezado (`**7.1.1 Evaluación final ...**`).
 * @param {string} block
 */
function blockMarker(block) {
  const bare = block.replace(/^\*+/, '').trimStart();
  for (const { kind, re } of MARKERS) {
    const m = bare.match(re);
    if (m) return { kind, key: kind === 'ordinal' ? ordinalToNumber(m[1]) : m[1] };
  }
  return null;
}

/**
 * @typedef {Object} Apartado
 * @property {string} key   Clave del marcador: "2", "k", "7.1.1"
 * @property {string} path  Ruta jerárquica: "2", "1.k", "5.a.2"
 * @property {string} text  Texto del apartado, con sus párrafos de continuación
 */

/**
 * Parte el contenido de un artículo en sus apartados.
 *
 * Reglas de anidación, sacadas de cómo son de verdad los textos del corpus:
 * - Las letras cuelgan del apartado numérico que las precede (`1.k`).
 * - Un numérico que no continúa la serie (no es el anterior + 1) y aparece
 *   dentro de una letra es un sub-ítem de esa letra, no un apartado nuevo.
 *   Es el caso del art. 9 del D.156/2007, donde las pruebas de acceso llevan
 *   listas numeradas dentro de cada letra.
 * - Los bloques sin marcador continúan el apartado anterior.
 *
 * @param {string} content
 * @returns {Apartado[]}
 */
export function parseApartados(content) {
  const blocks = (content || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
  /** @type {Apartado[]} */
  const out = [];
  let scope = null;        // encabezado en negrita bajo el que vamos
  let topNumPath = null;   // último apartado numérico de primer nivel
  let lastTopNum = 0;      // su número, para saber si la serie continúa
  let letterPath = null;   // última letra abierta
  let subNum = null;       // sublista numérica abierta dentro de una letra
  const used = new Map();  // rutas ya emitidas, para desambiguar duplicados

  const withScope = key => (scope ? scope + '.' + key : key);

  for (const block of blocks) {
    const marker = blockMarker(block);

    // Encabezado en negrita sin marcador: abre ámbito y reinicia la numeración.
    // Los anexos de currículo repiten «1, 2, 3» bajo Objetivos, Contenidos y
    // Criterios de evaluación; sin esto, las tres series chocarían entre sí.
    if (!marker) {
      const heading = block.match(/^\*\*(.+?)\*\*$/s);
      if (heading) {
        scope = slugify(heading[1]);
        topNumPath = null;
        letterPath = null;
        subNum = null;
        lastTopNum = 0;
        out.push({ key: scope, path: register(used, scope), text: block });
        continue;
      }
      // Texto sin marcador antes de cualquier apartado: es la cabecera del
      // artículo («El Consejo Escolar tendrá las competencias siguientes:») o
      // el artículo entero cuando no lleva apartados. Se ancla como «0».
      // Si se descartara, el 43 % del corpus quedaría fuera del cribado.
      if (!out.length) {
        out.push({ key: '0', path: register(used, '0'), text: block });
        continue;
      }
      out[out.length - 1].text += '\n\n' + block;
      continue;
    }

    let path;
    if (marker.kind === 'num' && !marker.key.includes('.')) {
      const n = parseInt(marker.key, 10);
      // Una sublista dentro de una letra siempre arranca en 1 y sigue de uno en
      // uno; cualquier otra cosa es un apartado de primer nivel, aunque repita
      // número (el art. 52 del D.57/2020 numera dos apartados como 5).
      if (letterPath && n === 1) {
        subNum = 1;
        path = letterPath + '.1';
      } else if (letterPath && subNum !== null && n === subNum + 1) {
        subNum = n;
        path = letterPath + '.' + marker.key;
      } else {
        path = withScope(marker.key);
        topNumPath = path;
        lastTopNum = n;
        letterPath = null;
        subNum = null;
      }
    } else if (marker.kind === 'letter') {
      path = topNumPath ? topNumPath + '.' + marker.key : withScope(marker.key);
      letterPath = path;
      subNum = null;
    } else if (marker.kind === 'nparen') {
      // Las listas «1)» cuelgan de la letra abierta, no del apartado numérico:
      // así es como el D.57/2020 desglosa la programación didáctica en 5.b.
      const base = letterPath || topNumPath;
      path = base ? base + '.' + marker.key : withScope(marker.key);
    } else {
      // Ordinales y romanos abren ámbito propio: en una ley modificadora, cada
      // «Uno.», «Dos.»… reproduce un artículo ajeno con su propia numeración,
      // y sin esto los apartados de todos ellos chocarían entre sí.
      path = marker.key;
      scope = marker.key;
      topNumPath = null;
      letterPath = null;
      subNum = null;
      lastTopNum = 0;
    }

    out.push({ key: marker.key, path: register(used, path), text: block });
  }

  return out;
}

/** Convierte un encabezado en una clave de ruta estable y legible. */
function slugify(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Si la ley repite una ruta, no la escondemos: la segunda aparición se ancla
 * como «5~2» y validate avisa de la duplicidad.
 */
function register(used, path) {
  const seen = (used.get(path) || 0) + 1;
  used.set(path, seen);
  return seen > 1 ? path + '~' + seen : path;
}

/**
 * Resuelve una ruta de apartado dentro de un artículo.
 *
 * Acepta la ruta completa (`1.k`) o solo la última clave (`k`) cuando no hay
 * ambigüedad. Si la hay, falla y dice cuáles son las candidatas: es preferible
 * romper el build a servir el apartado equivocado.
 *
 * @param {string} content
 * @param {string} path
 * @returns {{ok: true, text: string, path: string} | {ok: false, reason: string, candidates: string[]}}
 */
export function resolveApartado(content, path) {
  const apartados = parseApartados(content);
  const wanted = String(path).trim();

  const exact = apartados.filter(a => a.path === wanted);
  if (exact.length === 1) return { ok: true, text: exact[0].text, path: exact[0].path };

  const bySuffix = apartados.filter(a => a.key === wanted || a.path.endsWith('.' + wanted));
  if (bySuffix.length === 1) return { ok: true, text: bySuffix[0].text, path: bySuffix[0].path };
  if (bySuffix.length > 1) {
    return { ok: false, reason: 'ambiguo', candidates: bySuffix.map(a => a.path) };
  }

  return { ok: false, reason: 'no-existe', candidates: apartados.map(a => a.path) };
}

/**
 * Como resolveApartado, pero arrastra los sub-apartados que cuelgan de la ruta.
 *
 * Citar «1.2.2.1» a secas devuelve solo su encabezado, y las letras que lo
 * desarrollan quedarían fuera. Es opcional (`subtree` en la referencia) y no
 * automático: hay casos en que se quiere el apartado a pelo y no su desarrollo.
 *
 * @param {string} content
 * @param {string} path
 */
export function resolveApartadoTree(content, path) {
  const raiz = resolveApartado(content, path);
  if (!raiz.ok) return raiz;

  const apartados = parseApartados(content);
  const desde = apartados.findIndex(a => a.path === raiz.path);
  const trozos = [apartados[desde].text];

  for (let i = desde + 1; i < apartados.length; i++) {
    if (!apartados[i].path.startsWith(raiz.path + '.')) break;
    trozos.push(apartados[i].text);
  }

  return { ok: true, text: trozos.join('\n\n'), path: raiz.path };
}

// ── Frescura ────────────────────────────────────────────

/** Orden de gravedad, de menos a más. */
export const FRESHNESS_ORDER = ['ok', 'caducado', 'revisar', 'derogado', 'roto'];

/**
 * @param {string} a
 * @param {string} b
 */
export function worstFreshness(a, b) {
  return FRESHNESS_ORDER.indexOf(a) >= FRESHNESS_ORDER.indexOf(b) ? a : b;
}

/**
 * Estado de una referencia: si sigue apuntando a lo que apuntaba.
 *
 * No inventa señales: todas salen de datos que ya están en los JSON de ley
 * (vigencia, afectaciones posteriores, versiones del artículo, caducidad de lo
 * anual) más el hash del texto guardado al curarla.
 *
 * @param {Object} p
 * @param {any} p.law
 * @param {any} p.node
 * @param {{checkedAt?: string, hash?: Record<string,string>, article: string, apartado?: string}} p.ref
 * @param {string} p.lang
 * @param {string} [p.resolvedText]  Texto ya resuelto, si se pudo resolver
 * @param {string} [p.today]         Fecha ISO; por defecto, hoy
 * @returns {{level: string, reasons: {code: string, detail?: string}[]}}
 */
export function refFreshness({ law, node, ref, lang, resolvedText, today }) {
  /** @type {{code: string, detail?: string}[]} */
  const reasons = [];
  let level = 'ok';
  const now = today || new Date().toISOString().slice(0, 10);
  const checkedAt = ref.checkedAt || '';

  if (resolvedText === undefined || resolvedText === null) {
    reasons.push({ code: 'ancla-rota' });
    return { level: 'roto', reasons };
  }

  const storedHash = ref.hash && ref.hash[lang];
  if (storedHash && storedHash !== hashText(resolvedText)) {
    reasons.push({ code: 'texto-cambiado' });
    level = worstFreshness(level, 'revisar');
  }

  const status = law?.vigpiracy?.status;
  if (status === 'derogada') {
    reasons.push({ code: 'ley-derogada' });
    level = worstFreshness(level, 'derogado');
  }

  const newest = node?.versions?.[0];
  if (newest && newest.effectiveDate && checkedAt && newest.effectiveDate > checkedAt) {
    reasons.push({ code: 'articulo-modificado', detail: newest.modifiedBy?.title || newest.effectiveDate });
    level = worstFreshness(level, 'revisar');
  }

  for (const aff of law?.legalAnalysis?.posteriorAffectations || []) {
    const touches = (aff.articles || []).includes(ref.article);
    if (!touches) continue;
    if (checkedAt && aff.date && aff.date <= checkedAt) continue;
    reasons.push({ code: aff.type === 'deroga' ? 'articulo-derogado' : 'articulo-afectado', detail: aff.title });
    level = worstFreshness(level, aff.type === 'deroga' ? 'derogado' : 'revisar');
  }

  const temp = law?.temporality;
  if (temp?.type === 'anual' && temp.expiresDate && temp.expiresDate <= now) {
    reasons.push({ code: 'curso-caducado', detail: temp.schoolYear });
    level = worstFreshness(level, 'caducado');
  }

  return { level, reasons };
}
