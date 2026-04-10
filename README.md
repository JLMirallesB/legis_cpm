<p align="center">
  <img src="public/icons/icon-512.png" alt="Legis CPMDEM" width="180" />
</p>

<h1 align="center">Legis CPMDEM</h1>

<p align="center">
  Lector de legislaci&oacute;n de <strong>Conservatorios Profesionales de M&uacute;sica y Danza</strong> y <strong>Escuelas de M&uacute;sica</strong> de la Generalitat Valenciana.
</p>

<p align="center">
  <a href="https://JLMirallesB.github.io/legis_cpmdem/">Acceder a la aplicaci&oacute;n</a> &middot;
  <a href="https://JLMirallesB.github.io/legis_cpmdem/es/changelog/">Novedades</a> &middot;
  <a href="https://ko-fi.com/miralles">Inv&iacute;tame a una orxata</a>
</p>

---

## Sobre el proyecto

Legis CPMDEM recopila, estructura y presenta la normativa vigente que regula los conservatorios profesionales de m&uacute;sica y danza y las escuelas de m&uacute;sica de la Comunitat Valenciana. Toda la legislaci&oacute;n se ofrece en **castellano y valenciano**, con navegaci&oacute;n biling&uuml;e autom&aacute;tica seg&uacute;n el idioma del navegador.

El proyecto nace de la necesidad de tener un acceso r&aacute;pido, organizado y actualizado a una normativa dispersa entre el DOGV y el BOE, con textos consolidados que reflejan las modificaciones vigentes.

**No es una publicaci&oacute;n oficial** de la Generalitat Valenciana. Es un proyecto personal de Jos&eacute; Luis Miralles Bono, profesor de conservatorio.

## Funcionalidades

### Cat&aacute;logo y navegaci&oacute;n
- **39 normas ingresadas** entre decretos, &oacute;rdenes, leyes org&aacute;nicas, reales decretos, resoluciones, circulares y documentos
- Navegaci&oacute;n por **categor&iacute;as**: curr&iacute;culo, organizaci&oacute;n, evaluaci&oacute;n, acceso, profesorado, titulaciones, flexibilizaci&oacute;n, premios, etc.
- **Etiquetas de clasificaci&oacute;n**: aplicaci&oacute;n (M&uacute;sica, Danza, General), &aacute;mbito (Estatal, Auton&oacute;mico), periodo (Permanente, Anual) y tipo documental
- **Buscador** con filtros m&uacute;ltiples: por tipo de norma, publicaci&oacute;n, a&ntilde;o, firmante, cargo, &aacute;mbito, etc.

### Lectura y estudio
- Texto completo de cada norma con **&iacute;ndice lateral de navegaci&oacute;n** (art&iacute;culos, cap&iacute;tulos, disposiciones, anexos)
- **Versiones de art&iacute;culos**: selector visual para comparar la redacci&oacute;n original con las modificaciones posteriores
- **Texto consolidado**: los art&iacute;culos modificados muestran la versi&oacute;n vigente con acceso a versiones anteriores
- **An&aacute;lisis jur&iacute;dico**: afectaciones anteriores y posteriores, derogaciones, concordancias y norma habilitante
- **Cl&aacute;usula de promulgaci&oacute;n**: lugar, fecha y firmantes de cada norma
- Tablas de distribuci&oacute;n horaria y ratios renderizadas desde markdown
- **Auto-linking**: las URLs en el texto son clicables autom&aacute;ticamente

### Herramientas de trabajo
- **Cuaderno de fragmentos**: selecciona texto de cualquier art&iacute;culo y gu&aacute;rdalo en un panel persistente. Permite reordenar, eliminar y copiar con referencias
- **Exportaci&oacute;n a PDF** del cuaderno: agrupaci&oacute;n por ley, citas APA al pie de cada fragmento y secci&oacute;n de referencias bibliogr&aacute;ficas completas
- **Citas APA 7**: bot&oacute;n &laquo;Citar APA&raquo; en cada ley con cita parent&eacute;tica o referencia completa. Al seleccionar texto se puede copiar la cita con el fragmento entrecomillado
- **Compartir**: copiar enlace, email, WhatsApp y c&oacute;digo embed (iframe) por ley o por art&iacute;culo individual
- **Descargas**: JSON original y Markdown (consolidado o con historial de versiones)
- **Modelos de solicitud**: descarga directa de formularios PDF oficiales cuando la norma los incluye

### Novedades y suscripci&oacute;n

