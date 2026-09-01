# Instrucciones para Claude Code - Legis CPM

## Qué es este proyecto
Lector de legislación de Conservatorios Profesionales de Música y Danza **y de Escuelas de enseñanza artística no formal (Música y Artes Escénicas)** de la Generalitat Valenciana. Sitio estático con Astro 6.x desplegado en GitHub Pages. Datos en JSON bilingüe (es/va). El proyecto se llama **Legis CPMDEM** (los textos de marca ya incluyen las Escuelas de Música).

## Documentación
Leer antes de hacer cambios: `docs/CONTENT-GUIDE.md` (proceso de ingesta), `docs/DATA-SCHEMA.md` (esquema JSON), `src/lib/types.ts` (tipos TypeScript).

## Ingesta de leyes desde PDF del DOGV

### Comando del usuario
Cuando el usuario diga algo como **"Ingesta esta ley: [URL del PDF]"** o **"Añade este decreto: [URL]"**, seguir este proceso:

### Proceso paso a paso

#### 1. Descargar y extraer texto
```bash
# PDFs del DOGV pueden ser:
# A) Dos columnas (va izquierda, es derecha) - decretos antiguos
# B) PDFs separados por idioma (_es.pdf / _va.pdf) - decretos recientes
```

**Opción A: `pdftotext` (poppler)** — si está instalado:
```bash
# Para PDF de dos columnas:
pdftotext -layout -x 290 -y 0 -W 310 -H 842 "$PDF" /tmp/ley-es.txt  # columna derecha = ES
pdftotext -layout -x 0 -y 0 -W 305 -H 842 "$PDF" /tmp/ley-va.txt    # columna izquierda = VA

# Para PDFs separados:
pdftotext -layout "$PDF_ES" /tmp/ley-es.txt
pdftotext -layout "$PDF_VA" /tmp/ley-va.txt
```

**Opción B: `pdfplumber` (Python)** — alternativa si `pdftotext` no está disponible:
```python
import pdfplumber
with pdfplumber.open(pdf_path) as pdf:
    pw = pdf.pages[0].width
    mid = pw / 2
    for page in pdf.pages:
        right = page.crop((mid, 0, pw, page.height))  # ES
        left = page.crop((0, 0, mid, page.height))     # VA
        es_text = right.extract_text() or ""
        va_text = left.extract_text() or ""
```
`pdfplumber` suele estar disponible en el entorno aunque `pdftotext` no. Verificar con `python3 -c "import pdfplumber"` antes de empezar.

**⚠️ Preservación de párrafos (CRÍTICO):**
`extract_text()` de pdfplumber une todas las líneas de la columna con `\n` simple — NO distingue saltos de línea dentro de un párrafo de puntos y aparte reales. Si se usa `extract_text()` directamente y luego se unen líneas, el resultado es un bloque sin párrafos.

Para preservar los puntos y aparte, usar `region.chars` y detectar **sangrado** (indentation):
```python
from collections import Counter
chars = region.chars
# Agrupar chars por línea (misma coordenada top)
# Encontrar baseline x0 (el x0 más común entre todas las líneas)
# Línea con indent > 10pts sobre baseline = inicio de nuevo párrafo → insertar \n\n
```
- Baseline típico en DOGV: indent ≈ 8-9 pts desde el borde de columna
- Sangrado de párrafo: indent ≈ 22-23 pts (diferencia de ~14 pts)
- Títulos/encabezados: indent > 35 pts (no confundir con sangrado de párrafo)

#### 2. Analizar estructura
```bash
# Buscar artículos, capítulos, disposiciones, anexos, cláusula de promulgación
grep -n "^Artículo\|^\s*Artículo\|^Articulo\|^CAPÍTULO\|^DISPOSICION\|^ANEXO" /tmp/ley-es.txt
# Buscar cláusula de promulgación (lugar, fecha y firmantes)
grep -n "Valencia,\|València,\|San Vicente\|Sant Vicent" /tmp/ley-es.txt
```

#### 3. Generar JSON con script Python
Usar un script Python que:
- Parsee los artículos del texto extraído
- Extraiga la **cláusula de promulgación** (lugar, fecha, firmantes con nombre y cargo)
- Genere `data/laws/es/{slug}.json` y `data/laws/va/{slug}.json`
- Incluya el campo `promulgation` con `place`, `date` y `signatories[]`
- Siga el esquema de `src/lib/types.ts`

#### 4. Validar y compilar
```bash
npm run validate  # 0 errores obligatorio, avisos OK para leyes no ingresadas
npm run build     # debe compilar sin errores
```

Si la norma cita direcciones web en el texto, comprobar además que resuelven —
ver «URLs escritas dentro del articulado» en errores conocidos.

#### 5. Actualizar cross-references si la ley modifica otras
- Añadir `posteriorAffectations` en las leyes modificadas
- **CREAR VERSIONES** en los artículos afectados (array `versions`)
- Actualizar `lastModifiedDate` en `vigpiracy`
- Actualizar `data/metadata/law-registry.json`

#### 6. ⚠️ Cribar la ley nueva contra las fichas

**Paso obligatorio de toda ingesta.** El cribado cubre **tres** carpetas, no
una: `data/center-docs/` (documentos), `data/organos/` (órganos y cargos) y
`data/notebooks/` (cuadernos). Un solo comando las recorre todas:

```bash
node scripts/refs-triage.mjs --todas --ley <slug-de-la-ley-nueva>
```

Para una ficha suelta, su slug en vez de `--todas`:

```bash
node scripts/refs-triage.mjs pec --ley <slug-de-la-ley-nueva>
```

Lista los apartados de esa ley que hablan del documento y que aún no están
decididos. Cada candidato acaba en uno de dos sitios de la ficha: en `refs` si
regula el documento, o en `discarded` con su motivo si es mención de pasada.
Lo ya decidido no se vuelve a preguntar, así que el cribado no se repite.

