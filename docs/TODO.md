# Estado del Proyecto - Legis CPM

## Fase Actual: 9 (Pulido) - COMPLETADA PARCIALMENTE

## Fases

- [x] **Fase 0**: Scaffolding Astro + docs + GitHub Actions
- [x] **Fase 1**: Layout base + i18n + navegación
- [x] **Fase 2**: Modelo datos + primera ley ejemplo (Decreto 158/2007)
- [x] **Fase 3**: Catálogo de legislación (home)
- [x] **Fase 4**: Lector de legislación (sidebar + contenido + versiones básico)
- [x] **Fase 5**: Sistema de versiones (selector integrado en ArticleContent)
- [x] **Fase 6**: Análisis jurídico (panel LegalAnalysis bajo el contenido)
- [x] **Fase 7**: Búsqueda (índice JSON + búsqueda cliente sin dependencias externas)
- [ ] **Fase 8**: Ingesta de leyes reales (PDFs del DOGV, asistida por Claude)
- [x] **Fase 9**: Pulido, accesibilidad, descargas

## Extras completados (fuera de plan original)

- [x] Versión counter en header (v0.1.0)
- [x] Disclaimer legal y aviso de proyecto personal
- [x] Contacto: email, GitHub issues, ko-fi
- [x] Página de changelog (ES/VA) con data/changelog.json
- [x] Enlace al changelog bajo la barra de búsqueda
- [x] Preferencia de idioma guardada en localStorage

## Fase 9 - Detalle

- [x] Botones de descarga: JSON, MD consolidado, MD con historial (DownloadButtons.astro + markdown-export.ts)
- [x] Skip link ("Saltar al contenido")
- [x] Focus visible global (:focus-visible con outline)
- [x] ARIA: landmarks, aria-label en navs, aria-label en botones de descarga
- [x] Contraste: mejorado en footer (disclaimer, links, copyright)
- [x] Soporte prefers-reduced-motion
- [ ] Optimización rendimiento (evaluar cuando haya más leyes)

## Próximos Pasos

### Fase 8 - Ingesta de leyes reales
- [x] Script de validación (`npm run validate`)
- [x] Plantilla de prompt y checklist en CONTENT-GUIDE.md
- [x] Registro de leyes (`data/metadata/law-registry.json`)
- [ ] Ingerir leyes reales desde PDFs del DOGV (asistida por Claude)
- [ ] Actualizar cross-references bidireccionales
- [ ] Reemplazar ley de ejemplo (decreto-158-2007) con datos reales

## Notas

- El proyecto usa Astro 6.x (Node.js >= 22)
- Deploy automático via GitHub Actions en push a main
- URL: https://JLMirallesB.github.io/legis_cpmdem/
- Ley de ejemplo: Decreto 158/2007 (datos ficticios pero estructura real)
- Búsqueda: índice JSON generado en build, búsqueda client-side sin FlexSearch (suficiente para 20-50 leyes)