La secci&oacute;n de [Novedades](https://JLMirallesB.github.io/legis_cpmdem/es/changelog/) muestra el historial completo de versiones con las normativas a&ntilde;adidas y las mejoras de la aplicaci&oacute;n.

- **Suscripci&oacute;n RSS**: bot&oacute;n naranja en la p&aacute;gina de novedades para suscribirse al feed y recibir actualizaciones en tu lector RSS favorito
- **Anunciar novedades**: cada versi&oacute;n tiene un bot&oacute;n para copiar al portapapeles un resumen listo para pegar en WhatsApp, email o donde quieras

## Tecnolog&iacute;a

- **Astro 6** &mdash; Sitio 100% est&aacute;tico, sin backend ni base de datos
- **TypeScript** &mdash; Tipado estricto en todo el c&oacute;digo
- **JSON** &mdash; Datos legislativos en archivos JSON plano biling&uuml;es (`data/laws/es/`, `data/laws/va/`)
- **GitHub Pages** &mdash; Despliegue autom&aacute;tico en cada push a main
- **PWA** &mdash; Manifest e iconos para instalaci&oacute;n en m&oacute;vil

## MCP Server (avanzado)

Legis CPMDEM incluye un **servidor MCP** (Model Context Protocol) que permite consultar la legislaci&oacute;n desde Claude Desktop, Claude Code u otros clientes MCP compatibles.

### Herramientas disponibles

| Herramienta | Descripci&oacute;n |
|---|---|
| `list_laws` | Listar todas las leyes con filtros opcionales (categor&iacute;a, &aacute;mbito, tipo) |
| `get_law` | Obtener metadatos y estructura completa de una ley |
| `get_article` | Leer el contenido completo de un art&iacute;culo espec&iacute;fico |
| `search_articles` | Buscar texto en todas las leyes (devuelve snippets con contexto) |
| `get_changelog` | Consultar las novedades recientes |
| `get_article_versions` | Ver el historial de versiones de un art&iacute;culo modificado |

### Configuraci&oacute;n

1. Clona el repositorio:
   ```bash
   git clone https://github.com/JLMirallesB/legis_cpmdem.git
   ```

2. Instala las dependencias del MCP server:
   ```bash
   cd legis_cpmdem/mcp-server
   npm install
   ```

3. A&ntilde;ade la configuraci&oacute;n a tu cliente MCP. Por ejemplo, en Claude Desktop (`claude_desktop_config.json`):
   ```json
   {
     "mcpServers": {
       "legis-cpmdem": {
         "command": "npx",
         "args": ["tsx", "mcp-server/src/index.ts"],
         "cwd": "/ruta/a/legis_cpmdem"
       }
     }
   }
   ```

4. Reinicia Claude Desktop. Las herramientas de Legis CPMDEM aparecer&aacute;n disponibles autom&aacute;ticamente.

## Desarrollo local

```bash
git clone https://github.com/JLMirallesB/legis_cpmdem.git
cd legis_cpmdem
npm install
npm run dev       # Servidor de desarrollo
npm run validate  # Validar datos JSON
npm run build     # Compilar sitio est&aacute;tico
```

Requisitos: Node.js >= 22.12.0

## Documentaci&oacute;n

Ver la carpeta `docs/` para documentaci&oacute;n detallada:

- [Arquitectura](docs/ARCHITECTURE.md)
- [Esquema de datos](docs/DATA-SCHEMA.md)
- [Componentes](docs/COMPONENTS.md)
- [Gu&iacute;a de contenido](docs/CONTENT-GUIDE.md)
- [Deploy](docs/DEPLOYMENT.md)
- [Decisiones](docs/DECISIONS.md)

## Legislaci&oacute;n pendiente de incorporar

Por orden de prioridad:

1. **Admisi&oacute;n y pruebas de acceso** &mdash; Esperando actualizaci&oacute;n normativa antes de introducirlas
2. ~~**Convalidaciones y equivalencias**~~ &mdash; Instrucciones de convalidaciones m&uacute;sica/danza-bachillerato ingresadas. Pendiente: normativa general sobre reconocimiento de estudios
3. ~~**Plantillas**~~ &mdash; &#10004; Orden 9/2025 (criterios generales) e Instrucciones plantillas conservatorios 2026/2027
4. **Danza (normativa nacional)** &mdash; Reales decretos espec&iacute;ficos de ense&ntilde;anzas profesionales de danza
5. ~~**Convivencia**~~ &mdash; &#10004; Decreto 193/2025 de convivencia en el sistema educativo
6. **Protecci&oacute;n de datos y TIC** &mdash; Normativa sobre privacidad, protecci&oacute;n de datos y uso de tecnolog&iacute;as en centros educativos
7. **Escuelas de M&uacute;sica** &mdash; Regulaci&oacute;n completa de las escuelas de m&uacute;sica (falta completamente)
8. **Conservatorios Superiores** &mdash; Normativa de ense&ntilde;anzas art&iacute;sticas superiores (falta completamente)

## Licencia

MIT

---

<p align="center">
  Proyecto de <a href="mailto:jl.mirallesbono@edu.gva.es">Jos&eacute; Luis Miralles Bono</a> &middot;
  <a href="https://ko-fi.com/miralles">Ko-fi</a>
</p>
