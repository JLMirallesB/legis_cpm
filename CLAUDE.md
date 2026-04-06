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
# Buscar artículos, capítulos, disposiciones, anexos
grep -n "^Artículo\|^\s*Artículo\|^Articulo\|^CAPÍTULO\|^DISPOSICION\|^ANEXO" /tmp/ley-es.txt
```

#### 3. Generar JSON con script Python
Usar un script Python que:
- Parsee los artículos del texto extraído
- Genere `data/laws/es/{slug}.json` y `data/laws/va/{slug}.json`
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

#### Extracción de texto
- `pdftotext` con `-layout` funciona bien para dos columnas si se usan las coordenadas `-x` correctas
- El ancho de página A4 es 595-612 pts. La columna derecha empieza en ~290
- Algunos artículos tienen "Articulo" (sin tilde) en PDFs antiguos - buscar ambas variantes
- Los títulos de artículo pueden ocupar varias líneas - el regex `^Artículo N.` puede no capturar todo
- Las líneas de encabezado de página (Núm. XXXX, CVE:, https://dogv.gva.es/) deben eliminarse del texto
- Los guiones de fin de línea (`-\n`) deben unirse
- La firma del decreto/orden ("Valencia, NN de mes de AAAA" / "El president...") se captura a veces en la última disposición final → recortar en `Valencia,` o `València,`
- Las tablas (distribución horaria, ratios profesor/alumno) se extraen como datos numéricos sueltos sin cabeceras — problema conocido pendiente de resolver
- Un `ANEXO` sin número romano (ej. "Anexo único") no se captura con la regex `ANEXO\s+(I{1,3}V?...)` → buscar también `ANEXO\s*\n` sin número

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
- Dos patrones de detección de asignaturas:
  - **Música (D.158, D.159)**: headers en ALL CAPS (`ACOMPAÑAMIENTO`, `CONJUNTO`, `LENGUAJE MUSICAL`...)
  - **Danza (D.156)**: headers con `Especialidad: Nombre` (`Especialidad: Baile Flamenco`, `Especialidad: Danza clásica`...)
  - **Danza elemental (D.157)**: headers en ALL CAPS (`DANZA ACADÉMICA`, `FOLKLORE`...)
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

Tipos de norma ingresados hasta ahora: `decreto`, `orden`. Pendientes: `resolucion`, `ley`, `ley_organica`, `real_decreto`, `correccion_errores`.

### Configuración importante
- `base` en `astro.config.mjs` DEBE tener trailing slash: `/legis_cpm/`
- Node.js >= 22.12.0
- Deploy automático en push a main via GitHub Actions
