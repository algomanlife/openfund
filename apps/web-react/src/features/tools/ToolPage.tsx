import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import InformationShell, { Hero, useInformationLocale } from '../information/InformationShell'
import { labels, number, text } from '../information/content'
import { toolBySlug, useSiteLibrary } from '../../cms/siteContent'
import type { ToolFieldSpec, ToolOutcome, ToolSpec } from '../../cms/contentTypes'
import { calculators, type ToolInput } from '../../data/calculators'
import { toolErrorMessage, toolNote, verdictLabel } from './messages'
import JournalAnalyzer from './JournalAnalyzer'
import './tools.css'

type Locale = 'fa' | 'en'
type FormState = Record<string, string>

function formatResult(value: number | string | null, format: ToolSpec['results'][number]['format'], precision: number, locale: Locale): string {
  if (value === null || value === undefined || (typeof value !== 'number' && !value)) return '—'
  if (typeof value === 'string') return value
  const opts: Intl.NumberFormatOptions = { maximumFractionDigits: precision, minimumFractionDigits: 0 }
  switch (format) {
    case 'currency': return `$${number(value, locale, { ...opts, minimumFractionDigits: 2 })}`
    case 'signed': return `${value >= 0 ? '+' : '−'}$${number(Math.abs(value), locale, { ...opts, minimumFractionDigits: 2 })}`
    case 'percent': return `${number(value, locale, opts)}${locale === 'fa' ? '٪' : '%'}`
    case 'ratio': return `${number(value, locale, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`
    default: return number(value, locale, opts)
  }
}

function Field({ field, state, error, locale, onChange }: {
  field: ToolFieldSpec; state: FormState; error?: string; locale: Locale; onChange: (key: string, value: string) => void
}) {
  const id = `tool-input-${field.key}`
  return <div className="tool-field">
    <label htmlFor={id}>
      <span>{field.label[locale]}</span>
      {field.unit && <small dir="ltr">{field.unit[locale]}</small>}
    </label>
    {field.kind === 'select'
      ? <select id={id} value={state[field.key] ?? ''} onChange={e => onChange(field.key, e.target.value)}>
        {field.options?.map(option => <option key={option.value} value={option.value}>{option.label[locale]}</option>)}
      </select>
      : field.kind === 'list'
        ? <textarea id={id} rows={3} value={state[field.key] ?? ''} placeholder={locale === 'fa' ? 'مثلاً: 120, -40, 260, 90' : 'e.g. 120, -40, 260, 90'} onChange={e => onChange(field.key, e.target.value)} />
        : <input id={id} type="text" inputMode={field.kind === 'file' ? 'text' : 'decimal'} autoComplete="off"
            value={state[field.key] ?? ''} onChange={e => onChange(field.key, e.target.value)} />}
    {field.help && <p className="tool-field-help">{field.help[locale]}</p>}
    {error && <p className="tool-field-error" role="alert">{error}</p>}
  </div>
}

function ToolForm({ tool, locale }: { tool: ToolSpec; locale: Locale }) {
  const initial = useMemo(() => {
    const state: FormState = {}
    for (const field of tool.inputs) {
      state[field.key] = field.default !== undefined && typeof field.default === 'number' ? String(field.default)
        : field.options?.[0]?.value ?? ''
    }
    return state
  }, [tool])
  const [state, setState] = useState<FormState>(initial)

  const outcome: ToolOutcome = useMemo(() => {
    const calculator = calculators[tool.slug]
    if (!calculator) return { ok: true, values: {} }
    return calculator(state as ToolInput)
  }, [tool, state])

  const errors = 'errors' in outcome ? outcome.errors : null

  const fieldErrors = useMemo(() => {
    const map: Record<string, string> = {}
    for (const error of errors || []) {
      if (error.field) map[error.field] = toolErrorMessage(error, locale)
    }
    return map
  }, [errors, locale])

  const formError = errors && !errors.some(error => error.field)
    ? toolErrorMessage(errors[0], locale)
    : null

  return <div className="tool-grid">
    <form className="tool-inputs" onSubmit={e => e.preventDefault()} aria-label={tool.name[locale]}>
      {tool.inputs.map(field => <Field key={field.key} field={field} state={state} error={fieldErrors[field.key]} locale={locale}
        onChange={(key, value) => setState(prev => ({ ...prev, [key]: value }))} />)}
      <button type="button" className="text-link tool-reset" onClick={() => setState(initial)}>
        {text('Reset inputs', 'بازنشانی ورودی‌ها')[locale]}
      </button>
      {formError && <p className="tool-field-error" role="alert">{formError}</p>}
    </form>

    <div className="tool-results" aria-live="polite">
      {!('errors' in outcome)
        ? <>
          {tool.results.filter(r => r.emphasis).map(result => <div key={result.key} className="tool-result-main">
            <span>{result.label[locale]}</span>
            <strong>{formatResult(outcome.values[result.key], result.format, result.precision ?? 2, locale)}</strong>
            {result.note && <small>{result.note[locale]}</small>}
          </div>)}
          <dl className="tool-result-list">
            {tool.results.filter(r => !r.emphasis).map(result => <div key={result.key}>
              <dt>{result.label[locale]}</dt>
              <dd>{result.format === 'text'
                ? verdictLabel(String(outcome.values[result.key] ?? ''), locale) ?? String(outcome.values[result.key] ?? '—')
                : formatResult(outcome.values[result.key], result.format, result.precision ?? 2, locale)}</dd>
            </div>)}
          </dl>
          {outcome.notes?.map((note, i) => {
            const message = toolNote(note, locale)
            return message ? <p key={i} className="tool-note">{message}</p> : null
          })}
        </>
        : <div className="tool-empty">
          <i aria-hidden="true">◇</i>
          <p>{text('Complete the inputs to see the result.', 'ورودی‌ها را کامل کن تا نتیجه نمایش داده شود.')[locale]}</p>
        </div>}
    </div>
  </div>
}

