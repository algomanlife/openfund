import { pick } from '../../i18n/locales'
import { useMemo, useRef, useState } from 'react'
import { text, number, type Locale } from '../information/content'
import type { ToolSpec } from '../../cms/contentTypes'
import type { SiteLibrary } from '../../cms/siteContent'
import { analyzeJournal, type JournalReport } from '../../data/journalCsv'

/**
 * The journal analyzer: CSV import stays on the device. The file is read with
 * the browser FileReader, analysed by the pure journalCsv module, and never
 * leaves the page — no upload, no backend call, no storage.
 */
export default function JournalAnalyzer({ tool, locale, library }: { tool: ToolSpec; locale: Locale; library: SiteLibrary }) {
  const [csv, setCsv] = useState('')
  const [fileName, setFileName] = useState('')
  const [startingCapital, setStartingCapital] = useState('10000')
  const [parseError, setParseError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  void library

  const report: JournalReport = useMemo(() => {
    if (!csv.trim()) return { ok: false, errors: [{ field: 'csv', code: 'required' }] }
    const capital = Number(startingCapital.replace(/[^\d.-]/g, '')) || 0
    return analyzeJournal(csv, capital)
  }, [csv, startingCapital])

  const onFile = (file: File | undefined) => {
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setCsv(String(reader.result || ''))
    reader.onerror = () => setParseError(pick(locale, 'خواندن فایل ممکن نشد.', 'The file could not be read.'))
    reader.readAsText(file)
  }

  const metrics = 'errors' in report ? null : report.metrics
  const currency = (value: number | null | undefined) => value === null || value === undefined ? '—'
    : `${value >= 0 ? '' : '−'}$${number(Math.abs(value), locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`

  return <div className="tool-grid journal-grid">
    <form className="tool-inputs" onSubmit={e => e.preventDefault()}>
      <div className="tool-field">
        <label htmlFor="journal-file"><span>{text('Import CSV', 'درون‌ریزی CSV')[locale]}</span></label>
        <input id="journal-file" ref={fileRef} type="file" accept=".csv,.txt,text/csv" onChange={e => onFile(e.target.files?.[0] || undefined)} />
        <p className="tool-field-help">{text('Reads in this tab only — the file is never uploaded anywhere.', 'فقط در همین تب خوانده می‌شود؛ فایل هیچ‌جا بارگذاری نمی‌شود.')[locale]}</p>
      </div>
      <div className="tool-field">
        <label htmlFor="journal-paste"><span>{text('Or paste rows', 'یا سطرها را بچسبان')[locale]}</span></label>
        <textarea id="journal-paste" rows={6} value={csv} placeholder={'date,symbol,side,qty,entry,exit,pnl\n2026-10-03,BTCUSD,long,0.05,60000,63000,148'}
          onChange={e => { setCsv(e.target.value); setFileName('') }} />
      </div>
      <div className="tool-field">
        <label htmlFor="journal-capital"><span>{text('Starting capital', 'سرمایهٔ آغازین')[locale]}</span><small dir="ltr">USD</small></label>
        <input id="journal-capital" type="text" inputMode="decimal" value={startingCapital} onChange={e => setStartingCapital(e.target.value)} />
        <p className="tool-field-help">{text('Used only to express drawdown as a percentage.', 'فقط برای نمایش افت به‌صورت درصدی استفاده می‌شود.')[locale]}</p>
      </div>
      {(fileName || csv) && <button type="button" className="text-link tool-reset" onClick={() => { setCsv(''); setFileName(''); if (fileRef.current) fileRef.current.value = '' }}>
        {text('Clear', 'پاک کردن')[locale]}
      </button>}
      {parseError && <p className="tool-field-error" role="alert">{parseError}</p>}
      {('errors' in report) && report.errors.some(e => e.field === 'csv') && csv.trim() && !parseError && (
        <p className="tool-field-error" role="alert">{report.errors[0].code === 'empty'
          ? text('No rows with a usable profit value were found.', 'سطری با مقدار سود قابل‌استفاده پیدا نشد.')[locale]
          : text('The file could not be interpreted as a trade journal. Check the expected columns below.', 'فایل به‌عنوان ژورنال معاملاتی قابل تفسیر نبود. ستون‌های مورد انتظار را در پایین ببین.')[locale]}</p>
      )}
    </form>

    <div className="tool-results" aria-live="polite">
      {metrics ? <>
        <div className="tool-result-main">
          <span>{text('Net profit', 'سود خالص')[locale]}</span>
          <strong>{currency(metrics.netPnl)}</strong>
          <small>{number(metrics.trades, locale)} {text('trades', 'معامله')[locale]}</small>
        </div>
        <div className="tool-result-main">
          <span>{text('Win rate', 'درصد برد')[locale]}</span>
          <strong>{`${number(metrics.winRatePct, locale, { maximumFractionDigits: 1 })}${pick(locale, '٪', '%')}`}</strong>
          <small>{number(metrics.wins, locale)} / {number(metrics.wins + metrics.losses, locale)}</small>
        </div>
        <dl className="tool-result-list">
          <div><dt>{text('Profit factor', 'ضریب سود')[locale]}</dt><dd>{metrics.profitFactor === null ? '—' : number(metrics.profitFactor, locale, { maximumFractionDigits: 2 })}</dd></div>
          <div><dt>{text('Expectancy per trade', 'امید ریاضی هر معامله')[locale]}</dt><dd>{currency(metrics.expectancy)}</dd></div>
          <div><dt>{text('Average win', 'میانگین برد')[locale]}</dt><dd>{currency(metrics.avgWin)}</dd></div>
          <div><dt>{text('Average loss', 'میانگین باخت')[locale]}</dt><dd>{currency(metrics.avgLoss)}</dd></div>
          <div><dt>{text('Payoff ratio', 'نسبت برد به باخت')[locale]}</dt><dd>{metrics.payoff === null ? '—' : number(metrics.payoff, locale, { maximumFractionDigits: 2 })}</dd></div>
          <div><dt>{text('Best / worst trade', 'بهترین / بدترین معامله')[locale]}</dt><dd>{currency(metrics.bestTrade)} / {currency(metrics.worstTrade)}</dd></div>
          <div><dt>{text('Max drawdown', 'بیشترین افت')[locale]}</dt><dd>{currency(metrics.maxDrawdown)}{metrics.maxDrawdownPct !== null ? ` (${number(metrics.maxDrawdownPct, locale, { maximumFractionDigits: 1 })}${pick(locale, '٪', '%')})` : ''}</dd></div>
          <div><dt>{text('Longest win / loss streak', 'بلندترین رشتهٔ برد / باخت')[locale]}</dt><dd>{number(metrics.longestWinStreak, locale)} / {number(metrics.longestLossStreak, locale)}</dd></div>
          <div><dt>{text('Largest day share', 'سهم بزرگ‌ترین روز')[locale]}</dt><dd>{metrics.consistencySharePct === null ? '—' : `${number(metrics.consistencySharePct, locale, { maximumFractionDigits: 1 })}${pick(locale, '٪', '%')}`}</dd></div>
        </dl>
        {!('errors' in report) && report.warnings.length > 0 && <div className="journal-warnings">
          <span>{text('Notes', 'نکته‌ها')[locale]}</span>
          <ul>{report.warnings.slice(0, 6).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>}
      </> : <div className="tool-empty">
        <i aria-hidden="true">◇</i>
        <p>{text('Import a CSV or paste your rows to see the statistics.', 'یک CSV درون‌ریزی کن یا سطرها را بچسبان تا آمارها را ببینی.')[locale]}</p>
      </div>}
    </div>

    {!('errors' in report) && report.days.length > 1 && <div className="journal-days">
      <h3>{text('Per day', 'روز به روز')[locale]}</h3>
      <div className="info-table-wrap"><table>
        <thead><tr>
          <th scope="col">{text('Day', 'روز')[locale]}</th>
          <th scope="col">{text('Trades', 'معاملات')[locale]}</th>
          <th scope="col">{text('Net PnL', 'سود و زیان خالص')[locale]}</th>
        </tr></thead>
        <tbody>
          {report.days.map(day => <tr key={day.date}>
            <th scope="row" dir="ltr">{day.date}</th>
            <td>{number(day.trades, locale)}</td>
            <td className={day.pnl >= 0 ? 'positive' : 'negative'}>{currency(day.pnl)}</td>
          </tr>)}
        </tbody>
      </table></div>
    </div>}

    <section className="tool-docs journal-schema">
      <details className="info-explanation">
        <summary>{text('Expected columns', 'ستون‌های مورد انتظار')[locale]}</summary>
        <p>{text(
          'A header row is recommended. Recognised columns (case-insensitive): date, symbol, side, qty, entry, exit, fees and a profit column (pnl / profit / net pnl / gross pnl). If no profit column exists, profit is derived from entry, exit and qty. A column named “gross pnl” has fees subtracted; other profit columns are treated as already net. Rows without a usable profit value are reported, not dropped. Numbers may use Latin, Persian or Arabic-Indic digits.',
          'سطر سرستون توصیه می‌شود. ستون‌های شناخته‌شده (بدون حساسیت به بزرگی حروف): date، symbol، side، qty، entry، exit، fees و یک ستون سود (pnl / profit / net pnl / gross pnl). اگر ستون سود نباشد، سود از entry و exit و qty ساخته می‌شود. ستونی که «gross pnl» نام دارد کارمزدش کسر می‌شود؛ بقیهٔ ستون‌های سود خالص فرض می‌شوند. سطرهای بدون سود قابل‌استفاده گزارش می‌شوند، نه حذف. عددها می‌توانند لاتین، فارسی یا عربی باشند.')[locale]}</p>
      </details>
    </section>
  </div>
}
