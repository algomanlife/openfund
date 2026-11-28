import { useEffect, useState } from 'react'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { apiFetch } from '../../session/useOpenfundSession'
import ChainMint from './ChainMint'
import './contracts.css'

/* /:locale/smart-contracts: Openfund's public contracts (ADR 0063). The
   addresses come from GET /chain/status, which reads the deployed addresses
   from the server configuration: until the owner deploys, the page says
   "not deployed yet" and never shows a placeholder address. */
type Status = { enabled?: boolean; network?: string; chainId?: number; explorerUrl?: string; contracts?: { certificate?: string | null; ledger?: string | null } }
const SOURCE = 'https://github.com/algomanlife/openfund/tree/main/packages/openfund-chain-records/src'
const ADDRESS = /^0x[0-9a-fA-F]{40}$/

const c = {
  title: text('Smart contracts', 'اسمارت کانترکت‌ها'),
  accent: text('Open to verify', 'شفاف و قابل بررسی'),
  intro: text('Openfund records challenge certificates and every position event of challenge and Free Trial accounts on a public blockchain. Traders never sign or pay; Openfund pays every transaction.', 'اوپن‌فاند گواهی چلنج‌ها و همهٔ رویدادهای پوزیشن حساب‌های چلنج و تست رایگان را روی یک بلاکچین عمومی ثبت می‌کند. معامله‌گر هیچ امضا یا پرداختی انجام نمی‌دهد؛ هزینهٔ همهٔ تراکنش‌ها را اوپن‌فاند می‌پردازد.'),
  description: text('Openfund smart contracts on Arbitrum Sepolia: addresses, source code and audit status.', 'قراردادهای هوشمند اوپن‌فاند روی Arbitrum Sepolia: آدرس، کد منبع و وضعیت ممیزی.'),
  network: text('Network', 'شبکه'),
  testnet: text('Test network: its ETH has no value.', 'شبکهٔ آزمایشی: اتر آن ارزشی ندارد.'),
  certificate: text('Certificates', 'گواهی‌ها'),
  certificateBody: text('Non-transferable (soulbound) NFTs for challenge purchase, Free Trial start, phase 1 pass, final pass, Free Trial pass and payout, each with its evaluation status.', 'NFT غیرقابل‌انتقال (Soulbound) برای خرید چلنج، شروع تست رایگان، قبولی مرحلهٔ ۱، قبولی نهایی، قبولی تست رایگان و برداشت؛ هر کدام با وضعیت ارزیابی.'),
  ledger: text('Trade ledger', 'دفتر معاملات'),
  ledgerBody: text('A public record of every position event: open, stop-loss or take-profit change, partial close and close, with market, side, size, prices and result.', 'ثبت عمومی همهٔ رویدادهای پوزیشن: باز شدن، تغییر حد ضرر یا حد سود، بستن بخشی و بستن کامل؛ با بازار، جهت، حجم، قیمت‌ها و نتیجه.'),
  address: text('Address', 'آدرس'),
  notDeployed: text('Not deployed yet', 'هنوز مستقر نشده'),
  loading: text('Loading…', 'در حال دریافت…'),
  unavailable: text('The status could not be loaded.', 'وضعیت دریافت نشد.'),
  explorer: text('View on Arbiscan', 'مشاهده در Arbiscan'),
  source: text('Source code', 'کد منبع'),
  audit: text('Audit', 'ممیزی'),
  notAudited: text('Not audited yet', 'هنوز ممیزی نشده'),
  recording: text('Recording', 'وضعیت ثبت'),
  on: text('On', 'فعال'), off: text('Off', 'غیرفعال'),
  scene: text('A certificate seal sending records into a moving chain of blocks, with the trade ledger filling below.', 'مهر گواهی که رکوردها را به زنجیرهٔ در حال حرکت بلاک‌ها می‌فرستد و دفتر معاملات زیر آن پر می‌شود.'),
}

export default function SmartContractsPage() {
  const locale = useInformationLocale()
  const [status, setStatus] = useState<Status | null | 'error'>(null)
  useEffect(() => {
    let alive = true
    void apiFetch('/chain/status').then(r => { if (alive) setStatus(r.ok && r.data ? r.data as Status : 'error') }).catch(() => { if (alive) setStatus('error') })
    return () => { alive = false }
  }, [])
  const s = status && status !== 'error' ? status : null
  const explorer = s?.explorerUrl && /^https:\/\//.test(s.explorerUrl) ? s.explorerUrl : 'https://sepolia.arbiscan.io'
  const card = (key: 'certificate' | 'ledger', file: string) => {
    const address = s?.contracts?.[key]
    const valid = typeof address === 'string' && ADDRESS.test(address)
    return <article className="of-contract-card" key={key}>
      <h2>{tx(locale, c[key])}</h2>
      <p>{tx(locale, key === 'certificate' ? c.certificateBody : c.ledgerBody)}</p>
      <dl>
        <div><dt>{tx(locale, c.address)}</dt><dd>{status === null ? tx(locale, c.loading)
          : valid ? <bdi dir="ltr" className="of-contract-address">{address}</bdi> : tx(locale, status === 'error' ? c.unavailable : c.notDeployed)}</dd></div>
        <div><dt>{tx(locale, c.network)}</dt><dd><bdi dir="ltr">Arbitrum Sepolia</bdi> <small dir="ltr">(421614)</small></dd></div>
        <div><dt>{tx(locale, c.audit)}</dt><dd>{tx(locale, c.notAudited)}</dd></div>
      </dl>
      <div className="of-contract-links">
        {valid && <a className="text-link" href={`${explorer}/address/${address}`} target="_blank" rel="noopener noreferrer">{tx(locale, c.explorer)}</a>}
        <a className="text-link" href={`${SOURCE}/${file}`} target="_blank" rel="noopener noreferrer">{tx(locale, c.source)}</a>
      </div>
    </article>
  }
  return <InformationShell page="smart-contracts" description={tx(locale, c.description)}>
    <Hero locale={locale} page="smart-contracts" title={tx(locale, c.title)} accent={tx(locale, c.accent)} intro={tx(locale, c.intro)} visual={<ChainMint label={tx(locale, c.scene)} ledger={tx(locale, c.ledger)} />}>
      <p className="of-contract-note">{tx(locale, c.testnet)} {s && <span>{tx(locale, c.recording)}: {tx(locale, s.enabled ? c.on : c.off)}</span>}</p>
    </Hero>
    <section className="container of-contract-grid" aria-live="polite">
      {card('certificate', 'OpenfundCertificate.sol')}
      {card('ledger', 'OpenfundTradeLedger.sol')}
    </section>
  </InformationShell>
}
