export { VelaWorkspace } from '../../../vendor/vela/src/workspace/VelaWorkspace';
import { PineWorkerEngine } from '@luxalgo/vela-pinets';
import { createCatalog, createLibraryResolver } from './pine-sources.mjs';
import { preserveUnknownVolume } from './pine-data.mjs';
import { registerRendererDefaults } from '../../../vendor/vela/src/plugin';
import { registerLocale } from '../../../vendor/vela/src/core/i18n/registry';
import ar from '../../../vendor/vela/src/locales/ar';
import ru from '../../../vendor/vela/src/locales/ru';
import zhHans from '../../../vendor/vela/src/locales/zh-Hans';
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
registerLocale(ar);
registerLocale(ru);
registerLocale(zhHans);
registerLocale({locale:'fa',direction:'rtl',messages:{
  'chart.legend.showLegend':'نمایش راهنمای اندیکاتورها',
  'chart.legend.hideLegend':'پنهان کردن راهنمای اندیکاتورها',
  'chart.legend.indicators':'اندیکاتورها',
  'chart.legend.settings':'تنظیمات',
  'chart.legend.remove':'حذف اندیکاتور',
  'chart.pane.mainChart':'نمودار اصلی',
  'chart.paneControls.collapse':'جمع کردن پنل',
  'chart.paneControls.expand':'باز کردن پنل',
  'chart.paneControls.maximize':'بزرگ‌نمایی پنل',
  'chart.paneControls.restore':'بازگردانی پنل',
}});

export const indicators = createCatalog(openAlgo, pac, smc);
export const createPineEngine = () => preserveUnknownVolume(new PineWorkerEngine({
  importResolver,
  workerUrl: new URL('assets/openfund-pine-worker.min.js', document.baseURI).href,
}));

/* Footprint (Hyperliquid order flow on the Gains chart). Registration is NOT a
   side effect of loading this bundle: the host calls installFootprint() before
   mounting the workspace, and only when the footprint feature flag is on. */
export { installFootprint, footprintDiagnostics } from './footprint/plugin';
registerLocale({locale:'fa',direction:'rtl',messages:{
  'footprint.title':'فوت‌پرینت',
  'footprint.overlay.title':'فوت‌پرینت (لایه جریان سفارش)',
  'footprint.source':'فوت‌پرینت · Hyperliquid {coin}',
  'footprint.state.loading':'در حال بارگذاری جریان سفارش…',
  'footprint.state.live':'زنده',
  'footprint.state.warn':'اختلاف قیمت با نمودار بیش از حد معمول است',
  'footprint.state.hide':'پنهان: قیمت‌ها با نمودار قابل مقایسه نیستند',
  'footprint.state.stale':'اتصال قطع شده — داده زنده نیست',
  'footprint.state.calibrating':'در حال بررسی سازگاری قیمت…',
  'footprint.state.unsupported':'برای این بازار در دسترس نیست',
  'footprint.state.error':'سرویس جریان سفارش در دسترس نیست',
  'footprint.basis':'{bps} نقطه پایه نسبت به نمودار',
}});
