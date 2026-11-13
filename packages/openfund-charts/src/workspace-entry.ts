export { VelaWorkspace } from '../../../vendor/vela/src/workspace/VelaWorkspace';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { createCatalog, createLibraryResolver } from './pine-sources.mjs';
import { preserveUnknownVolume } from './pine-data.mjs';
import { registerRendererDefaults } from '../../../vendor/vela/src/plugin';
/* Openfund host-managed drawing types (live position box, compact BUY/SELL markers) */
import './openfund-drawings';
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
/* The Vela chart UI is English-only and LTR in every Openfund locale: no
   other Vela locale is registered, so no translated (or right-to-left)
   chart chrome can be selected. The host always mounts with locale 'en'. */

export const indicators = createCatalog(openAlgo, pac, smc);
export const createPineEngine = () => preserveUnknownVolume(new PineWorkerEngine({
  importResolver,
  workerUrl: new URL('assets/openfund-pine-worker.min.js', document.baseURI).href,
}));

/* Footprint (Hyperliquid order flow on the Gains chart). Registration is NOT a
   side effect of loading this bundle: the host calls installFootprint() before
   mounting the workspace, and only when the footprint feature flag is on. */
export { installFootprint, footprintDiagnostics } from './footprint/plugin';

