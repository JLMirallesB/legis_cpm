# Guía de Contenido - Legis CPM

## Cómo Añadir una Nueva Ley

La ingesta de leyes se hace de forma **asistida por Claude** en sesiones de trabajo.

### Proceso Paso a Paso

#### 1. Preparación (antes de la sesión con Claude)

- Ten a mano el **PDF del DOGV** de la ley que quieres añadir
- Determina la **categoría** (ver sección Categorías más abajo)
- Identifica si esta ley **modifica o es modificada** por leyes ya existentes en el sistema
- Consulta `data/metadata/law-registry.json` para ver qué leyes están ya ingresadas

#### 2. Prompt para Claude

Usa esta plantilla al inicio de la sesión:

```
Necesito ingerir esta ley en el proyecto legis_cpmdem.

DATOS:
- Tipo: [decreto/orden/resolucion/ley/ley_organica/real_decreto/correccion_errores]
- Número: [ej. 158/2007]
- Slug: [ej. decreto-158-2007]
- Categoría: [curriculo/organizacion/acceso/evaluacion/profesorado/titulaciones/general]
- DOGV número: [ej. 5606]
- DOGV fecha: [YYYY-MM-DD]
- DOGV URL: [URL del PDF]

REFERENCIAS CRUZADAS:
- Esta ley modifica: [slugs de leyes existentes y artículos afectados, o "ninguna"]
- Esta ley es modificada por: [slugs de leyes existentes, o "ninguna"]
- Esta ley deroga: [slugs, o "ninguna"]

[PDF adjunto]

Genera:
1. data/laws/es/{slug}.json (castellano)
2. data/laws/va/{slug}.json (valenciano)
3. Actualiza leyes existentes afectadas si las hay
4. Ejecuta npm run validate para comprobar
```

#### 3. Claude procesará

- Extrae el texto del PDF
- Separa los dos idiomas (castellano y valenciano)
- Detecta la estructura (artículos, capítulos, disposiciones)
- Detecta si modifica artículos de otras leyes ya existentes
- Genera los JSON para ambos idiomas
- Si hay modificaciones cruzadas, actualiza las leyes afectadas

#### 4. Revisión y commit

- Ejecuta `npm run validate` para verificar los JSON
- Ejecuta `npm run dev` y navega a la ley para verificar renderizado
- Comprueba: catálogo, lector, sidebar, búsqueda, análisis jurídico
- Haz commit de los cambios

---

## Convenciones de Nombrado

### Nombre del archivo

`{tipo}-{numero}-{año}.json`

Ejemplos:
- `decreto-158-2007.json`
- `orden-28-2011.json`
- `resolucion-15-2019.json`

### slug e id

Mismo que el nombre del archivo sin `.json`. Los campos `id` y `slug` deben tener el mismo valor.

### IDs de Estructura

| Elemento | Patrón de ID | Ejemplo |
|----------|-------------|---------|
| Preámbulo | `preambulo` | `preambulo` |
| Artículo | `art-{n}` | `art-1`, `art-45` |
| Título | `titulo-{n}` | `titulo-1` |
| Capítulo | `titulo-{n}-cap-{n}` | `titulo-1-cap-2` |
| Sección | `titulo-{n}-cap-{n}-sec-{n}` | `titulo-1-cap-2-sec-1` |
| Disp. Adicional | `da-{n\|unica}` | `da-1`, `da-unica` |
| Disp. Transitoria | `dt-{n\|unica}` | `dt-1`, `dt-unica` |
| Disp. Derogatoria | `dd-{n\|unica}` | `dd-unica` |
| Disp. Final | `df-{n\|unica}` | `df-1`, `df-unica` |
| Anexo | `anexo-{n}` | `anexo-1`, `anexo-2` |

### Versiones de artículos

- `versionId`: `v1` (original), `v2`, `v3`... numeradas incrementalmente
- El array `versions` se ordena de **más reciente a más antigua** (newest first)
- El campo `content` del artículo debe coincidir con `versions[0].content`
- La versión original tiene `modifiedBy: null`

---

## Categorías Disponibles

Ver `data/metadata/categories.json`:

