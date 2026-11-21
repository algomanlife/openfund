/* Brand wordmark: the single source of truth for the text rendered next to
   the logo mark. Company-name copy inside sentences, page titles, legal text
   and certificates keep the company name and do not use this constant.
   Legacy HTML templates carry BRAND_WORDMARK_TOKEN and receive the value
   through withBrandWordmark() when React mounts them. */
export const BRAND_WORDMARK = 'OpenFi'
export const BRAND_WORDMARK_TOKEN = '{{BRAND_WORDMARK}}'

export function withBrandWordmark(html: string): string {
  return html.replaceAll(BRAND_WORDMARK_TOKEN, BRAND_WORDMARK)
}
