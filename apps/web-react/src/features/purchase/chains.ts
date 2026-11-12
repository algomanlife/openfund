/* Display names and public block explorers for the networks DePay supports
   (https://depay.com/docs/payments/supported/blockchains). Labels only: the
   networks a payment may use come from the server/DePay configuration. */
interface ChainInfo { label: string, explorer: string }
const BY_ID: Record<number, ChainInfo> = {
  1: { label: 'Ethereum', explorer: 'https://etherscan.io/tx/' },
  56: { label: 'BNB Smart Chain', explorer: 'https://bscscan.com/tx/' },
  137: { label: 'Polygon', explorer: 'https://polygonscan.com/tx/' },
  43114: { label: 'Avalanche', explorer: 'https://snowtrace.io/tx/' },
  100: { label: 'Gnosis', explorer: 'https://gnosisscan.io/tx/' },
  42161: { label: 'Arbitrum One', explorer: 'https://arbiscan.io/tx/' },
  10: { label: 'Optimism', explorer: 'https://optimistic.etherscan.io/tx/' },
  8453: { label: 'Base', explorer: 'https://basescan.org/tx/' },
  480: { label: 'World Chain', explorer: 'https://worldscan.org/tx/' },
  501: { label: 'Solana', explorer: 'https://solscan.io/tx/' },
  11155111: { label: 'Ethereum Sepolia', explorer: 'https://sepolia.etherscan.io/tx/' },
}
const BY_NAME: Record<string, number> = {
  ethereum: 1, bsc: 56, polygon: 137, avalanche: 43114, gnosis: 100, arbitrum: 42161,
  optimism: 10, base: 8453, worldchain: 480, solana: 501,
}
const resolve = (chain: number | string | null | undefined) =>
  typeof chain === 'number' ? chain : chain ? BY_NAME[String(chain).toLowerCase()] ?? Number(chain) : NaN

export function chainLabel(chain: number | string | null | undefined): string {
  const id = resolve(chain)
  return BY_ID[id]?.label || (chain == null ? '—' : String(chain))
}
export function txExplorerUrl(chain: number | string | null | undefined, txHash: string): string | null {
  const id = resolve(chain)
  return BY_ID[id] ? BY_ID[id].explorer + txHash : null
}
