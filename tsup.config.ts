import { defineConfig } from 'tsup';

export default defineConfig([
  // Main bundle (includes both Bridgy and BridgyLite, for npm)
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    minify: true,
    sourcemap: true,
    clean: true,
  },
  // Full Bridgy (IIFE for CDN)
  {
    entry: { 'bridgy': 'src/bridge.ts' },
    format: ['iife'],
    globalName: 'Bridger',
    minify: true,
    sourcemap: true,
  },
  // BridgyLite (IIFE for CDN) — includes BridgyLog on window
  {
    entry: { 'bridgy-lite': 'src/lite-entry.ts' },
    format: ['iife'],
    globalName: 'BridgerLite',
    minify: true,
    sourcemap: true,
  },
]);
