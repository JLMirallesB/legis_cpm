# Estado del Proyecto - Legis CPM

## Fase Actual: 5 (Sistema de versiones) - EN PROGRESO

## Fases

- [x] **Fase 0**: Scaffolding Astro + docs + GitHub Actions
- [x] **Fase 1**: Layout base + i18n + navegaci&oacute;n
- [x] **Fase 2**: Modelo datos + primera ley ejemplo (Decreto 158/2007)
- [x] **Fase 3**: Cat&aacute;logo de legislaci&oacute;n (home)
- [x] **Fase 4**: Lector de legislaci&oacute;n (sidebar + contenido + versiones b&aacute;sico)
- [x] **Fase 5**: Sistema de versiones (selector integrado en ArticleContent)
- [ ] **Fase 6**: An&aacute;lisis jur&iacute;dico (panel LegalAnalysis)
- [ ] **Fase 7**: B&uacute;squeda (FlexSearch)
- [ ] **Fase 8**: Ingesta de leyes reales (PDFs del DOGV, asistida por Claude)
- [ ] **Fase 9**: Pulido, accesibilidad, optimizaci&oacute;n

## Extras completados (fuera de plan original)

- [x] Versi&oacute;n counter en header (v0.1.0)
- [x] Disclaimer legal y aviso de proyecto personal
- [x] Contacto: email, GitHub issues, ko-fi
- [x] P&aacute;gina de changelog (ES/VA) con data/changelog.json
- [x] Enlace al changelog bajo la barra de b&uacute;squeda
- [x] Preferencia de idioma guardada en localStorage

## Pr&oacute;ximos Pasos

### Fase 6 - An&aacute;lisis jur&iacute;dico
- [ ] Crear componente LegalAnalysis.astro
- [ ] Integrar en LawReaderLayout como secci&oacute;n/pesta&ntilde;a
- [ ] Enlaces cruzados entre normas del sistema

### Fase 7 - B&uacute;squeda
- [ ] Instalar FlexSearch
- [ ] Script build-search-index.ts
- [ ] Implementar b&uacute;squeda en cliente
- [ ] P&aacute;gina de resultados con fragmentos resaltados

### Fase 8 - Ingesta de leyes reales
- [ ] Recibir PDFs del DOGV del usuario
- [ ] Parsear, separar idiomas, generar JSONs
- [ ] Cargar 20-50 leyes reales

## Notas

- El proyecto usa Astro 6.x
- Deploy autom&aacute;tico via GitHub Actions en push a main
- URL: https://JLMirallesB.github.io/legis_cpm/
- Ley de ejemplo: Decreto 158/2007 (datos ficticios pero estructura real)
