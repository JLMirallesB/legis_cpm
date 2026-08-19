# Esquema de Datos - Legis CPM

## Ubicaci&oacute;n de Archivos

- Leyes en castellano: `data/laws/es/{slug}.json`
- Leyes en valenciano: `data/laws/va/{slug}.json`
- Categor&iacute;as: `data/metadata/categories.json`
- Tipos TypeScript: `src/lib/types.ts`

## Esquema JSON de una Ley

Cada ley es un archivo JSON con la siguiente estructura:

```json
{
  "id": "decreto-158-2007",
  "slug": "decreto-158-2007",
  "type": "decreto",
  "number": "158/2007",
  "date": "2007-09-21",
  "publishedIn": {
    "source": "DOGV",
    "number": "5606",
    "date": "2007-09-25",
    "url": "https://dogv.gva.es/es/eli/es-vc/d/2007/09/21/158",
    "pdfUrl": "https://dogv.gva.es/datos/2007/09/25/pdf/2007_11706.pdf"
  },
  "title": "T&iacute;tulo completo de la norma",
  "titleShort": "T&iacute;tulo corto para listados",
  "category": "curriculo",
  "vigpiracy": {
    "status": "vigente | vigente_parcial | derogada_parcial | derogada",
    "statusLabel": "Texto legible del estado",
    "effectiveDate": "2007-09-26",
    "lastModifiedDate": "2020-03-15"
  },
  "structure": [ ... ],
  "legalAnalysis": { ... }
}
```

## Campos Principales

| Campo | Tipo | Obligatorio | Descripci&oacute;n |
|-------|------|-------------|-------------|
| id | string | S&iacute; | Identificador &uacute;nico (mismo en ambos idiomas) |
| slug | string | S&iacute; | Slug para la URL (mismo en ambos idiomas) |
| type | LawType | S&iacute; | Tipo: ley_organica, ley, real_decreto, decreto, orden, resolucion, correccion_errores |
| number | string | S&iacute; | N&uacute;mero oficial (ej: "158/2007") |
| date | string | S&iacute; | Fecha de aprobaci&oacute;n (YYYY-MM-DD) |
| publishedIn | object | S&iacute; | Datos de publicaci&oacute;n oficial |
| title | string | S&iacute; | T&iacute;tulo completo |
| titleShort | string | S&iacute; | T&iacute;tulo corto para listados |
| category | string | S&iacute; | ID de categor&iacute;a (ver categories.json) |
| vigpiracy | object | S&iacute; | Estado de vigencia |
| structure | array | S&iacute; | Estructura jer&aacute;rquica del texto |
| legalAnalysis | object | S&iacute; | An&aacute;lisis jur&iacute;dico |

## Estructura del Texto (structure)

La estructura es un &aacute;rbol jer&aacute;rquico:

```json
{
  "type": "titulo",
  "id": "titulo-1",
  "title": "T&iacute;tulo I. Disposiciones generales",
  "children": [
    {
      "type": "capitulo",
      "id": "titulo-1-cap-1",
      "title": "Cap&iacute;tulo I. Objeto y &aacute;mbito",
      "children": [
        {
          "type": "articulo",
          "id": "art-1",
          "number": "1",
          "title": "Art&iacute;culo 1. Objeto",
          "content": "Texto del art&iacute;culo...",
          "versions": [...]
        }
      ]
    }
  ]
}
```

### Tipos de nodo (StructureNodeType)

- `preambulo` - Pre&aacute;mbulo
- `titulo` - T&iacute;tulo (puede contener cap&iacute;tulos)
- `capitulo` - Cap&iacute;tulo (puede contener secciones o art&iacute;culos)
- `seccion` - Secci&oacute;n
- `articulo` - Art&iacute;culo (nodo hoja con contenido)
- `disposicion_adicional` - Disposici&oacute;n adicional
- `disposicion_transitoria` - Disposici&oacute;n transitoria
- `disposicion_derogatoria` - Disposici&oacute;n derogatoria
- `disposicion_final` - Disposici&oacute;n final
- `anexo` - Anexo

## Versiones de Art&iacute;culos

Un art&iacute;culo puede tener m&uacute;ltiples versiones si ha sido modificado:

```json
{
  "type": "articulo",
  "id": "art-5",
  "number": "5",
  "title": "Art&iacute;culo 5. ...",
  "content": "Texto de la versi&oacute;n VIGENTE (la m&aacute;s reciente)",
  "versions": [
    {
      "versionId": "v2",
      "effectiveDate": "2020-03-15",
      "modifiedBy": {
        "lawId": "decreto-5-2020",
        "title": "Decreto 5/2020...",
        "articleRef": "art-3"
      },
      "content": "Texto de la versi&oacute;n vigente..."
    },
    {
      "versionId": "v1",
      "effectiveDate": "2007-09-26",
      "modifiedBy": null,
      "content": "Texto original del art&iacute;culo..."
    }
  ]
}
```

