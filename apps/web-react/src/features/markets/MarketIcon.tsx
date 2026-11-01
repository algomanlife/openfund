/* Reusable market-asset icon — the same verified identity map the landing
 * market table uses (12 curated brand marks + a neutral per-category letter
 * fallback). No fabricated logos: instruments without a curated mark get the
 * consistent Openfund fallback. */
import type { CategoryKey } from './marketsData'

type IconDef = { bg: string; body: React.ReactNode }

/* Byte-faithful ports of public/legacy/market.js `icons` (brand colors are
   the assets' own, preserved in dark AND light themes). */
const ICONS: Record<string, IconDef> = {
  BTC: { bg: '#F7931A', body: <path d="M7.4 6.5h5.1a2.4 2.4 0 0 1 .6 4.7 2.6 2.6 0 0 1-.7 5.2H7.4zM9 11.2h3.3a1.1 1.1 0 1 0 0-2.2H9zm0 4.5h3.5a1.2 1.2 0 1 0 0-2.4H9z" fill="#fff" /> },
  ETH: { bg: '#627EEA', body: <path d="M12 4.5 7.5 12 12 14.6zM12 15.9 7.5 13.2 12 19.5zM12 4.5l4.5 7.5L12 14.6z" fill="#fff" opacity=".95" /> },
  SOL: { bg: '#111827', body: <path d="M7 8.2h10l-2.4 2.4H4.6zM7 13.4h10l-2.4 2.4H7.4zM15.4 8.2h2.4L12.4 15.8H10z" fill="#9945FF" /> },
  DOGE: { bg: '#C2A633', body: <text x="12" y="16.6" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">Ð</text> },
  EUR: { bg: '#2563EB', body: <text x="12" y="16.6" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">€</text> },
  GBP: { bg: '#7A5CC4', body: <text x="12" y="16.6" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">£</text> },
  JPY: { bg: '#C0392B', body: <text x="12" y="16.6" textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">¥</text> },
  XAU: { bg: '#B08D3E', body: <text x="12" y="16.4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">Au</text> },
  XAG: { bg: '#7D8B99', body: <text x="12" y="16.4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">Ag</text> },
  NVDA: { bg: '#33312E', body: <text x="12" y="16.6" textAnchor="middle" fontSize="11" fontWeight="700" fill="#76B900" fontFamily="Ubuntu,sans-serif">N</text> },
  AAPL: { bg: '#2E2E2E', body: <path d="M15.6 12.9c0-1.9 1.6-2.8 1.6-2.9-.9-1.3-2.2-1.4-2.7-1.5-1.2-.1-2.3.7-2.9.7s-1.5-.7-2.5-.7c-1.3 0-2.5.8-3.1 2-1.3 2.3-.3 5.7 1 7.5.6.9 1.4 1.9 2.4 1.8.9 0 1.3-.6 2.4-.6s1.5.6 2.5.6 1.7-.9 2.3-1.8c.7-1 1-2 1-2.1-.1 0-2-.8-2-3zm-1.9-6.2c.5-.6.8-1.4.7-2.2-.7.1-1.6.5-2.1 1.1-.5.5-.9 1.4-.7 2.1.8.1 1.6-.4 2.1-1z" fill="#fff" /> },
  TSLA: { bg: '#2B2B2B', body: <text x="12" y="16.6" textAnchor="middle" fontSize="11" fontWeight="700" fill="#E82127" fontFamily="Ubuntu,sans-serif">T</text> },
  SPY: { bg: '#1F3A5F', body: <text x="12" y="16.4" textAnchor="middle" fontSize="10" fontWeight="700" fill="#F5B942" fontFamily="Ubuntu,sans-serif">S&P</text> },
}

const CATEGORY_BG: Record<string, string> = {
  crypto: '#2f7d5c', forex: '#3D6BE8', stocks: '#8a5cf6', indices: '#B08D3E', commodities: '#c96a1d',
}

export function MarketIcon({ base, group, size = 24, className }: {
  base: string; group?: string; size?: number; className?: string
}) {
  const def = ICONS[base]
  const bg = def ? def.bg : CATEGORY_BG[group || ''] || '#33402f'
  const letter = (base[0] || '?').toUpperCase()
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="11" fill={bg} />
      {def ? def.body : (
        <text x="12" y="16.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="Ubuntu,sans-serif">{letter}</text>
      )}
    </svg>
  )
}

/* Featured constellation for the hero animation — real Gains symbols only. */
export const FEATURED_BASES = ['BTC', 'ETH', 'SOL', 'DOGE', 'EUR', 'GBP', 'JPY', 'NVDA', 'AAPL', 'TSLA', 'SPY', 'XAU'] as const
