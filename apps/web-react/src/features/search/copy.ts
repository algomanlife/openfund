import { text } from '../information/content'
import type { SearchKind } from '../../../../../packages/site-search/index.mjs'

/* Site search copy (ADR 0052): the palette, the header trigger and the
   /:locale/search results page. fa and en are written here; ar, ru and
   zh-CN come from the reviewed dictionaries (src/i18n/content). */
export const searchCopy = {
  open: text('Search', 'جستجو'),
  openHint: text('Search the site (Ctrl K or /)', 'جستجو در سایت (Ctrl K یا /)'),
  dialog: text('Search Openfund', 'جستجو در اوپن‌فاند'),
  placeholder: text('Search pages, help, docs and markets', 'جستجوی صفحه‌ها، راهنما، مستندات و بازارها'),
  close: text('Close search', 'بستن جستجو'),
  recent: text('Recent searches', 'جستجوهای اخیر'),
  clearRecent: text('Clear', 'پاک کردن'),
  loading: text('Loading the search index…', 'در حال بارگذاری فهرست جستجو…'),
  offline: text('Showing pages only: the full index could not be loaded.', 'فقط صفحه‌ها نمایش داده می‌شود: فهرست کامل بارگذاری نشد.'),
  none: text('Nothing matched your search.', 'چیزی با جستجوی شما پیدا نشد.'),
  tryThese: text('You may be looking for', 'شاید دنبال این‌ها باشید'),
  seeAll: text('See all results', 'دیدن همهٔ نتیجه‌ها'),
  keys: text('Use the arrow keys to move, Enter to open, Esc to close.', 'با کلیدهای جهت جابه‌جا شوید، Enter برای باز کردن، Esc برای بستن.'),
  count: text('results', 'نتیجه'),
  title: text('Search', 'جستجو'),
  intro: text('Search pages, help articles, the whitepaper, developer docs and markets.', 'جستجو در صفحه‌ها، مقاله‌های راهنما، وایت‌پیپر، مستندات توسعه‌دهندگان و بازارها.'),
  empty: text('Type at least one word to search.', 'برای جستجو دست‌کم یک واژه بنویسید.'),
  submit: text('Search', 'جستجو'),
  previous: text('Previous page', 'صفحهٔ قبل'),
  next: text('Next page', 'صفحهٔ بعد'),
  page: text('Page', 'صفحهٔ'),
  of: text('of', 'از'),
  filters: text('Filter results', 'پالایش نتیجه‌ها'),
  all: text('All', 'همه'),
}

export const kindLabels: Record<SearchKind, ReturnType<typeof text>> = {
  page: text('Pages', 'صفحه‌ها'),
  content: text('Help and learning', 'راهنما و آموزش'),
  whitepaper: text('Whitepaper', 'وایت‌پیپر'),
  docs: text('Developer docs', 'مستندات توسعه‌دهندگان'),
  market: text('Markets', 'بازارها'),
}
export const KIND_ORDER: SearchKind[] = ['page', 'content', 'whitepaper', 'docs', 'market']
