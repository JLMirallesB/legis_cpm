# Instrucciones para Claude Code - Legis CPM

## Qué es este proyecto
Lector de legislación de Conservatorios Profesionales de Música y Danza de la Generalitat Valenciana. Sitio estático con Astro 6.x desplegado en GitHub Pages. Datos en JSON bilingüe (es/va).

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

#### 5. Actualizar cross-references si la ley modifica otras
- Añadir `posteriorAffectations` en las leyes modificadas
- **CREAR VERSIONES** en los artículos afectados (array `versions`)
- Actualizar `lastModifiedDate` en `vigpiracy`
- Actualizar `data/metadata/law-registry.json`

### Errores conocidos y lecciones aprendidas

#### Selección del método de extracción (CRÍTICO)

Elegir el método según la fuente del PDF:

| Fuente | Formato | Método recomendado |
|--------|---------|-------------------|
| DOGV bilingüe antiguo | 2 columnas (va izq, es der) | `pdfplumber` crop izq/der o `pdftotext -x` |
| DOGV PDFs separados | 1 columna por idioma | `pdftotext -layout` |
| BOE moderno (≥2009) | 2 columnas mismo idioma | **`pdftotext -layout`** (NO pdfplumber crop) |
| BOE consolidado PDF | 1 columna | `pdfplumber extract_text()` o `pdftotext -layout` |
| BOE consolidado HTML | HTML web | **Preferido** cuando existe: `curl + regex` |

**⚠️ NUNCA usar `pdfplumber` crop (left/right) para PDFs del BOE de dos columnas del mismo idioma.** El crop a `pw/2` corta palabras en los bordes de columna, produciendo texto garbled ("habili-" + "tación" separados, "Orgá" + "nica" truncados). Este error se ha repetido múltiples veces.

**`pdftotext -layout`** es el método más fiable para BOE: respeta columnas, no corta palabras, mantiene la estructura visual.

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

#### Imágenes y diagramas en PDFs
- Los diagramas/organigramas del PDF se extraen como texto garbled (celdas del diagrama mezcladas)
- Detectar por patrones: bloques de texto corto con nombres de niveles educativos, siglas MECES/EQF mezclados
- Sustituir por imagen: guardar en `public/images/laws/{slug}-{nombre}.png` y usar markdown `![alt](/legis_cpm/images/laws/archivo.png)`
- `ArticleContent.astro` renderiza `![alt](url)` como `<figure>` con `<img>` y `<figcaption>`

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
- Convención: `{tipo}-{numero}-{año}` → `decreto-158-2007`
- Categorías válidas: `curriculo`, `organizacion`, `acceso`, `evaluacion`, `profesorado`, `titulaciones`, `general`
- IDs de estructura: `art-N`, `titulo-N`, `titulo-N-cap-N`, `cap-N`, `da-N`, `dt-N`, `dd-unica`, `df-N`, `anexo-N`, `preambulo`

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

Tipos de norma ingresados hasta ahora: `decreto`, `orden`, `ley_organica`, `ley`, `real_decreto`. Pendientes: `resolucion`, `correccion_errores`.

### Configuración importante
- `base` en `astro.config.mjs` DEBE tener trailing slash: `/legis_cpm/`
- Node.js >= 22.12.0
- Deploy automático en push a main via GitHub Actions
