# Arquitectura - Legis CPMDEM

## Visi&oacute;n General

Legis CPMDEM es una aplicaci&oacute;n web **100% est&aacute;tica** construida con [Astro](https://astro.build/) y desplegada en GitHub Pages. No tiene backend ni base de datos. Todo el contenido legislativo se almacena en archivos JSON que se procesan en tiempo de build para generar p&aacute;ginas HTML est&aacute;ticas.

## Stack Tecnol&oacute;gico

| Componente | Tecnolog&iacute;a | Prop&oacute;sito |
|------------|------------|-----------|
| Framework | Astro 6.x | Generaci&oacute;n de HTML est&aacute;tico |
| Lenguaje | TypeScript | Tipado del modelo de datos |
| B&uacute;squeda | &Iacute;ndice JSON + JS nativo | B&uacute;squeda cliente full-text (sin dependencias) |
| Hosting | GitHub Pages | Despliegue autom&aacute;tico |
| CI/CD | GitHub Actions | Build + deploy en push a main |

## Flujo de Datos

```
data/laws/{lang}/*.json  &rarr;  Astro (build time)  &rarr;  dist/ (HTML est&aacute;tico)  &rarr;  GitHub Pages
data/metadata/*.json     &rarr;                       &rarr;
src/i18n/{lang}.json     &rarr;                       &rarr;
```

1. Los datos de las leyes est&aacute;n en `data/laws/es/` y `data/laws/va/` como archivos JSON
2. En build time, Astro lee estos JSON y genera p&aacute;ginas HTML para cada ley
3. Endpoints Astro (`/api/search-index-{lang}.json`) generan &iacute;ndices de b&uacute;squeda JSON
4. El resultado se despliega como sitio est&aacute;tico en GitHub Pages
5. La b&uacute;squeda funciona en el cliente cargando el &iacute;ndice JSON bajo demanda

## Estructura de Carpetas

```
legis_cpmdem/
&boxvr;&boxh; astro.config.mjs          # Config Astro (site, base path)
&boxvr;&boxh; src/
&boxv;   &boxvr;&boxh; layouts/                # Layouts HTML (BaseLayout, LawReaderLayout)
&boxv;   &boxvr;&boxh; components/             # Componentes Astro reutilizables
&boxv;   &boxvr;&boxh; pages/                  # P&aacute;ginas (generan rutas)
&boxv;   &boxv;   &boxvr;&boxh; index.astro           # Redirecci&oacute;n por idioma
&boxv;   &boxv;   &boxvr;&boxh; es/                   # P&aacute;ginas en castellano
&boxv;   &boxv;   &boxur;&boxh; va/                   # P&aacute;ginas en valenciano
&boxv;   &boxvr;&boxh; i18n/                   # Traducciones de la interfaz
&boxv;   &boxvr;&boxh; lib/                    # L&oacute;gica TypeScript compartida
&boxv;   &boxur;&boxh; styles/                 # CSS global
&boxvr;&boxh; data/
&boxv;   &boxvr;&boxh; laws/es/                # JSON de leyes en castellano
&boxv;   &boxvr;&boxh; laws/va/                # JSON de leyes en valenciano
&boxv;   &boxur;&boxh; metadata/               # Categor&iacute;as y metadatos
&boxvr;&boxh; public/                   # Assets est&aacute;ticos (favicon)
&boxur;&boxh; docs/                     # Documentaci&oacute;n del proyecto
```

## Sistema de i18n

- Dos idiomas: castellano (es) y valenciano (va)
- Rutas separadas: `/es/ley/slug` y `/va/llei/slug`
- Cadenas de UI en `src/i18n/es.json` y `src/i18n/va.json`
- Contenido de leyes en `data/laws/es/` y `data/laws/va/`
- Detecci&oacute;n autom&aacute;tica del idioma del navegador con fallback a castellano
- Preferencia guardada en localStorage

## Generaci&oacute;n de P&aacute;ginas

Las p&aacute;ginas de leyes (`[slug].astro`) usan `getStaticPaths()` de Astro:
- En build time, lee todos los JSON de `data/laws/{lang}/`
- Genera una p&aacute;gina HTML por cada ley en cada idioma
- No hay routing din&aacute;mico en producci&oacute;n

## Ingesta de Leyes

La importaci&oacute;n de nuevas leyes se hace de forma **asistida por Claude**:
1. El usuario proporciona un PDF del DOGV
2. Claude extrae el texto, separa idiomas, detecta estructura
3. Claude genera/actualiza los JSON correspondientes
4. El usuario revisa y commitea

Ver [CONTENT-GUIDE.md](./CONTENT-GUIDE.md) para m&aacute;s detalles.