| ID | Descripción |
|----|-------------|
| `curriculo` | Planes de estudio y currículo |
| `organizacion` | Organización y funcionamiento de centros |
| `acceso` | Acceso, admisión y pruebas de ingreso |
| `evaluacion` | Evaluación, calificación y promoción |
| `profesorado` | Normativa del profesorado |
| `titulaciones` | Títulos, certificaciones y equivalencias |
| `general` | Legislación general de educación |

---

## Gestión de Cross-References

### Cuando la Ley B modifica artículos de la Ley A

**En Ley A** (`data/laws/{lang}/{ley-a}.json`):

1. Buscar el nodo `structure` del artículo afectado
2. Si no tiene `versions[]`: crear v1 con contenido actual (`modifiedBy: null`, `effectiveDate` = fecha de entrada en vigor de Ley A)
3. Añadir nueva versión en posición 0: `modifiedBy: { lawId: "{ley-b}", title: "..." }`, `content` = texto nuevo
4. Actualizar `content` del artículo al texto de la nueva versión
5. Añadir entrada en `legalAnalysis.posteriorAffectations`
6. Actualizar `vigpiracy.lastModifiedDate`

**En Ley B** (`data/laws/{lang}/{ley-b}.json`):

1. Añadir entrada en `legalAnalysis.priorAffectations`

### Leyes no ingresadas aún

- Usar `lawId` con el slug esperado (ej. `decreto-90-2020`) + `title` como texto
- El enlace dará 404 hasta que se ingeste esa ley (comportamiento aceptable)
- Para leyes que nunca se ingestarán (ej. LOE, reales decretos nacionales): omitir `lawId`, usar solo `title`

---

## Checklist por Ley

Después de generar los JSON, verificar:

- [ ] JSON `es/` creado con todos los campos requeridos
- [ ] JSON `va/` creado con estructura idéntica
- [ ] `id` y `slug` siguen convención `{tipo}-{numero}-{año}`
- [ ] `category` es una de las 7 categorías válidas
- [ ] `publishedIn.url` apunta a la ficha de la disposición en DOGV/BOE (no al PDF)
- [ ] `publishedIn.pdfUrl` apunta al PDF publicado en DOGV/BOE
- [ ] `promulgation` incluye lugar, fecha y firmantes (nombre + cargo en idioma correcto)
- [ ] `vigpiracy.status` es correcto y coherente
- [ ] Artículos con versiones: `content` = `versions[0].content`, array ordenado newest-first
- [ ] Cross-refs bidireccionales actualizadas (Ley A ↔ Ley B)
- [ ] `npm run validate` pasa sin errores
- [ ] `npm run build` compila sin errores
- [ ] Verificación visual en `npm run dev`:
  - [ ] La ley aparece en el catálogo (home)
  - [ ] El lector renderiza todos los artículos y disposiciones
  - [ ] La sidebar de navegación funciona
  - [ ] La búsqueda encuentra la ley
  - [ ] El panel de análisis jurídico muestra las cross-refs
  - [ ] Ambos idiomas (`/es/ley/{slug}/` y `/va/llei/{slug}/`) renderizan

---

## Estrategia de Orden de Ingesta

Para ingerir 20-50 leyes eficientemente:

1. **Primero**: Leyes "base" vigentes no modificadas por otras (las más simples)
2. **Segundo**: Leyes principales referenciadas por muchas otras
3. **Tercero**: Leyes modificadoras (actualizar cross-refs en la misma sesión)
4. **Agrupar por categoría** para reducir cambio de contexto
5. **Derogadas al final** (menor prioridad para los usuarios)

---

## Esquema de Datos

Ver [DATA-SCHEMA.md](./DATA-SCHEMA.md) para el esquema completo de TypeScript.

## Validación Automática

```bash
npm run validate
```

Este script verifica todos los JSON en `data/laws/`:
- Campos requeridos y tipos correctos
- Valores enum válidos (tipo de ley, vigencia, categoría, etc.)
- Consistencia de versiones de artículos
- Paridad entre idiomas (es/va)
- Integridad de cross-references
- IDs de estructura únicos
- Formato de fechas
