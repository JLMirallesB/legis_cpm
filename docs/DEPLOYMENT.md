# Deployment - Legis CPM

## Despliegue Autom&aacute;tico

El sitio se despliega autom&aacute;ticamente en GitHub Pages cuando se hace push a la rama `main`.

### Pipeline (GitHub Actions)

Archivo: `.github/workflows/deploy.yml`

1. Checkout del c&oacute;digo
2. Setup Node.js 22
3. `npm ci` (instalar dependencias)
4. `npm run build` (build de Astro)
5. Upload del directorio `dist/` como artefacto
6. Deploy a GitHub Pages

### URL del sitio

`https://JLMirallesB.github.io/legis_cpmdem/`

## Desarrollo Local

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo (hot reload)
npm run dev

# Build de producci&oacute;n
npm run build

# Preview del build
npm run preview
```

## Configuraci&oacute;n Inicial de GitHub Pages

1. Ir al repositorio en GitHub: Settings &rarr; Pages
2. Source: seleccionar **GitHub Actions**
3. El workflow se encarga del resto

## Notas

- `astro.config.mjs` tiene `base: '/legis_cpmdem/'` (con trailing slash) para que las rutas funcionen correctamente en GitHub Pages
- El `site` est&aacute; configurado como `https://JLMirallesB.github.io`
- Todas las rutas internas usan `import.meta.env.BASE_URL` para el prefijo correcto