Criterio de corte: entra lo que **regula** el documento —qué contiene, quién lo
elabora, quién lo aprueba, qué obligación impone— y no lo que solo lo nombra
(«de acuerdo con el proyecto educativo»). Ante la duda, descartar y anotar por
qué: un descarte razonado se revisa fácil, una ficha inflada no se lee.

Regla de separación entre fichas: **si tienen nombre distinto son documentos
distintos**, aunque uno viva dentro de otro. El PEC, la PGA y el Plan de Mejora
son tres fichas, no una. (Y en conservatorios el documento se llama **Plan de
Mejora**: el PAM es otra cosa, de los centros de régimen general.)

**Fichas que no se criban por términos.** Algunas no se definen por una
palabra sino por un tramo de articulado («los arts. 15-24 de la Ley 40/2015»)
o por un tema difuso. Buscarlas por término da mucho ruido y, peor, pierde
apartados que las regulan sin nombrarlas. Esas declaran en su JSON:

```json
"triage": { "mode": "manual", "reason": "…por qué el término no sirve…" }
```

`--todas` las lista al final, con su motivo, en vez de callárselas: el hueco
queda dicho para que alguien lo mire a mano. Hoy son tres cuadernos
(`organos-colegiados`, `evaluacion-equipo-docente`, `distribucion-horaria`).
Antes de poner `terms` a una ficha nueva, medir el **recall**: si el cribado no
reencuentra las refs que ya tiene, no sirve de red y va a manual.

Tras tocar una ficha: `npm run validate` y `npm run refs:refresh` si procede.

#### 6 bis. ⚠️ Revisar las referencias con ancla que apunten a lo que has tocado

`npm run validate` comprueba todas las referencias de `data/notebooks/`,
`data/center-docs/` y `data/organos/` contra las leyes:

- **Error** si un ancla ya no resuelve: el apartado citado ha desaparecido o se
  ha renumerado. Rompe el build a propósito.
- **Aviso** si el texto citado ha cambiado, si el artículo tiene versión nueva,
  si le afecta una norma posterior o si venció el curso de una norma anual.

Ante un aviso: abrir la cita, comprobar que sigue diciendo lo que se quería
citar y solo entonces `npm run refs:refresh` para volver a sellarla. Lanzarlo
sin mirar silencia justo el aviso que hacía falta.

Si la ley nueva llega con los apartados pegados en un solo párrafo (defecto
recurrente de extracción), `npm run fix:apartados` los separa: solo corta donde
continúa la serie esperada, así que no rompe referencias internas del tipo
«el artículo 5. La evaluación…».

#### 7. ⚠️ Comprobar si la ley alimenta un dataset externo (NO SALTAR)

**Este paso es obligatorio en toda ingesta.** Hay apps externas que leen datasets estáticos generados a partir de las leyes de este repo. Si la ley recién ingestada es una de sus fuentes y no se regenera el dataset, esas apps siguen sirviendo datos del curso pasado sin avisar de nada.

| Si la ley es… | Regenerar con | Detalle |
|---|---|---|
| Calendario escolar, calendario laboral/festivos autonómicos, o fiestas locales | `python3 scripts/gen-calendario-dataset.py` | «Dataset de calendario escolar…» al final de este documento |
| Sorteo público de admisión (`resolucion-sorteo-admision-{curso}`), convocatoria anual de admisión de Música y Danza, u orden de admisión que sustituya a la Orden 8/2026 | `python3 scripts/gen-sorteo-dataset.py` | «Dataset del sorteo de admisión…» al final de este documento |

Los generadores **extraen los datos del texto de las leyes ingestadas**: casi nunca basta con ejecutarlos, hay que registrar antes la ley nueva en la lista de fuentes del script (`LOCAL_SOURCES`, `COURSES`, `STANDING_RULE`…). Cada sección explica qué tocar.

Después: `npm run build` (Astro copia `public/` a `dist/`), release normal y **push** — el dataset solo llega a las apps externas cuando se despliega.

**Al crear un dataset nuevo** (una tercera app que quiera leer datos de este repo), hay cuatro sitios que tocar, y ninguno es opcional:
1. `scripts/gen-{nombre}-dataset.py` — generador que **extrae los datos del texto de las leyes ingestadas**, nunca valores tecleados a mano.
2. `public/data/{nombre}/` — salida: `manifest.json` con `courses[]` + un fichero por curso.
3. Una **fila en la tabla de este paso 7** y una **sección al final de este documento** con el disparador y las convenciones del esquema.
4. `src/lib/opendata.ts` — descriptor bilingüe del dataset; es lo que alimenta la página pública `/es/datos/` y `/va/dades/`. Si cambia la forma de un fichero ya publicado, actualizarlo también.

### Errores conocidos y lecciones aprendidas

#### Selección del método de extracción (CRÍTICO)

Elegir el método según la fuente del PDF:

| Fuente | Formato | Método recomendado |
|--------|---------|-------------------|
| DOGV bilingüe antiguo | 2 columnas (va izq, es der) | `pdfplumber` crop izq/der o `pdftotext -x` |
| DOGV PDFs separados | 1 columna por idioma | `pdftotext -layout` |
| BOE moderno (≥2009) | 2 columnas mismo idioma | **`pdftotext`** sin `-layout` (respeta orden de lectura por columnas) |
| BOE antiguo (< 2009) | 2 columnas mismo idioma, PDF compartido con otras leyes | **`pdftotext`** sin `-layout`, luego recortar por marcadores de inicio/fin del RD |
| BOE consolidado PDF | 1 columna | `pdfplumber extract_text()` o `pdftotext -layout` |
| BOE consolidado HTML | HTML web | **Preferido** cuando existe: `curl + regex` |
| DOGV consolidado PDF | 1 columna por idioma | `pdftotext -layout` (eliminar cabeceras de "Legislación consolidada") |

**⚠️ NUNCA usar `pdfplumber` crop (left/right) para PDFs del BOE de dos columnas del mismo idioma.** El crop a `pw/2` corta palabras en los bordes de columna, produciendo texto garbled ("habili-" + "tación" separados, "Orgá" + "nica" truncados). Este error se ha repetido múltiples veces.

