/**
 * Browser half: a CJS bundle wrapped in the DSH client module-loader factory.
 * Mirrors packages/client/tsdown.client.ts in deepseek-harness (banner/intro/footer),
 * which third-party packages cannot import. tests/artifact.test.ts pins the shape.
 */
import { build } from 'tsdown'
import { PLUGIN_ID } from '../src/constants.ts'

await build({
  config: false,
  entry: { client: 'src/client/index.ts' },
  format: 'cjs',
  platform: 'browser',
  outDir: 'lib',
  clean: false,
  dts: false,
  sourcemap: false,
  minify: true,
  deps: { neverBundle: ['react', 'react/jsx-runtime', '@deepseek-ai/cordis'] },
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  outputOptions: {
    entryFileNames: 'client.js',
    // post* wrappers are added after minification, so the handoff stays byte-identical
    // to the host preset's banner/intro/footer while the body is minified.
    postBanner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {\n`
      + 'var module = { exports: {} }; var exports = module.exports;',
    postFooter: 'return module.exports; } });',
  },
})
