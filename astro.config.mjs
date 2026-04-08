// @ts-check
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://JLMirallesB.github.io',
  base: '/legis_cpmdem/',
  output: 'static',
  trailingSlash: 'always',
  build: {
    format: 'directory'
  }
});
