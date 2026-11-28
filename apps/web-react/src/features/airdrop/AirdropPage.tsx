import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { number, text, tx, type Localized } from '../information/content'
import BalloonDrop from './BalloonDrop'
import './airdrop.css'

/* /:locale/airdrop: the Openfund airdrop for challenge buyers (owner
   decision 2026-11-28). It is not a token: rewards are cash or other prizes,
   separate from the Premium League, earned by completing missions and sharing
   the certificates. Only the wallet that bought a challenge qualifies, and
   rewards go only to that wallet. Claims open with the claim form. */
const c = {
  title: text('Openfund Airdrop', 'ایردراپ اوپن‌فاند'),
  accent: text('Cash rewards for challenge buyers', 'جایزهٔ نقدی برای خریداران چلنج'),
  intro: text('Buy a challenge, complete a mission and share your Openfund certificates on social media. Each mission pays a cash reward from $1,000 to $5,000 to the wallet that bought the challenge. No token, no lottery ticket and nothing to do with the Premium League.',
    'چلنج بخر، یک مأموریت را انجام بده و گواهی‌های اوپن‌فاندت را در شبکه‌های اجتماعی به اشتراک بگذار. هر مأموریت یک جایزهٔ نقدی از ۱٬۰۰۰ تا ۵٬۰۰۰ دلار به کیف پولی می‌دهد که چلنج را خریده است. توکن نیست، قرعه‌کشی نیست و ربطی به لیگ برتر ندارد.'),
  description: text('The Openfund airdrop: cash rewards from $1,000 to $5,000 for challenge buyers who complete missions and share their certificates.', 'ایردراپ اوپن‌فاند: جایزهٔ نقدی ۱٬۰۰۰ تا ۵٬۰۰۰ دلاری برای خریداران چلنج که مأموریت‌ها را انجام می‌دهند و گواهی‌هایشان را به اشتراک می‌گذارند.'),
  scene: text('Balloons flying over the page and dropping cash, coins and gift boxes.', 'بالن‌هایی که بالای صفحه پرواز می‌کنند و پول نقد، سکه و جعبهٔ هدیه می‌ریزند.'),
  buy: text('Buy a challenge', 'خرید چلنج'),
  verify: text('Verify a certificate', 'تأیید گواهی'),
  claimSoon: text('The claim form opens soon; missions you complete now count.', 'فرم دریافت جایزه به‌زودی باز می‌شود؛ مأموریت‌هایی که از حالا انجام بدهی حساب می‌شود.'),
  missionsTitle: text('Missions and rewards', 'مأموریت‌ها و جایزه‌ها'),
  missionsLead: text('Every mission is completed with certificates issued to your wallet and posts you share publicly. Each mission pays once per wallet.', 'هر مأموریت با گواهی‌هایی که به کیف پول تو صادر شده و پست‌هایی که به‌صورت عمومی منتشر می‌کنی انجام می‌شود. هر مأموریت برای هر کیف پول یک بار پرداخت می‌شود.'),
  reward: text('Cash reward', 'جایزهٔ نقدی'),
  stepsTitle: text('How it works', 'چطور کار می‌کند'),
  rulesTitle: text('Rules', 'قوانین'),
  terms: text('Terms of Use', 'شرایط استفاده'),
}

type Mission = { id: string; usd: number; tone: string; title: Localized; body: Localized }
const MISSIONS: Mission[] = [
  { id: 'buy-share', usd: 1000, tone: '#12965d',
    title: text('Buy and share', 'بخر و به اشتراک بگذار'),
    body: text('Buy a challenge and share your purchase certificate and a screenshot of the purchase on social media.', 'یک چلنج بخر و گواهی خرید و تصویر خرید را در شبکه‌های اجتماعی به اشتراک بگذار.') },
  { id: 'pass-share', usd: 2000, tone: '#2bb57a',
    title: text('Pass and share', 'پاس کن و به اشتراک بگذار'),
    body: text('Pass your challenge and share the pass certificate together with your purchase certificate.', 'چلنجت را پاس کن و گواهی قبولی را همراه گواهی خرید به اشتراک بگذار.') },
  { id: 'payout-share', usd: 3000, tone: '#f2c14e',
    title: text('Get paid and share', 'برداشت بزن و به اشتراک بگذار'),
    body: text('Receive a payout and share the purchase, pass and payout certificates.', 'برداشت بگیر و گواهی خرید، قبولی و برداشت را به اشتراک بگذار.') },
  { id: 'three-buys-pass', usd: 4000, tone: '#f4a24f',
    title: text('Three purchases and a pass', 'سه خرید و یک قبولی'),
    body: text('Share three purchase certificates and the pass certificate of a challenge, no payout needed.', 'سه گواهی خرید و گواهی قبولی یک چلنج را به اشتراک بگذار؛ برداشت لازم نیست.') },
  { id: 'ten-payouts', usd: 5000, tone: '#f08a6c',
    title: text('Ten payouts', 'ده برداشت'),
    body: text('Share ten payout certificates issued to your wallet.', 'ده گواهی برداشتی را که به کیف پولت صادر شده به اشتراک بگذار.') },
]

