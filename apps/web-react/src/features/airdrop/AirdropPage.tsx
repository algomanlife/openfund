import InformationShell, { useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import '../contracts/contracts.css'

/* /:locale/airdrop: reserved by the owner. The page exists in the menu and
   the route table; its content is added only when the owner provides it. */
const c = {
  title: text('Airdrop', 'ایردراپ'),
  description: text('Openfund airdrop.', 'ایردراپ اوپن‌فاند.'),
}

export default function AirdropPage() {
  const locale = useInformationLocale()
  return <InformationShell page="airdrop" description={tx(locale, c.description)}>
    <section className="container info-hero of-reserved-page" id="top">
      <h1>{tx(locale, c.title)}</h1>
    </section>
  </InformationShell>
}