export default function ToolPage() {
  const locale = useInformationLocale()
  const { slug } = useParams()
  const { library } = useSiteLibrary()
  const tool = toolBySlug(library, slug)

  if (!tool) return <InformationShell page="tools" description={text('Tools Center', 'مركز ابزارها')[locale]}>
    <Hero locale={locale} page="tools" title={text('Tool not found', 'ابزار پیدا نشد')[locale]} accent={text('', '')[locale]} intro={text('This calculator does not exist.', 'این محاسبه‌گر وجود ندارد.')[locale]} />
    <div className="container"><div className="info-end">
      <Link className="button" to={`/${locale}/tools`}>{text('Back to the Tools Center', 'بازگشت به مركز ابزارها')[locale]}</Link>
    </div></div>
  </InformationShell>

  const glossary = tool.glossary.map(slug => library.glossary.find(term => term.slug === slug)).filter(Boolean)
  const lessons = tool.lessons.map(slug => {
    for (const path of library.paths) {
      const lesson = path.lessons.find(l => l.slug === slug)
      if (lesson) return { lesson, path }
    }
    return null
  }).filter(Boolean)

  return <InformationShell page="tools" title={`${tool.name[locale]} | Openfund`} description={tool.tagline[locale] || tool.about[locale]}>
    <Hero locale={locale} page="tools"
      title={tool.name[locale]}
      accent={tool.tagline[locale]}
      intro={tool.about[locale]}>
      <div className="info-hero-meta">
        <span className="pill">{text('Runs in your browser', 'در مرورگر تو اجرا می‌شود')[locale]}</span>
        <span>{text('No account, no orders', 'بدون حساب، بدون سفارش')[locale]}</span>
      </div>
    </Hero>

    <div className="container tool-page">
      <nav className="tool-breadcrumb" aria-label={text('Tools', 'ابزارها')[locale]}>
        <Link to={`/${locale}/tools`}>{text('Tools Center', 'مركز ابزارها')[locale]}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{tool.name[locale]}</span>
      </nav>

      {tool.slug === 'journal-analyzer'
        ? <JournalAnalyzer tool={tool} locale={locale} library={library} />
        : <ToolForm tool={tool} locale={locale} />}

      <section className="tool-docs">
        <h2>{text('How this number is produced', 'این عدد چگونه به دست می‌آید')[locale]}</h2>
        <div className="formula-block"><span>{text('Formula', 'فرمول')[locale]}<pre dir="ltr">{tool.formula}</pre></span>
          <p>{tool.method[locale]}</p>
        </div>
        <h3>{text('Assumptions', 'فرض‌ها')[locale]}</h3>
        <ul className="tool-assumptions">
          {tool.assumptions.map((item, i) => <li key={i}>{item[locale]}</li>)}
        </ul>
        <div className="info-notice">
          <span className="tiny-mark" aria-hidden="true">⚠</span>
          <p>{tool.limitations[locale]}</p>
        </div>
      </section>

      {(glossary.length > 0 || lessons.length > 0) && <section className="tool-related">
        <h2>{text('Keep reading', 'ادامهٔ مطالعه')[locale]}</h2>
        {lessons.length > 0 && <div className="tool-related-group">
          <span className="eyebrow">{labels.learn[locale]}</span>
          {lessons.map(entry => entry && <Link key={entry.lesson.slug} className="text-link" to={`/${locale}/learn/lessons/${entry.lesson.slug}`}>
            {entry.lesson.title[locale]} <span aria-hidden="true">↗</span>
          </Link>)}
        </div>}
        {glossary.length > 0 && <div className="tool-related-group">
          <span className="eyebrow">{text('Glossary', 'واژه‌نامه')[locale]}</span>
          {glossary.map(term => term && <Link key={term.slug} className="text-link" to={`/${locale}/learn/glossary/${term.slug}`}>
            {term.term[locale]} <span aria-hidden="true">↗</span>
          </Link>)}
        </div>}
      </section>}

      <div className="info-end">
        <p>{text('Plan the trade on paper first — the terminal is for when you are ready.', 'اول معامله را روی کاغذ بچین — ترمینال برای وقتی است که آماده‌ای.')[locale]}</p>
        <div className="hero-actions">
          <a className="button" href={`#/${locale}/prop/trade`}>{text('Open the terminal', 'ترمینال را باز کن')[locale]} <span aria-hidden="true">↙</span></a>
          <Link className="text-link" to={`/${locale}/learn`}>{labels.learn[locale]} <span aria-hidden="true">↗</span></Link>
        </div>
      </div>
    </div>
  </InformationShell>
}