- El campo `content` del art&iacute;culo siempre contiene la versi&oacute;n vigente
- El array `versions` est&aacute; ordenado de m&aacute;s reciente a m&aacute;s antiguo
- `modifiedBy` es `null` para la versi&oacute;n original

## An&aacute;lisis Jur&iacute;dico

```json
{
  "legalAnalysis": {
    "enactedPursuantTo": [
      {
        "lawId": "ley-organica-2-2006",
        "title": "Ley Org&aacute;nica 2/2006...",
        "articles": ["art-45"],
        "relationship": "habilitante"
      }
    ],
    "priorAffectations": [
      {
        "lawId": "decreto-anterior",
        "title": "Norma que esta ley modifica",
        "type": "modifica",
        "articles": ["art-5"],
        "description": "Modifica el art&iacute;culo 5..."
      }
    ],
    "posteriorAffectations": [
      {
        "lawId": "decreto-5-2020",
        "title": "Norma que modifica esta ley",
        "type": "modifica",
        "articles": ["art-1", "art-3"],
        "date": "2020-03-15",
        "description": "Modifica los art&iacute;culos 1 y 3"
      }
    ],
    "derogations": [],
    "concordances": []
  }
}
```

## Cl&aacute;usula de Promulgaci&oacute;n

```json
{
  "promulgation": {
    "place": "Valencia",
    "date": "2007-09-21",
    "signatories": [
      {
        "name": "Francisco Camps Ortiz",
        "role": "El president de la Generalitat"
      },
      {
        "name": "Alejandro Font de Mora Tur&oacute;n",
        "role": "El conseller de Educaci&oacute;n"
      }
    ]
  }
}
```

- `place` y `role` est&aacute;n en el idioma del JSON (es/va)
- `signatories` puede tener 1 (&oacute;rdenes) o m&aacute;s firmantes (decretos)
- Campos `name` y `role` permiten filtrado futuro por persona o cargo

## Modelos de Solicitud (formModels)

Campo **opcional** para leyes que incluyen formularios PDF descargables (ej: modelos de solicitud como anexos al final del PDF).

```json
{
  "formModels": [
    {
      "id": "solicitud-reclamacion",
      "title": "Solicitud de reclamación de calificaciones (Anexo I)",
      "pdfUrl": "https://dogv.gva.es/datos/2011/12/28/pdf/2011_13033.pdf"
    }
  ]
}
```

- `id`: identificador único del modelo dentro de la ley
- `title`: texto del botón, en el idioma del JSON (es/va)
- `pdfUrl`: URL del PDF. Puede ser:
  - **Ruta relativa** (`models/nombre.pdf`) → fichero en `public/models/`, el componente añade `BASE_URL` automáticamente.
  - **URL absoluta** (`https://...`) → se usa directamente (p.ej. enlace externo).

**Renderizado**: si `formModels` está presente y no vacío, aparece un bloque resaltado naranja con botones de descarga por encima del análisis jurídico en la página de la ley. El componente es `src/components/FormModelButtons.astro`.

**Cuándo usar**: cuando la norma incluye modelos de formularios o solicitudes como anexos, que el personal del conservatorio puede necesitar descargar y rellenar.

## Convenciones de Nombrado

- **slug**: tipo-numero-ano en min&uacute;sculas (ej: `decreto-158-2007`)
- **IDs de art&iacute;culo**: `art-{numero}` (ej: `art-1`, `art-12`)
- **IDs de t&iacute;tulo**: `titulo-{numero}` (ej: `titulo-1`)
- **IDs de cap&iacute;tulo**: `titulo-{n}-cap-{n}` (ej: `titulo-1-cap-2`)
- **IDs de versi&oacute;n**: `v{numero}` de m&aacute;s reciente a m&aacute;s antiguo
- **Fechas**: formato ISO `YYYY-MM-DD`

## Referencias con ancla (`data/notebooks/*.json`)

Los cuadernos —y, en el futuro, las fichas de documentos de centro— **no
guardan texto de las leyes**. Guardan la dirección del apartado y el texto se
resuelve desde la ley al compilar. Una cita no puede así quedarse petrificada
cuando la ley cambia.

