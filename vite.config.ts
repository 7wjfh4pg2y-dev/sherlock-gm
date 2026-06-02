import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build works whether served from a domain root
  // or a GitHub Pages project subpath (e.g. /sherlock-gm/).
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
