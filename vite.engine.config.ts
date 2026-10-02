import { defineConfig } from 'vite';

// Standalone sound engine for any web page:
//   dist/engine/focus-clay-engine.js   (IIFE → global `FocusClay`, use with a <script> tag)
//   dist/engine/focus-clay-engine.mjs  (ES module)
//   dist/engine/index.html             (demo, copied from engine-demo/)
export default defineConfig({
  publicDir: 'engine-demo',
  build: {
    outDir: 'dist/engine',
    emptyOutDir: true,
    lib: {
      entry: 'src/engine/index.ts',
      name: 'FocusClay',
      formats: ['iife', 'es'],
      fileName: (format) => (format === 'es' ? 'focus-clay-engine.mjs' : 'focus-clay-engine.js'),
    },
  },
});
