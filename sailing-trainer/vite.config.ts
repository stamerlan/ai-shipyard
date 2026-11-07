import { defineConfig } from 'vite';

// Relative base so the build works from any sub-path (e.g. GitHub Pages /<repo>/).
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
});
