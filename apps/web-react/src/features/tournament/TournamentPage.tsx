import { Link } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { text, tx } from '../information/content'
import { intlLocale, pickFormat } from '../../i18n/locales'
import DirArrow from '../../ui/DirArrow'
import { PREMIUM_LEAGUE_START, daysUntil } from './schedule'

/* /:locale/tournament — the Premium League destination of the Challenges
   menu. This first version states the schedule only; registration, rules,
   prizes and the leaderboard arrive with the tournament feature. */
const copy = {
  name: text('Openfund Premium League', 'لیگ برتر اوپن‌فاند'),
  line: text('A 30-day competition in analysis and risk.', 'رقابت ۳۰ روزه در تحلیل و مدیریت ریسک.'),
  compare: text('Compare challenges', 'مقایسهٔ چلنج‌ها'),
  rules: text('Trading rules', 'قوانین معاملاتی'),
}

export default function TournamentPage() {
  const locale = useInformationLocale()
  const days = daysUntil(PREMIUM_LEAGUE_START)
  const start = new Intl.DateTimeFormat(`${intlLocale(locale)}-u-ca-gregory`, { dateStyle: 'long', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(PREMIUM_LEAGUE_START))
  const countdown = days === null ? '' : pickFormat(locale, '${days} روز تا شروع', 'Starts in ${days} d', { days: new Intl.NumberFormat(locale === 'fa' ? 'fa-IR' : 'en-US').format(days) })
  return <InformationShell page="tournament" description={tx(locale, copy.line)}>
    <Hero locale={locale} page="tournament" title={tx(locale, copy.name)} accent={tx(locale, copy.line)} intro={[countdown, `${start} UTC`].filter(Boolean).join(' · ')}>
      <div className="hero-actions">
        <Link className="button" to={`/${locale}/challenges`}>{tx(locale, copy.compare)} <DirArrow kind="forward" /></Link>
        <Link className="text-link" to={`/${locale}/rulebook`}>{tx(locale, copy.rules)} <DirArrow kind="forward" /></Link>
      </div>
    </Hero>
  </InformationShell>
}
