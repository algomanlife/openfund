import { createElement } from 'react'
import './wordmark.css'
import { BRAND_WORDMARK } from './wordmark'

/** Text wordmark shown beside the logo mark. Always left-to-right and never
 * case-transformed, so it renders exactly as BRAND_WORDMARK. */
export function BrandWordmark({ as = 'span', className }: { as?: 'span' | 'b'; className?: string }) {
  return createElement(as, { dir: 'ltr', className: ['brand-wordmark', className].filter(Boolean).join(' ') }, BRAND_WORDMARK)
}