const STEPS: Array<[Localized, Localized]> = [
  [text('Buy a challenge', 'چلنج بخر'), text('Only a wallet that has bought a challenge takes part.', 'فقط کیف پولی که چلنج خریده در ایردراپ شرکت می‌کند.')],
  [text('Complete a mission', 'مأموریت را انجام بده'), text('Trade, pass and get paid: each step issues an Openfund certificate to your wallet.', 'معامله کن، پاس کن و برداشت بزن: هر مرحله یک گواهی اوپن‌فاند به کیف پولت صادر می‌کند.')],
  [text('Share it', 'به اشتراک بگذار'), text('Post the certificates publicly on social media and keep the posts up.', 'گواهی‌ها را به‌صورت عمومی در شبکه‌های اجتماعی منتشر کن و پست‌ها را نگه دار.')],
  [text('Claim', 'دریافت کن'), text('Send the post links from the same wallet. After review the reward is paid to that wallet.', 'لینک پست‌ها را با همان کیف پول ارسال کن. پس از بررسی، جایزه به همان کیف پول پرداخت می‌شود.')],
]

const RULES: Localized[] = [
  text('The airdrop is cash or other prizes, never a token. It is separate from the Openfund Premium League.', 'ایردراپ پول نقد یا جایزه‌های دیگر است و هرگز توکن نیست. از لیگ برتر اوپن‌فاند جداست.'),
  text('Only the connected wallet that bought the challenge can claim, and the reward is paid only to that wallet. No KYC.', 'فقط کیف پول متصلی که چلنج را خریده می‌تواند جایزه بگیرد و جایزه فقط به همان کیف پول پرداخت می‌شود. احراز هویت (KYC) لازم نیست.'),
  text('Certificates must be issued by Openfund to that wallet; anyone can check them on the certificate verification page.', 'گواهی‌ها باید از سوی اوپن‌فاند به همان کیف پول صادر شده باشند؛ هر کسی می‌تواند آن‌ها را در صفحهٔ تأیید گواهی بررسی کند.'),
  text('Posts must be public and stay online until the reward is paid. Deleted, edited or copied posts and certificates that are not yours void the claim.', 'پست‌ها باید عمومی باشند و تا پرداخت جایزه باقی بمانند. پست حذف‌شده، دست‌کاری‌شده یا کپی‌شده و گواهی‌ای که مال تو نیست، درخواست را باطل می‌کند.'),
  text('Each mission pays once per wallet. Openfund reviews every claim and gives the reason for a refusal. The Terms of Use apply.', 'هر مأموریت برای هر کیف پول یک بار پرداخت می‌شود. اوپن‌فاند همهٔ درخواست‌ها را بررسی می‌کند و دلیل رد را اعلام می‌کند. شرایط استفاده برقرار است.'),
]

export default function AirdropPage() {
  const locale = useInformationLocale()
  const t = (v: Localized) => tx(locale, v)
  return <InformationShell page="airdrop" description={t(c.description)}>
    <Hero locale={locale} page="airdrop" title={t(c.title)} accent={t(c.accent)} intro={t(c.intro)} visual={<BalloonDrop label={t(c.scene)} />}>
      <div className="ad-actions">
        <Link className="button" to={`/${locale}/checkout`} data-cta="airdrop-buy">{t(c.buy)}</Link>
        <Link className="button button-secondary" to={`/${locale}/certificate-verification`}>{t(c.verify)}</Link>
      </div>
      <p className="ad-badge">{t(c.claimSoon)}</p>
    </Hero>
    <section className="container ad-section" id="missions" aria-labelledby="ad-missions-title">
      <h2 id="ad-missions-title">{t(c.missionsTitle)}</h2>
      <p className="ad-lead">{t(c.missionsLead)}</p>
      <ul className="ad-missions">{MISSIONS.map(m => <li key={m.id} className="ad-mission" data-mission={m.id} style={{ ['--ad-tone' as string]: m.tone }}>
        <span className="ad-reward"><small>{t(c.reward)}</small><bdi>{number(m.usd, locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}</bdi></span>
        <h3>{t(m.title)}</h3>
        <p>{t(m.body)}</p>
      </li>)}</ul>
    </section>
    <section className="container ad-section" id="how" aria-labelledby="ad-steps-title">
      <h2 id="ad-steps-title">{t(c.stepsTitle)}</h2>
      <ol className="ad-steps">{STEPS.map(([title, body], i) => <li key={i}><b>{t(title)}</b><span>{t(body)}</span></li>)}</ol>
    </section>
    <section className="container ad-section" id="rules" aria-labelledby="ad-rules-title">
      <h2 id="ad-rules-title">{t(c.rulesTitle)}</h2>
      <ul className="ad-rules">{RULES.map((r, i) => <li key={i}>{t(r)}</li>)}</ul>
      <div className="ad-actions">
        <Link className="text-link" to={`/${locale}/terms`}>{t(c.terms)}</Link>
      </div>
    </section>
  </InformationShell>
}
