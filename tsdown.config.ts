import { defineConfig } from 'tsdown'

/** Host half: ESM lib/index.js loaded by the DSH Loader through exports ".". */
export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: 'esm',
  platform: 'node',
  outDir: 'lib',
  fixedExtension: false,
  dts: false,
  sourcemap: false,
  clean: true,
})
