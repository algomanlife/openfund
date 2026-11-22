import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import FlamingoScene from '../navigation/FlamingoScene'
import DirArrow from '../../ui/DirArrow'

/* /:locale/migrate — the Migration destination of the Challenges menu. This
   first version introduces the path; the request flow, evidence and review
   arrive with the migration feature. */
const copy = {
  name: text('Migration to Openfund', 'مهاجرت به اوپن‌فاند'),
  body: text('Proven funded trader? Skip evaluation with three verified payouts.', 'معامله‌گر فاندشدهٔ اثبات‌شده‌ای؟ با سه برداشت تأییدشده از ارزیابی عبور کن.'),
  line: text('Funded elsewhere? Start at the funded stage.', 'جای دیگر فاند شده‌ای؟ از مرحلهٔ فاند شروع کن.'),
  compare: text('Compare challenges', 'مقایسهٔ چلنج‌ها'),
}

export default function MigratePage() {
  const locale = useInformationLocale()
  return <InformationShell page="migrate" description={tx(locale, copy.body)}>
    <Hero locale={locale} page="migrate" title={tx(locale, copy.name)} accent={tx(locale, copy.line)} intro={tx(locale, copy.body)}
      visual={<FlamingoScene variant="hero" live className="migrate-hero-scene" />}>
      <div className="hero-actions">
        <Link className="button" to={`/${locale}/challenges`}>{tx(locale, copy.compare)} <DirArrow kind="forward" /></Link>
      </div>
    </Hero>
  </InformationShell>
}
