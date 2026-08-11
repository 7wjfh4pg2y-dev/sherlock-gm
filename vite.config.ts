import { defineConfig } from 'vite';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// A unique id per build. Baked into the bundle (as __BUILD_ID__) and also
// written to dist/version.json, so a running tab can detect when a newer build
// has been deployed and reload itself. See src/util/autoUpdate.ts.
const BUILD_ID = String(Date.now());

export default defineConfig({
  // Relative base so the build works whether served from a domain root
  // or a GitHub Pages project subpath (e.g. /sherlock-gm/).
  base: './',
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  plugins: [
    {
      name: 'emit-version',
      writeBundle(options) {
        const dir = options.dir ?? 'dist';
        writeFileSync(resolve(dir, 'version.json'), JSON.stringify({ buildId: BUILD_ID }));
      },
    },
  ],
});