**`pdftotext` sin `-layout`** es el método más fiable para BOE con dos columnas del mismo idioma: respeta el orden de lectura (columna izquierda completa, luego columna derecha), no corta palabras. Con `-layout` se interleavan las dos columnas en las mismas líneas, produciendo texto mezclado.

**Cuando el PDF del BOE contiene varias leyes** (ejemplo: RD 943/2003 comparte PDF con otro RD), extraer sin `-layout` y luego recortar el texto usando los marcadores "REAL DECRETO NNN/AAAA" como delimitadores.

**BOE consolidado HTML** (`https://www.boe.es/buscar/act.php?id=BOE-A-XXXX-NNNNN&tn=1`) es la fuente más fiable para texto de artículos. Extraer con:
```python
import re
with open(html_path) as f: html = f.read()
for m in re.finditer(r'<div class="bloque" id="(\w+)">(.*?)</div>\s*<p class="linkSubir">', html, re.DOTALL):
    bid, block = m.group(1), m.group(2)
    paras = [re.sub(r'<[^>]+>', '', p.group(1)).strip() 
             for p in re.finditer(r'<p class="parrafo[^"]*"[^>]*>(.*?)</p>', block, re.DOTALL)]
```
IDs de bloques BOE: `pr` (preámbulo), `a1`-`aN` (artículos), `daprimera`, `dtprimera`, `ddunica`, `dfprimera`, `ani`-`anv` (anexos).

