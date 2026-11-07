import { runtimeCmsUrl } from '../../apps/backend/runtime-config.js';

if (!process.env.CMS_PUBLIC_URL)
  throw Error('Publication requires RELEASE_DIRECTUS_URL.');
const origin = runtimeCmsUrl(process.env, true);
for (const route of [
  '/server/health',
  '/items/ui_messages?fields=key,namespace,translations.language_code,translations.value&filter[status][_eq]=published&limit=1',
  '/items/home_content?fields=status,translations.language_code,translations.headline',
]) {
  const response = await fetch(new URL(route, origin), { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw Error(`Production CMS publication gate: ${route.split('?')[0]} returned ${response.status}.`);
  if (route.startsWith('/items/')) {
    const data = (await response.json()).data;
    const row = Array.isArray(data) ? data[0] : data;
    if (!['fa', 'en'].every(language => row?.translations?.some(t => t.language_code === language)))
      throw Error(`Production CMS publication gate: ${route.split('?')[0]} lacks public fa/en translations.`);
  }
}
console.log('Production CMS public bilingual health, UI and Home reads passed.');
