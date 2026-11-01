/** Build the vendored @luxalgo/journal-core into an importable ESM bundle. */
import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
await build({
  entryPoints: [join(here, 'packages-core/src/index.ts')],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  outfile: join(here, 'dist/index.js'),
  sourcemap: false,
})
console.log('journal-core dist built')
