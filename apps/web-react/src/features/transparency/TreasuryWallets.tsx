import { text as t, type Locale } from '../information/content'
import { StateBlock, Status, when, useRemote } from '../economy/ui'

/**
 * Openfund Treasury wallets by network (GET /economy/treasury/networks).
 * The addresses are the payment settlement receivers configured on the
 * server; balances are read on-chain per network and are shown per network
 * only — never summed, never converted to USD and never presented as
 * revenue, profit, payout liquidity or reserves. A network whose read
 * failed shows its last good balances with their read time (stale) or no
 * number at all.
 */
interface Balance { kind: 'native' | 'token', symbol: string | null, name: string | null, decimals: number, contract: string | null, balance: string, contractExplorerUrl: string | null }
interface Network {
  chainId: number, blockchain: string | null, network: string | null, family: 'evm' | 'solana', address: string, explorerUrl: string | null,
  status: 'ok' | 'stale' | 'error' | 'pending', readAt: string | null, attemptedAt: string | null, error: string | null, balances: Balance[]
}
interface View { generatedAt: string, cacheSeconds: number, networks: Network[] }

const NETWORK_NAMES: Record<string, string> = {
  ethereum: 'Ethereum', arbitrum: 'Arbitrum One', base: 'Base', polygon: 'Polygon', optimism: 'OP Mainnet', bsc: 'BNB Smart Chain',
  avalanche: 'Avalanche', gnosis: 'Gnosis', worldchain: 'World Chain', solana: 'Solana',
}
const short = (a: string) => a.length > 16 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a
/* exact decimal string from the server, grouped for reading; never rounded through floats */
const grouped = (v: string) => { const [i, f] = v.split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (f ? '.' + f : '') }

export default function TreasuryWallets({ locale }: { locale: Locale }) {
  const [state] = useRemote<View>('/economy/treasury/networks')
  if (state.status !== 'ready') return <StateBlock state={state} locale={locale} />
  const v = state.data
  const addresses = [...new Map(v.networks.map(n => [n.address, n])).values()]
  return <div className="econ-panel treasury-wallets">
    <h3>{t('Openfund Treasury wallets', 'کیف پول‌های خزانهٔ اوپن‌فاند')[locale]}</h3>
    <p className="econ-msg">{t('Public addresses that receive challenge payments. Balances are read directly from each blockchain and shown per network. A treasury balance is not revenue, profit, payout liquidity or a guaranteed reserve.', 'نشانی‌های عمومی که پرداخت چالش‌ها را دریافت می‌کنند. موجودی‌ها مستقیماً از هر بلاک‌چین خوانده و به تفکیک شبکه نمایش داده می‌شوند. موجودی خزانه به معنای درآمد، سود، نقدینگی پرداخت سود یا ذخیرهٔ تضمین‌شده نیست.')[locale]}</p>
    {!v.networks.length && <p className="econ-empty">{t('No treasury network is configured on the server yet.', 'هنوز هیچ شبکهٔ خزانه‌ای روی سرور پیکربندی نشده است.')[locale]}</p>}
    {addresses.length > 0 && <dl className="treasury-addresses">
      {addresses.map(a => <div key={a.address}>
        <dt>{a.family === 'solana' ? t('Solana treasury address', 'نشانی خزانهٔ سولانا')[locale] : t('EVM treasury address', 'نشانی خزانهٔ EVM')[locale]}</dt>
        <dd><code dir="ltr" className="econ-address">{a.address}</code></dd>
      </div>)}
    </dl>}
    <div className="treasury-network-grid">
      {v.networks.map(n => <article key={`${n.chainId}:${n.address}`} className="treasury-network" data-status={n.status}>
        <header>
          <h4>{NETWORK_NAMES[n.blockchain || ''] || n.network || n.chainId}</h4>
          {n.status === 'ok' ? <Status kind="ok">{t('Live read', 'خوانش زنده')[locale]}</Status>
            : n.status === 'stale' ? <Status kind="warn">{t('Last successful read', 'آخرین خوانش موفق')[locale]}</Status>
              : n.status === 'pending' ? <Status kind="info">{t('Reading…', 'در حال خواندن…')[locale]}</Status>
                : <Status kind="off">{t('Balance unavailable', 'موجودی در دسترس نیست')[locale]}</Status>}
        </header>
        <p className="treasury-network-address"><bdi dir="ltr" className="treasury-hex" title={n.address}>{short(n.address)}</bdi>
          {n.explorerUrl && <> · <a className="text-link" href={n.explorerUrl} target="_blank" rel="noopener noreferrer">{t('Block explorer', 'کاوشگر بلاک')[locale]} ↗</a></>}</p>
        {n.balances.length > 0 ? <table className="treasury-balance-table">
          <caption className="sr-only">{t('Balances', 'موجودی‌ها')[locale]}</caption>
          <thead><tr><th scope="col">{t('Token', 'توکن')[locale]}</th><th scope="col">{t('Balance', 'موجودی')[locale]}</th><th scope="col">{t('Decimals', 'اعشار')[locale]}</th></tr></thead>
          <tbody>{n.balances.map(b => <tr key={b.kind + (b.contract || '')}>
            <th scope="row"><bdi dir="ltr">{b.symbol || t('Token', 'توکن')[locale]}</bdi>{b.kind === 'native'
              ? <small> · {t('native', 'ارز بومی')[locale]}</small>
              : b.contract && <small> · {b.contractExplorerUrl ? <a className="text-link" href={b.contractExplorerUrl} target="_blank" rel="noopener noreferrer"><bdi dir="ltr" className="treasury-hex">{short(b.contract)}</bdi></a> : <bdi dir="ltr" className="treasury-hex">{short(b.contract)}</bdi>}</small>}</th>
            <td dir="ltr" className="num treasury-hex">{grouped(b.balance)}</td>
            <td dir="ltr" className="num">{b.decimals}</td>
          </tr>)}</tbody>
        </table> : <p className="econ-empty">{n.status === 'pending' ? t('Waiting for the first read.', 'در انتظار اولین خوانش.')[locale] : t('No balance is shown because the network could not be read.', 'چون خواندن این شبکه ممکن نشد، موجودی‌ای نمایش داده نمی‌شود.')[locale]}</p>}
        <p className="econ-source">
          {n.readAt ? <>{t('Read at', 'زمان خوانش')[locale]} {when(n.readAt, locale)}</> : t('Never read successfully', 'تاکنون خوانش موفقی نداشته')[locale]}
          {n.status === 'stale' && n.attemptedAt && <> · {t('latest attempt failed at', 'آخرین تلاش ناموفق در')[locale]} {when(n.attemptedAt, locale)}</>}
        </p>
      </article>)}
    </div>
    <p className="econ-source">{t('On-chain native and settlement-token balances via the payment RPC endpoints; cached for up to', 'موجودی ارز بومی و توکن تسویه از طریق RPC پرداخت روی زنجیره؛ حداکثر')[locale]} <bdi dir="ltr">{Math.round(v.cacheSeconds / 60)}</bdi> {t('minutes. Generated', 'دقیقه ذخیره می‌شود. تولید')[locale]} {when(v.generatedAt, locale)}.</p>
  </div>
}
