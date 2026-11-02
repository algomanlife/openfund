export { VelaWorkspace } from '../../../vendor/vela/src/workspace/VelaWorkspace';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { createCatalog, createLibraryResolver } from './pine-sources.mjs';
import { preserveUnknownVolume } from './pine-data.mjs';
import { registerRendererDefaults } from '../../../vendor/vela/src/plugin';
import openAlgo from '../../../indicators/Open algo v5.pine';
import pac from '../../../indicators/pac v1.pine';
import smc from '../../../indicators/smc-v1.pine';
import overlays from '../../../indicators/Overlayslibrary.pine';
import sdk from '../../../indicators/sdk.pine';

const importResolver = createLibraryResolver({
  'openfund/Overlayslibrary/1': overlays,
  'openfund/sdk/1': sdk,
});

// The host displays the equivalent linked NOTICE attribution in terminal status.
registerRendererDefaults({ attribution: false });

export const indicators = createCatalog(openAlgo, pac, smc);
export const createPineEngine = () => preserveUnknownVolume(new PineWorkerEngine({
  importResolver,
  workerUrl: new URL('assets/openfund-pine-worker.min.js', document.baseURI).href,
}));
