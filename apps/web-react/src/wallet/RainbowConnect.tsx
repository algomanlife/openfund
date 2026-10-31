import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useBalance } from 'wagmi'
import { formatUnits } from 'viem'

/**
 * Bilingual (fa/en) custom connect button — landing button system style.
 * Connection only: disconnect / account switch / network status. No txs.
 * The RainbowKit modal itself stays in English (fa is not a built-in
 * RainbowKit locale) — trigger and account surfaces are fully translated.
 */
export function RainbowConnect() {
  const { address, chain, chainId } = useAccount()
  const { data: balance } = useBalance({ address, chainId })
  const isFa = (window as any).ofLang !== 'en'

  const fmtAddr = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '')
  const fmtBal = () => {
    if (!balance) return ''
    const v = Number(formatUnits(balance.value, balance.decimals))
    return `${v.toFixed(3)} ${balance.symbol}`
  }
  const onSepolia = chain?.id === 421614

  return (
    <ConnectButton.Custom>
      {({ account, chain: rkChain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && rkChain
        return (
          <div
            aria-hidden={!mounted}
            className='rk-wrap'
            style={{ display: 'flex', gap: 8, alignItems: 'center', direction: 'ltr' }}
          >
            {!connected ? (
              <button onClick={openConnectModal} type='button' className='rk-btn'>
                <svg viewBox='0 0 16 16' width='12' height='12' fill='none' aria-hidden='true'>
                  <path d='M2 4.5A2.5 2.5 0 0 1 4.5 2H12a1 1 0 0 1 1 1v1.5M2 4.5V12a2 2 0 0 0 2 2h9.5a.5.5 0 0 0 .5-.5v-7a.5.5 0 0 0-.5-.5H4.5A2.5 2.5 0 0 1 2 4.5Z' stroke='currentColor' strokeWidth='1.3' />
                  <circle cx='11.5' cy='10' r='1' fill='currentColor' />
                </svg>
                {isFa ? 'اتصال کیف پول' : 'Connect Wallet'}
              </button>
            ) : (
              <>
                <button onClick={openChainModal} type='button' className='rk-btn rk-net'>
                  <i className={onSepolia ? 'dot dot-live' : 'dot dot-info'} />
                  {chain?.name || (isFa ? 'آربیترام سپولیا' : 'Arbitrum Sepolia')}
                </button>
                <button onClick={openAccountModal} type='button' className='rk-btn rk-acct'>
                  <span className='rk-bal'>{fmtBal()}</span>
                  <span className='rk-addr'>{fmtAddr(address)}</span>
                </button>
              </>
            )}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}
