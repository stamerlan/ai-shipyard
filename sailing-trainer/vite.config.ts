import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';

/** Emit sw.js with the list of every built file, so the app works offline after one visit. */
function serviceWorker(): Plugin {
  return {
    name: 'sailtrainer-sw',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = ['./', './index.html', './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png',
        ...Object.keys(bundle).filter((f) => f !== 'index.html').map((f) => `./${f}`)];
      const version = Date.now().toString(36);
      const src = readFileSync(new URL('./sw-template.js', import.meta.url), 'utf8')
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify([...new Set(files)], null, 2));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

// Relative base so the build works from any sub-path (e.g. GitHub Pages /<repo>/).
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
  plugins: [serviceWorker()],
});