```jsonc
{
  "law": "ley-organica-2-2006",   // slug de la ley
  "article": "art-121",           // id del nodo: art-N, da-N, df-N, anexo-N…
  "apartado": "2",                // opcional; ausente = el nodo entero
  "checkedAt": "2026-08-19",      // última revisión humana
  "hash": { "es": "a3f1c9d2", "va": "7d20be41" },
  "note": "…"                     // opcional, uso editorial
}
```

### Rutas de apartado

El parser (`src/lib/refs-core.mjs`) parte el contenido por párrafos y compone
una ruta jerárquica:

| Ruta | Qué es |
|---|---|
| `2` | apartado numérico de primer nivel |
| `1.k` | letra k dentro del apartado 1 |
| `5.b.3` | ítem `3)` dentro de la letra b del apartado 5 |
| `7.1.1` | numeración compuesta (resoluciones) |
| `uno.2` | apartado 2 dentro del ordinal «Uno.» de una ley modificadora |
| `objetivos.1` | ítem 1 bajo el encabezado en negrita **Objetivos** |
| `5~2` | segunda vez que la ley usa el número 5 (errata del diario oficial) |

Se puede anclar por la última clave (`k`) si no hay ambigüedad; si la hay,
`npm run validate` falla y dice cuáles son las candidatas. Es deliberado:
preferible romper el build a servir el apartado equivocado.

### Frescura

`refFreshness()` compara la referencia con la ley y devuelve un nivel:

| Nivel | Cuándo |
|---|---|
| `ok` | nada que señalar (no se pinta nada en la web) |
| `caducado` | norma anual cuyo `expiresDate` ya pasó |
| `revisar` | el hash no coincide, el artículo tiene versión nueva o le afecta una norma posterior |
| `derogado` | la ley está derogada o el artículo fue derogado |
| `roto` | el ancla ya no resuelve → **error** en `npm run validate` |

Ninguna señal se escribe a mano: todas salen de `vigpiracy`, `versions[]`,
`posteriorAffectations` y `temporality`, más el hash guardado al curar la cita.

### Herramientas

| Comando | Para qué |
|---|---|
| `npm run validate` | comprueba que todas las anclas resuelven y avisa de las que necesitan revisión |
| `npm run refs:refresh` | vuelve a sellar hash y fecha **después** de revisar un cambio (nunca a ciegas: silencia el aviso) |
| `npm run fix:apartados` | separa en párrafos los apartados que quedaron pegados en una ingesta |
| `node scripts/migrate-notebooks.mjs` | migración puntual de cuadernos con `excerpt` a referencias |

El cuaderno personal del navegador se apoya en el endpoint
`/api/vigencia.json`, que publica por ley el estado, la fecha de caducidad y la
última fecha en que cambió cada artículo.

## Fichas de documentos de centro (`data/center-docs/*.json`)

Una ficha por documento (PEC, PGA, Plan de Mejora…) que recoge lo que la
normativa dice sobre él. Usa las mismas referencias con ancla de la sección
anterior; no guarda texto de las leyes.

```jsonc
{
  "id": "pec",
  "slug": "pec",
  "order": 1,                        // orden en el índice del apartado
  "short": { "es": "PEC", "va": "PEC" },
  "title": { "es": "…", "va": "…" },
  "description": { "es": "…", "va": "…" },
  "terms": ["proyecto educativo", "projecte educatiu"],   // para el cribado
  "updatedAt": "2026-08-19",
  "refs": [ /* Ref[], en el orden en que se quieren leer */ ],
  "discarded": [
    { "law": "decreto-2-2022", "article": "*", "reason": "Fuera de ámbito" },
    { "law": "orden-8-2026", "article": "art-8", "apartado": "1", "reason": "Mención de pasada" }
  ]
}
```

`discarded` no es papeleo: es lo que impide que el cribado de cada ingesta
vuelva a preguntar por lo mismo. `article: "*"` descarta la ley entera.

### Los cuatro bloques de la ficha

`src/lib/center-docs.ts` reparte las referencias sin que haya que etiquetarlas:

| Bloque | Regla |
|---|---|
| Marco estatal | `territory: "estatal"` y `temporality: permanente` |
| Normativa autonómica | `territory: "autonomico"` y `temporality: permanente` |
| Este curso | `temporality: anual` con `expiresDate` en el futuro |
| Cursos anteriores | `temporality: anual` ya vencido — se pliega en un `<details>` |

Lo anual cae solo al histórico cuando pasa su fecha: nadie tiene que acordarse
en septiembre de mover nada.

### Cribar una ley contra una ficha

```bash
node scripts/refs-triage.mjs pec                    # candidatos sin decidir
node scripts/refs-triage.mjs pec --ley ley-5-2026   # solo una ley
node scripts/refs-triage.mjs pec --all              # incluye los ya decididos
```
