import { build } from '../apps/web-react/node_modules/esbuild/lib/main.js';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { installPineCompatibility } from '../packages/openfund-charts/src/pine-compatibility.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const asset = 'assets/vela-workspace.global.min.js';
const addonPath = path.join(root, 'apps/web-react/node_modules/@luxalgo/vela-pinets/dist/index.js');
const addon = await readFile(addonPath, 'utf8');
const embedded = addon.match(/^var worker_default = (.+);$/m);
if (!embedded) throw new Error('Pine addon changed: review the worker extraction');
const worker = vm.runInNewContext(embedded[1]);
/* Minified identifiers change between addon releases (0.3.2: Nr / y0, 0.3.4:
   Dr / q0), so both anchors are located structurally. Each must match exactly
   once, otherwise the build stops and the insertion is reviewed by hand. */
const markers = [...worker.matchAll(/var (\w+)=self,/g)];
const indicators = [...worker.matchAll(/[,;](\w+)=class \w+\{constructor\(e,n=\{\}\)\{\w+\(this,"source"\),\w+\(this,"inputs"\),\w+\(this,"_prepared",null\)/g)];
if (markers.length !== 1 || indicators.length !== 1) throw new Error('Pine worker changed: review compatibility insertion');
const marker = `var ${markers[0][1]}=self`;
const indicator = indicators[0][1];
if (worker.split(marker).length !== 2 || !worker.includes(`${indicator}.from(t)`) || !/\bprepare\(/.test(worker)) throw new Error('Pine worker changed: review compatibility insertion');
const patchedWorker = worker.replace(marker, `(${installPineCompatibility.toString()})(${indicator});${marker}`);
const workerAsset = 'assets/openfund-pine-worker.min.js';
await writeFile(path.join(root, `apps/web-react/public/${workerAsset}`), patchedWorker);
await build({
  absWorkingDir: root,
  entryPoints: ['packages/openfund-charts/src/workspace-entry.ts'],
  outfile: `apps/web-react/public/${asset}`,
  bundle: true,
  format: 'iife',
  globalName: 'VelaWorkspace',
  minify: true,
  target: 'es2022',
  supported: { 'template-literal': false },
  loader: { '.pine': 'text' },
  nodePaths: [path.join(root, 'apps/web-react/node_modules')],
  alias: { '@luxalgo/vela/plugin': path.join(root, 'vendor/vela/src/plugin.ts') },
  legalComments: 'eof',
  plugins: [{
    name: 'hosted-pine-worker',
    setup(builder) {
      builder.onLoad({ filter: /vela-pinets\/dist\/index\.js$/ }, () => ({
        contents: addon.replace(embedded[0], 'var worker_default = "";'), loader: 'js',
        resolveDir: path.dirname(addonPath),
      }));
    },
  }],
});
await mkdir(path.join(root, 'dist/assets'), { recursive: true });
await copyFile(path.join(root, `apps/web-react/public/${asset}`), path.join(root, `dist/${asset}`));
await copyFile(path.join(root, `apps/web-react/public/${workerAsset}`), path.join(root, `dist/${workerAsset}`));
for (const [source, targets] of [
  ['packages/openfund-charts/src/vela-bridge.js', ['apps/web-react/public/legacy/vela-bridge.js', 'dist/vela-bridge.js']],
  ['packages/openfund-gains-adapter/src/gains-adapter.js', ['apps/web-react/public/legacy/gains-adapter.js', 'dist/gains-adapter.js']],
]) {
  for (const target of targets) await copyFile(path.join(root, source), path.join(root, target));
}
for (const target of ['apps/web-react/public/assets/notices', 'dist/assets/notices']) {
  await mkdir(path.join(root, target), { recursive: true });
  for (const [source, name] of [
    ['apps/web-react/node_modules/pinets/LICENSE', 'PineTS-AGPL-3.0.txt'],
    ['apps/web-react/node_modules/@luxalgo/vela-pinets/LICENSE', 'Vela-PineTS-AGPL-3.0.txt'],
    ['vendor/vela/NOTICE', 'Vela-NOTICE.txt'],
    ['vendor/vela/LICENSE', 'Vela-Apache-2.0.txt'],
  ]) await copyFile(path.join(root, source), path.join(root, target, name));
/* MetaMask SDK (ConsenSys licence: prominent notice required) ships only in the
   React build; its notice lives in apps/web-react/public/assets/notices and is
   maintained by hand from apps/web-react/node_modules/@metamask/sdk/LICENSE. */
}
console.log('Built shared Vela workspace, Pine worker, local libraries and chart adapters.');