#### Extracción de texto (DOGV)
- `pdftotext` con `-layout` funciona bien para dos columnas si se usan las coordenadas `-x` correctas
- El ancho de página A4 es 595-612 pts. La columna derecha empieza en ~290
- Algunos artículos tienen "Articulo" (sin tilde) en PDFs antiguos - buscar ambas variantes
- Los títulos de artículo pueden ocupar varias líneas - el regex `^Artículo N.` puede no capturar todo
- Las líneas de encabezado de página (Núm. XXXX, CVE:, https://dogv.gva.es/) deben eliminarse del texto
- Los guiones de fin de línea (`-\n`) deben unirse
- La cláusula de promulgación ("Valencia, NN de mes de AAAA" / "El president...") aparece tras la última disposición, antes de los anexos. **NO descartar**: extraer como `promulgation` (lugar, fecha, firmantes). Recortar del contenido de la última disposición si se capturó ahí por error
- El lugar de promulgación NO siempre es Valencia/València — puede ser San Vicente del Raspeig, Alicante, etc.
- Los nombres de firmantes aparecen en ALL CAPS en el PDF → normalizar a mayúsculas/minúsculas ("Alberto Fabra Part", no "ALBERTO FABRA PART")
- Los cargos (`role`) deben ir SIN artículo "El/La" al inicio: "President de la Generalitat", no "El president de la Generalitat"
- Los cargos de conselleria se normalizan con nombre neutro y solo el área de educación: "Conselleria de Educación" / "Conselleria d'Educació" (no Conseller/Consellera, ni las otras áreas como Cultura, Deporte, etc.)
- Los cargos del ministerio estatal se normalizan igual, independientemente del nombre oficial del ministerio en cada época: "Ministerio de Educación" (ES) / "Ministeri d'Educació" (VA) (no Ministro/Ministra, ni las otras áreas como Cultura, Deporte, Ciencia, Formación Profesional, etc.)

#### Disposiciones (errores recurrentes en TODAS las ingestas)
- Las disposiciones finales SIEMPRE deben ser nodos separados (df-1, df-2, etc.), NUNCA un solo nodo con todo junto
- El subtítulo de la disposición (ej. "Única. Derogación normativa") NO debe repetirse al inicio del content
- Los títulos deben ser completos: "Disposición final primera. Aplicación y desarrollo", no solo "Disposiciones finales"
- La cláusula de promulgación NUNCA debe colarse en el content de la última disposición final
- Verificar SIEMPRE tras la ingesta: buscar "Valencia," o "El president" dentro del content de disposiciones

#### Listas y formato de contenido
- Listas con guiones (art-5, art-6): usar `\n–` (salto simple), NO `\n\n–` (que crea párrafos separados con sangrado)
- Headings de secciones curriculares (Introducción, Objetivos, Contenidos, Criterios de evaluación): marcar con `**negrita**` → se renderizan como `.content-heading`
- Títulos de artículo multilínea en el PDF: verificar que el content NO empiece con un fragmento en minúscula (señal de título truncado)
- Tablas: reconstruir manualmente si pdfplumber extrae Table 0 con celdas combinadas (usar Table 1/2 o datos directos del PDF)
- Las tablas (distribución horaria, ratios profesor/alumno) están en páginas a ancho completo (no dos columnas), primero un idioma y luego el otro — NO usar crop de media página para estas páginas
- Usar `pdfplumber.extract_tables()` para extraer tablas — funciona bien para la mayoría de PDFs excepto los más antiguos (D.157/2007 donde agrupa toda la tabla en 1 fila)
- Almacenar tablas como **markdown** en el `content` (formato `| col | col |` con separador `|---|---|`). Esto funciona en los 3 formatos de salida: web (renderizado como `<table>`), JSON (legible), markdown export (nativo)
- `ArticleContent.astro` detecta bloques que empiezan con `|` y contienen `|---` y los renderiza como `<table>` HTML
- Agrupar tablas por especialidad con título en negrita: `**Especialidad: Arpa**\n\n| ... |`
- Las páginas de tablas se identifican buscando `page.extract_tables()` con más de 3 filas (las de 1 fila son basura)
- Un `ANEXO` sin número romano (ej. "Anexo único") no se captura con la regex `ANEXO\s+(I{1,3}V?...)` → buscar también `ANEXO\s*\n` sin número

#### PDFs consolidados del BOE (errores recurrentes)
- Los PDFs consolidados del BOE tienen un **ÍNDICE** al principio con los mismos marcadores de estructura (`Artículo N.`, `Disposición...`) que el cuerpo de la ley, pero seguidos de `. . . . . .` y número de página
- **SIEMPRE** saltar el índice: buscar las líneas con `. . . .` (puntos suspensivos) y excluirlas. El cuerpo empieza tras `PREÁMBULO` (o `PREAMBULO` sin tilde en leyes antiguas)
- Si el parser captura disposiciones con 0 chars de contenido, es casi seguro que está leyendo el índice en vez del cuerpo
- Verificar siempre: NINGUNA disposición debe tener content vacío (excepto las explícitamente derogadas)

#### Separación de párrafos (CRÍTICO - error en TODAS las ingestas de BOE)
- Los apartados numerados (`1.`, `2.`, `3.`) DEBEN estar separados por `\n\n`
- Las letras (`a)`, `b)`, `c)`) DEBEN estar separados por `\n\n`
- Los ordinales de modificación (`Uno.`, `Dos.`, `Tres.`) DEBEN estar separados por `\n\n`
- **Error recurrente**: `join_paragraphs()` une todo en mega-párrafos sin separar estos elementos
- Aplicar post-procesamiento si el parser no los separa:
```python
content = re.sub(r'(\.) (\d+\. [A-Z])', r'\1\n\n\2', content)  # "... text. 2. New"
content = re.sub(r'(\.) ([a-z]\) [A-Z])', r'\1\n\n\2', content)  # "... text. a) New"
content = re.sub(r'\n(\d+\. [A-Z])', r'\n\n\1', content)  # single \n before numbered
content = re.sub(r'\n([a-z]\) )', r'\n\n\1', content)  # single \n before lettered
```
- Para preámbulos extraídos con `pdftotext -layout`: detectar párrafos por **sangría** (indent > 14 espacios = nuevo párrafo, ~10 = continuación)

#### Tablas de HTML del BOE
- Las tablas del BOE consolidado HTML contienen `<br>` dentro de celdas → convertir a `; ` al generar markdown
- **Cada fila de la tabla markdown DEBE estar en UNA sola línea** — si hay saltos de línea dentro de celdas, el renderizador no la detecta como tabla
- Celdas con `**` (leyenda de asteriscos) NO deben interpretarse como negrita: `ArticleContent.astro` ya ignora `**` sin contenido (length ≤ 4)
- Las tablas con puntos suspensivos (`Instrumento . . . . 6 180`) no se extraen bien con `extract_tables()` → parsear con regex del texto
- Siempre incluir la leyenda de asteriscos (`*`, `**`) después de la tabla como texto normal

#### Leyes solo en castellano
- Muchas leyes estatales (BOE) solo existen en castellano: LOE, LOMLOE, LODE, reales decretos, órdenes ministeriales
- Para la versión VA: **mismo contenido ES** con nota al inicio del preámbulo: `[Aquesta llei/norma només existeix en castellà. El text es mostra en castellà.]`
- Los metadatos VA (title, titleShort, vigpiracy.statusLabel, promulgation.signatories.role, legalAnalysis titles/descriptions) deben traducirse al valenciano
- Roles de firmantes estatales: `Rey de España` → `Rei d'Espanya`, `Presidente del Gobierno` → `President del Govern`, `Ministro/a de X` → `Ministre/a de X`

#### URLs escritas dentro del articulado (comprobación obligatoria)

Muchas resoluciones e instrucciones citan direcciones web en el propio texto. El
renderizador las autoenlaza solo (URLs `https://`, dominios `www.` y correos, en
párrafos, encabezados y celdas de tabla), así que **en el JSON van como texto
plano, sin markdown de enlace**. Lo que hay que vigilar es la transcripción:

- El PDF parte las URLs largas por el salto de línea. Al unir las líneas queda
  **un espacio dentro de la dirección** (`…/Actualitzaci %C3%B3n_Instrucciones…`,
  `…/SPRL_IOPRL_04+1910+Info rmaci%C3%B3n…`). El enlace sale a medias y la cola
  se ve como texto suelto: es el síntoma de «hay un link que no se muestra como
  tal».
- O desaparece **el guion que había en el salto**: `proteccio-dedades` por
  `proteccio-de-dades`, `delegacion-deproteccion`, `unaadaptaci%C3%B3n`,
  `revista.seg- social.es`. La URL parece bien y da 404.
- Ojo también con los **UUID de las rutas de `ceice.gva.es`**: pierden guiones
  igual que el resto (`6ee7fef6-f05b48d3-…` en vez de `6ee7fef6-f05b-48d3-…`).
- Y con el número de apartado que se pega al final de la dirección
  (`…-publics-gva.2. Cualquier normativa…`): ahí el `2.` es el apartado
  siguiente y hay que separarlo con `\n\n`.

`npm run validate` corta con **error** los tres patrones (URL partida por un
espacio, URL acabada en guion, coma pegada dentro de la URL), pero no detecta un
guion perdido en medio. Por eso, tras la ingesta: **extraer todas las URLs del
JSON y comprobarlas** (`curl -o /dev/null -w '%{http_code}' -L`). Las que den
404 hay que mirarlas una a una y distinguir dos casos:

- **Defecto nuestro** (guion o espacio perdido al extraer) → se corrige.
- **Enlace muerto en origen** (el portal de la GVA se reestructura a menudo y las
  normas citan rutas que ya no existen) → **se transcribe tal cual**. El texto
  legal es el que es; no se «arregla» apuntando a otra página. Si la misma
  dirección está mal en ES y en VA, es errata del DOGV, no de la extracción.

No hay que rellenar nada en el JSON para que estos enlaces aparezcan en la
cabecera de la ley: el bloque plegable «Enlaces citados en el texto» se genera
en tiempo de compilación (`src/lib/cited-links.ts`). `externalResources` es solo
para enlaces que **no** están en el articulado (calculadora de prelación,
ADMINOVA, corrección de errores publicada aparte).

**Cuando la errata es del DOGV y sabemos cuál era la dirección buena**, el
articulado NO se toca —se transcribe lo publicado— y la corrección se anota en
`data/metadata/link-corrections.json`:

```json
{
  "url": "www.aipd.es",
  "correctedUrl": "https://www.aepd.es",
  "note": { "es": "…por qué se corrige…", "va": "…" }
}
```

Sale marcada como «errata en la norma» dentro del bloque de enlaces citados, con
el enlace bueno debajo. `url` tiene que coincidir **carácter a carácter** con lo
que hay en el texto; `npm run validate` da error si deja de aparecer en alguna
ley (corrección obsoleta), si falta la nota en un idioma o si `correctedUrl` no
es absoluta.

Esto es solo para direcciones **equivocadas** cuyo destino correcto conocemos —
que la propia norma nombra el organismo, o que la ruta buena es evidente. Un
enlace bien transcrito que hoy da 404 porque el portal se reorganizó **no se
corrige a ojo**: se deja como está.

#### Imágenes y diagramas en PDFs
- Los diagramas/organigramas del PDF se extraen como texto garbled (celdas del diagrama mezcladas)
- Detectar por patrones: bloques de texto corto con nombres de niveles educativos, siglas MECES/EQF mezclados
- Sustituir por imagen: guardar en `public/images/laws/{slug}-{nombre}.png` y usar markdown `![alt](/legis_cpmdem/images/laws/archivo.png)`
- `ArticleContent.astro` renderiza `![alt](url)` como `<figure>` con `<img>` y `<figcaption>`
- `content-renderer.ts` convierte URLs (`https://...`), dominios `www.` y correos en enlaces clicables automáticamente (auto-linking). No hace falta usar markdown de enlaces — ver «URLs escritas dentro del articulado».

#### Leyes con contenido no relevante para conservatorios
- Muchas leyes estatales regulan múltiples enseñanzas (ESO, bachillerato, FP, deportivas...)
- Los artículos/disposiciones que NO tratan de música ni danza se sustituyen por: `[No relativo a conservatorios profesionales de música y danza - ver PDF original]`
- Fórmula idéntica en ES y VA, solo el contenido cambia
- Los capítulos excluidos de leyes grandes (ej. Título I LOE) se incluyen como nodos `capitulo` con un hijo `articulo` que contiene la nota (para que el renderizador lo muestre)
- **NUNCA eliminar completamente** capítulos/artículos: siempre dejar referencia para que el lector sepa que existen

#### Ingesta desde texto consolidado (no original)
- Si se ingresa el texto consolidado (ya modificado por leyes posteriores) en vez del original:
  - El `content` del artículo será la versión vigente
  - Hay que obtener el texto **original** del PDF original del BOE para crear `versions[].v1`
  - La `posteriorAffectation` debe existir y `versions[]` debe tener la cadena completa
  - Indicar en la ley que es texto consolidado si procede

#### Versiones de artículos (CRÍTICO)
- Cuando una ley modifica artículos de otra, HAY QUE crear el array `versions` en el artículo afectado
- Sin `versions`, el selector de versión NO aparece en la interfaz
- `content` del artículo DEBE coincidir con `versions[0].content` (versión más reciente)
- Versiones ordenadas de más reciente a más antigua
- La versión original tiene `modifiedBy: null`
- Tipos de modificación: reemplazo total del artículo, modificación de apartados, supresión de apartados
- **Al re-extraer texto** de un artículo con versions[]: actualizar el `content` de la versión v1 (`modifiedBy: null`) con el texto re-extraído, pero el `content` del nodo debe seguir siendo `versions[0].content` (vigente). Nunca sobreescribir `content` del nodo con texto original si hay versiones

#### Cadenas de versiones múltiples (v1 → v2 → v3...)
- Un artículo puede ser modificado por más de una ley a lo largo del tiempo
- Ejemplo: art-14 de D.158/2007 tiene v1 (original 2007) → v2 (D.90/2015) → v3 (D.46/2026, vigente)
- Al insertar una versión intermedia en un artículo que ya tiene versions[], renumerar los versionId
- Orden siempre: `versions[0]` = vigente (vN más alto), `versions[last]` = original (v1)
- Antes de crear versiones, comprobar si el artículo ya tiene versions[] de ingestas anteriores
- Si ya existen, añadir la nueva versión en la posición cronológica correcta y renumerar

#### Al ingestar una ley que ya fue modificada por leyes anteriores
- Si la ley base (ej. D.158/2007) ya fue modificada por leyes posteriores ya ingresadas (ej. D.90/2015, D.46/2026), el contenido actual del artículo debe reflejar la versión vigente
- HAY QUE crear versions[] desde el principio con toda la cadena cronológica conocida
- No ingestar el contenido "actualizado" sin versions[]: si un artículo ha sido modificado, debe tener el array completo para que la interfaz muestre el selector de versión

#### Modificaciones parciales
- Para suprimir un apartado: eliminar el párrafo que empieza con `N. ` del contenido
- Para modificar un apartado: reemplazar el párrafo que empieza con `N. `
- Para reemplazar un artículo entero: usar el nuevo texto completo
- SIEMPRE preservar el texto original como versión anterior

#### Detección de apartados de primer nivel (CUIDADO)
- Algunos artículos tienen sub-listados dentro de apartados con letras (a, b, c, d) que a su vez contienen ítems numerados `1. `, `2. `, etc.
- Ejemplo: art-9 del D.156/2007 tiene `5. Las pruebas... a) Prueba de acceso a baile flamenco: 1. Realización de... 2. Realización de...`
- La regex `\d+\. ` captura estos sub-ítems como falsos apartados de primer nivel
- Para distinguir apartados principales: buscar solo números secuenciales (1→2→3→4→5) precedidos por fin de frase (`. N. `) o al inicio del texto
- Alternativa segura: buscar manualmente las posiciones cuando el artículo tiene estructura compleja con sub-listados

#### Sub-secciones de anexos curriculares
- Los anexos de currículo (Anexo I de D.156, D.157, D.158, D.159) contienen múltiples asignaturas/especialidades
- Se pueden dividir en sub-secciones con `children` para que aparezcan en el sidebar de navegación
- Un nodo `anexo` puede tener `children` (array de nodos `seccion`) EN VEZ DE `content` — no ambos
- Patrones de detección de asignaturas:
  - **Música (D.158, D.159)**: headers en ALL CAPS (`ACOMPAÑAMIENTO`, `CONJUNTO`...) + algunos en Title Case (`Complemento coral`, `Cultura audiovisual`, `Fundamentos de informática`...)
  - **Danza (D.156)**: headers con `Especialidad: Nombre` (`Especialidad: Baile Flamenco`, `Especialidad: Danza clásica`...)
  - **Danza elemental (D.157)**: headers en ALL CAPS (`DANZA ACADÉMICA`, `FOLKLORE`...)
- **Detección por lista cerrada** (PREFERIDO para D.158/2007): usar una lista cerrada de nombres de asignaturas conocidas (del art. 7 del decreto) y buscarlas como líneas standalone (`\nNOMBRE\n`) en el texto v1. Esto evita falsos positivos con líneas de tablas de distribución horaria que también aparecen como líneas cortas. La detección genérica por ALL CAPS captura basura de tablas (`Total 1365`, `A. Propias de la especialidad`, etc.)
- Para detectar headers ALL CAPS usar el texto de `extract_text()` (v1), NO el texto con párrafos (v2), porque la detección de sangrado puede romper los headers en mayúsculas insertando `\n\n` dentro de ellos
- **El contenido de cada sub-sección también necesita párrafos**: el texto v1 tiene `\n` en cada línea visual del PDF sin distinguir párrafos. Tras splitear por headers (v1), aplicar heurística de unión de líneas en párrafos:
  - Líneas ALL CAPS → párrafo standalone (sub-header)
  - Línea que empieza con `N. ` o `a) ` → nuevo párrafo (apartado numerado)
  - Línea anterior termina en `.` `:` `»` + línea actual empieza con mayúscula + línea anterior > 40 chars → nuevo párrafo
  - Resto → unir con espacio a la línea anterior (continuación de párrafo)
- IDs de sub-sección: `anexo-1-{slugified-name}` (ej. `anexo-1-acompanamiento`, `anexo-1-baile-flamenco`)

#### Estructura JSON
- `id` y `slug` deben ser iguales y coincidir con el nombre del archivo (sin .json)
- Convención: `{tipo}-{numero}-{año}` → `decreto-158-2007`. Para resoluciones anuales: `resolucion-inicio-curso-2025-2026`
- Categorías válidas: `curriculo`, `organizacion`, `acceso`, `evaluacion`, `profesorado`, `titulaciones`, `general`
- IDs de estructura: `art-N`, `titulo-N`, `titulo-N-cap-N`, `cap-N`, `da-N`, `dt-N`, `dd-unica`, `df-N`, `anexo-N`, `preambulo`

#### Propiedades de clasificación (OBLIGATORIO en toda nueva ingesta)
Cada ley debe incluir las 4 propiedades siguientes (definidas en `src/lib/types.ts`):
- `scope`: `"general"` | `"musica_y_danza"` | `"musica"` | `"danza"` | `"escuelas_musica_artes_escenicas"` — indica a qué enseñanzas aplica. `escuelas_musica_artes_escenicas` = escuelas de enseñanza artística NO reglada (Música y Artes Escénicas); distinto de los valores de conservatorio (enseñanza reglada). Al añadir un valor de scope nuevo hay que tocar: `src/lib/types.ts` (unión `LawScope`), `src/i18n/{es,va}.json` (`tag.scope.<valor>`), `src/components/LawTags.astro` (CSS `.tag-scope-<valor>`) y `src/pages/{es,va}/buscar.astro` (`tagLabels` + CSS)
- `territory`: `"estatal"` | `"autonomico"` — BOE = estatal, DOGV = autonómico
- `temporality`: objeto con `type: "permanente"` o `type: "anual"` (con `schoolYear` y `expiresDate`)
  - Leyes anuales (ej. instrucciones de inicio de curso): `{ "type": "anual", "schoolYear": "25-26", "expiresDate": "2026-09-01" }`
  - El `expiresDate` es siempre el 1 de septiembre del curso siguiente
- `docType`: `"normativa"` — las resoluciones publicadas en DOGV/BOE son normativa, no documentos
- Estas propiedades se muestran como etiquetas de color en catálogo, detalle y búsqueda (`LawTags.astro`)
- Son filtrables en el buscador

#### Cláusula de promulgación (OBLIGATORIO)
- Toda ley debe incluir `promulgation` con `place`, `date` y `signatories[]`
- Cada firmante tiene `name` (nombre completo) y `role` (cargo en el idioma del JSON)
- El lugar varía: "Valencia"/"València", "San Vicente del Raspeig"/"Sant Vicent del Raspeig", etc.
- Las órdenes solo tienen un firmante (el/la conseller/a); los decretos tienen president + conseller/a
- Extraer del PDF original: aparece tras la última disposición, antes de los anexos
- El nombre se almacena en mayúsculas/minúsculas normales (no ALL CAPS como en el PDF)

#### Enlaces de publicación oficial (OBLIGATORIO)
- `publishedIn.url` → ficha de la disposición en DOGV/BOE (análisis jurídico, texto consolidado). Ejemplos:
  - DOGV: `https://dogv.gva.es/es/eli/es-vc/d/2007/09/21/158` o `https://dogv.gva.es/va/resultat-dogv?signatura=2013/6657`
  - BOE: `https://www.boe.es/eli/es/rd/2006/12/22/1577` (futuro, cuando se ingesten leyes estatales)
- `publishedIn.pdfUrl` → enlace directo al PDF publicado. Ejemplo: `https://dogv.gva.es/datos/2007/09/25/pdf/2007_11706.pdf`
- **AMBOS campos son obligatorios** en toda nueva ingesta
- Si el usuario solo proporciona la URL del PDF, **pedir la URL de la ficha** antes de generar el JSON
- Si el usuario solo proporciona la ficha, **pedir la URL del PDF**
- El botón "Ver en DOGV" usa `url`; el botón "PDF oficial" usa `pdfUrl`

#### Cross-references bidireccionales
- Si Ley B modifica Ley A: actualizar AMBAS leyes
- En Ley A: `posteriorAffectations` + versiones en artículos + `lastModifiedDate`
- En Ley B: `priorAffectations`
- Leyes no ingresadas: usar `lawId` con slug esperado (enlace roto temporal, OK)

#### Leyes de "desarrollo" vs leyes "modificadoras"
- Algunas leyes **desarrollan** especialidades de otra ley (ej. D.109/2011 desarrolla Bajo Eléctrico del D.158/2007) sin modificar artículos concretos
- Estas van en `posteriorAffectations` con `articles: []` (array vacío) y `type: "modifica"`
- Las leyes **modificadoras** sí cambian artículos: van con `articles: ["art-6", "art-8"]` etc.
- Ambos tipos requieren entrada en `posteriorAffectations` de la ley base

#### Preámbulos y marcadores dispositivos
- El preámbulo termina con un marcador dispositivo en línea aislada, que varía según el tipo de norma:
  - Decretos: `DECRETO` (es) / `DECRETE` (va)
  - Órdenes: `ORDENO` (es) / `ORDENE` (va)
- No confundir con "DECRETO 158/2007" dentro del texto del preámbulo (que es referencia, no marcador)
- El marcador dispositivo siempre va seguido inmediatamente de `CAPÍTULO I` o `Artículo 1`
- En valenciano, el marcador de inicio del preámbulo varía: "L'estructura...", "Este decret...", "La Llei orgànica..."
- Verificar que no se captura texto de los artículos

### Leyes ingresadas
Consultar siempre `data/metadata/law-registry.json` para la lista actualizada. No mantener lista duplicada aquí.

Tipos de norma ingresados hasta ahora: `decreto`, `orden`, `ley_organica`, `ley`, `real_decreto`, `resolucion`, `instrucciones`. Pendientes: `correccion_errores`.

#### Resoluciones
- Las resoluciones pueden tener estructuras muy variadas (con artículos, con apartado único + anexo, u otras formas). NO asumir una estructura fija.
- Ejemplo ingresado: instrucciones de inicio de curso (apartado único + anexo extenso con secciones numeradas 1-10 usando nodos `seccion`/`articulo`).
- Las resoluciones anuales (instrucciones de curso) usan `temporality.type: "anual"` con `schoolYear` y `expiresDate`.
- **⚠️ Si la norma es de calendario** (calendario escolar, calendario laboral/festivos autonómicos, o fiestas locales), tras ingestarla hay que **regenerar el dataset de calendario** — ver la sección «Dataset de calendario escolar para consumo externo» al final de este documento.
- **⚠️ Si la norma es el sorteo público de admisión** (`resolucion-sorteo-admision-{curso}`) o la convocatoria anual de admisión de Música y Danza, tras ingestarla hay que **regenerar el dataset de sorteo** — ver la sección «Dataset del sorteo de admisión para consumo externo» al final de este documento.

#### Leyes de medidas fiscales (leyes de acompañamiento)

Cada año, junto a los presupuestos, Les Corts aprueban una ley de medidas fiscales, de gestión administrativa y financiera, y de organización de la Generalitat (la «ley de acompañamiento»). Son leyes enormes y heterogéneas que modifican decenas de normas de golpe.

**⚠️ Al ingestar una ley de acompañamiento hay dos comprobaciones obligatorias:**

1. **¿Modifica la Ley 20/2017, de tasas?** Casi siempre sí, y casi siempre toca el título XIV (tasas en materia de educación). Hay que abrir `data/laws/{es,va}/ley-20-2017.json` y **crear las versiones** de los artículos afectados (`art-14-1-2`, `art-14-2-5`, `art-14-5-5`, `dt-unica`…), actualizar `posteriorAffectations` y `vigpiracy.lastModifiedDate`. Si no se hace, el repositorio publica tarifas de matrícula caducadas, que es peor que no publicarlas.
2. **¿Modifica alguna otra ley ya ingestada?** Revisar el capítulo de la Conselleria de Educación, Cultura y Universidades y el índice completo: el Decreto 193/2025 de convivencia, el Decreto 80/2017 de inspección o los decretos de currículo pueden aparecer en cualquier capítulo.

Convenciones de alcance para estas leyes (ver `ley-5-2026` como modelo): se conserva el esqueleto completo de títulos, capítulos y secciones, agrupando en un solo nodo los **tramos de capítulos seguidos** sin incidencia («Capítulos I a VI. …»), y se reproduce con texto íntegro solo lo que afecta a las enseñanzas de música y danza. El preámbulo se poda igual: enteros los apartados de encuadre general de la ley, y del resto solo los párrafos con incidencia, sustituyendo los tramos elididos por la nota.

Cuando un cuadro de tarifas o de cuotas mezcla enseñanzas, **se recorta a los conceptos de conservatorio** y se cierra con la nota de no relativo; no se reproduce entero.

### Configuración importante
- `base` en `astro.config.mjs` DEBE tener trailing slash: `/legis_cpmdem/`
- Node.js >= 22.12.0
- Deploy automático en push a main via GitHub Actions

### Versionado y releases (OBLIGATORIO en cada release)
- **Siempre** actualizar `src/lib/version.ts` con el nuevo número de versión — se muestra en el header de la web
- **Siempre** actualizar `data/changelog.json` con las novedades (bilingüe es/va)
- **Siempre** crear tag git con el número de versión (`git tag vX.Y.Z`)
- Formato: major.minor.patch (major=cambios de estructura, minor=ingestas de leyes, patch=correcciones)

## Dataset de calendario escolar para consumo externo (`data/calendario/`)

Este repo publica un **dataset de calendario** (ficheros estáticos servidos por GitHub Pages) que consume una app externa de planificación de calendario escolar. NO es parte de la web visible: son datos.

- Ficheros publicados: `public/data/calendario/manifest.json` y `public/data/calendario/{curso}.json` (p. ej. `2026-2027.json`).
- URLs públicas: `https://jlmirallesb.github.io/legis_cpmdem/data/calendario/manifest.json` (y `/{curso}.json`).
- Esquema versionado propio: `"schema": "cev-calendario-escolar"`, `"version": N` (subir `version` solo en cambios incompatibles: renombrar un slug de municipio, cambiar semántica de un campo, etc. Los cambios aditivos no la tocan).
- Generador reproducible: **`scripts/gen-calendario-dataset.py`** — lee de `data/laws/va/` (no de temporales) y reescribe los ficheros. Ejecutar: `python3 scripts/gen-calendario-dataset.py`.

### ⚠️ DISPARADOR: al ingestar/modificar normativa de calendario, REGENERAR el dataset

Después de ingestar o modificar cualquiera de estas normas, **hay que regenerar el dataset y republicar** (si no, la app externa se queda con datos obsoletos):

| Normativa afectada | Acción en `scripts/gen-calendario-dataset.py` |
|---|---|
| **Fiestas locales de un nuevo año** (ej. `resolucion-fiestas-locales-2027`) | Añadir una línea a `LOCAL_SOURCES` con `(slug, año, meses)`. Para completar el curso 2026-2027: `("resolucion-fiestas-locales-2027", 2027, set(range(1, 7)))` (ene-jun 2027). |
| **Nuevo calendario escolar** (ej. curso 2027-2028) | Crear un nuevo bloque de curso: añadir el curso a `manifest["courses"]` y generar `{curso}.json` con sus fechas (inicio/fin por enseñanza, vacaciones, festivos). Extender `LOCAL_SOURCES` con las fiestas locales de los años naturales que cubre ese curso. |
| **Nuevo calendario laboral** (decreto anual) o cambios en festivos autonómicos | Actualizar `autonomic_holidays` (escolar + laboral deduplicados, excluyendo los que caen dentro de vacaciones). |
| **Corrección de fechas** en cualquiera de las leyes anteriores | Re-ejecutar el generador (las fechas se transcriben de las leyes). |

Convenciones del dataset (no romper, la app externa depende de ellas):
- `code` de municipio = **slug estable y único** (minúsculas, sin acentos ni apóstrofes, `/`→`-`). **Nunca renombrar** un slug ya publicado (rompería selecciones guardadas en la app externa → sería cambio incompatible, subir `version`). `name` = forma legible (valenciano, oficial DOGV).
- Rangos de vacaciones: `start`/`end` **inclusivos** (primer y último día NO lectivo; la reincorporación ya es lectiva).
- `nonLectiveDays` va **vacío** desde este repo (los días de libre disposición los fija cada consejo escolar municipal, no están en el DOGV).
- `localHolidays` de un curso solo incluye festivos **dentro del curso** (por eso las fiestas de año natural se filtran por meses en `LOCAL_SOURCES`).
- Idioma del dataset: valenciano. Un mapeo de nombres es/va de municipios sería una pasada futura verificada (no emparejar a ojo Xàbia↔Jávea, etc.).

Tras regenerar: `npm run build` (Astro copia `public/` a `dist/`) y hacer release normal (version.ts + changelog + tag + push).

## Dataset del sorteo de admisión para consumo externo (`data/sorteo/`)

Este repo publica un segundo dataset (mismo patrón que el de calendario) que consumen apps externas de gestión de admisión y pruebas de acceso: las letras del sorteo público de Conselleria con las que se ordena al alumnado en los desempates. NO es parte de la web visible: son datos.

- Ficheros publicados: `public/data/sorteo/manifest.json` y `public/data/sorteo/{curso}.json`.
- URLs públicas: `https://jlmirallesb.github.io/legis_cpmdem/data/sorteo/manifest.json` (y `/{curso}.json`).
- Esquema versionado propio: `"schema": "cev-sorteo-admision"`, `"version": N` (subir `version` solo en cambios incompatibles; los aditivos no la tocan).
- Generador reproducible: **`scripts/gen-sorteo-dataset.py`** — extrae las letras con regex del artículo «Resultado del sorteo» de la norma ya ingestada; **nunca teclearlas a mano**. Ejecutar: `python3 scripts/gen-sorteo-dataset.py`.

### ⚠️ DISPARADOR: al ingestar el sorteo de un curso nuevo, REGENERAR el dataset

| Normativa afectada | Acción en `scripts/gen-sorteo-dataset.py` |
|---|---|
| **Sorteo de un curso nuevo** (ej. `resolucion-sorteo-admision-2027-2028`) | Añadir una tupla a `COURSES`: `(curso, slug del sorteo, slug de la convocatoria de admisión de Música y Danza)`. Si la convocatoria aún no está ingestada, pasar `None` como tercer elemento y volver a ejecutar cuando lo esté. |
| **Nueva convocatoria anual de admisión de Música y Danza** | Rellenar el tercer elemento de la tupla del curso correspondiente (activa la comprobación cruzada de letras). |
| **Nueva orden de admisión de Música y Danza** que sustituya a la Orden 8/2026 | Actualizar `STANDING_RULE` con el nuevo slug y artículo. |
| **Corrección de letras** en la resolución del sorteo | Re-ejecutar el generador (las letras se extraen de la ley). |

Convenciones del dataset (la app externa depende de ellas):
- `letters1`/`letters2` = cadena literal `«X-Y»`, tal y como la publica la norma (primer apellido / segundo apellido).
- `manifest.courses[]` es lo que evita que la app adivine el slug de la norma del año siguiente: lee el manifest, elige curso y pide `{curso}.json`.
- `norm` = norma de la que salen las letras. `appliedBy` = normas de Música y Danza que aplican ese sorteo a los conservatorios.
- **El sorteo NO es específico de enseñanzas artísticas**: la resolución solo nombra Infantil, Primaria, ESO, Bachillerato y Educación Especial. Se aplica a los conservatorios por el art. 19.2.4.º de la Orden 8/2026 y por el apartado noveno de la convocatoria anual, que reproduce las mismas letras. El generador comprueba que ambas coinciden y aborta si discrepan.

Tras regenerar: `npm run build` y release normal (version.ts + changelog + tag + push).
