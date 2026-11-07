import { useRef, useState } from 'react'
import landingBody from '../../pages/landing-body.html?raw'

const featuresFa = [
  { title: 'استخر نقدینگی چندمنظوره', detail: 'طرح مفهومیِ اتصال منابع نقدینگی در مسیر توسعهٔ معاملات پرپچوال؛ تجمیع نقدینگی در نسخهٔ فعلی فعال نیست.' },
  { title: 'مسیریابی هوشمند موقعیت', detail: 'طرح پیشنهادی برای مقایسهٔ مسیرهای معاملاتی؛ نسخهٔ فعلی اوپن‌فاند سفارش‌ها را بین بازارها مسیریابی نمی‌کند.' },
  { title: 'بهینه‌سازی قیمت Liquidation', detail: 'عنوان پیشنهادیِ طراحی فنی برای معاملات پرپچوال؛ سازوکار و شرایط این قابلیت پیش از عرضه به تأیید محصول نیاز دارد.' },
  { title: 'اسپرد و اثر قیمت صفر', detail: 'عبارت مرجعِ طراحی برای بررسی محصول است، نه تضمین اجرا یا هزینه. ادعای اسپرد و اثر قیمت صفر پیش از انتشار نیاز به تأیید دارد؛ معاملات پرپچوال فعلی فقط خواندنی است.' },
]
const featuresEn = [
  { title: 'Multi-purpose liquidity pool', detail: 'A concept for connecting liquidity sources as perpetual trading develops. Aggregated liquidity is not available in the current version.' },
  { title: 'Smart position routing', detail: 'A proposal for comparing trade routes. Openfund does not currently route orders across markets.' },
  { title: 'Liquidation price optimization', detail: 'A proposed technical design for perpetual trading. Its mechanism and terms require product approval before release.' },
  { title: 'Zero spread and price impact', detail: 'A design reference, not a promise about execution or costs. Any zero-spread claim needs approval; current perpetual trading is read-only.' },
]

// Read the four trusted repository illustrations/copy directly, preserving
// their geometry and original wording for product review without duplication.
const originals = [...landingBody.matchAll(/<article class="feature-card">([\s\S]*?)<\/article>/g)].slice(0, 4).map(match => ({
  svg: match[1].match(/<svg[\s\S]*?<\/svg>/)?.[0] || '',
  copy: match[1].match(/<p>([\s\S]*?)<\/p>/)?.[1] || '',
}))

export function TechnicalFeatureIllustration({ index }: { index: number }) {
  return <div className={`technical-art technical-art-${index}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: originals[index]?.svg || '' }} />
}

export default function TechnicalFeatureStrip({ locale }: { locale: 'fa' | 'en' }) {
  const features = locale === 'fa' ? featuresFa : featuresEn
  const dialog = useRef<HTMLDialogElement>(null)
  const trigger = useRef<HTMLButtonElement | null>(null)
  const [selected, setSelected] = useState(0)
  const closeDetail = () => { dialog.current?.close(); trigger.current?.focus() }
  return <section className="technical-features" aria-labelledby="technical-title">
    <div className="technical-heading"><h2 id="technical-title">{locale === 'fa' ? 'افق فنی معاملات پرپچوال' : 'Perpetual trading technical horizon'}</h2><span>{locale === 'fa' ? 'طرح پیشنهادی · نیازمند تأیید محصول' : 'Proposed design · product approval required'}</span></div>
    <div className="technical-grid">
      {features.map((feature,index) => <button type="button" key={feature.title} className="technical-feature" aria-haspopup="dialog" onClick={event => {
        trigger.current = event.currentTarget
        setSelected(index)
        dialog.current?.showModal()
      }}>
        <TechnicalFeatureIllustration index={index} />
        <span>{feature.title}</span><span className="technical-more" aria-hidden="true">↗</span>
      </button>)}
    </div>
    <dialog ref={dialog} className="technical-dialog" aria-labelledby="feature-dialog-title" aria-describedby="feature-dialog-detail" onCancel={event => { event.preventDefault(); closeDetail() }} onKeyDown={event => {
      // This disclosure has a single focusable action. Keep Tab on it while
      // the modal is open; Escape retains the native dialog close behavior.
      if (event.key === 'Tab') { event.preventDefault(); dialog.current?.querySelector('button')?.focus() }
    }} onClick={event => { if (event.target === dialog.current) closeDetail() }}>
      <span className="technical-status">{locale === 'fa' ? 'معاملات پرپچوال · طرح پیشنهادی' : 'Perpetual trading · proposed design'}</span>
      <h2 id="feature-dialog-title">{features[selected].title}</h2>
      <p id="feature-dialog-detail">{features[selected].detail}</p>
      {locale === 'fa' && <><p className="technical-source-label">متن مرجع · نیازمند تأیید محصول پیش از انتشار</p><blockquote>{originals[selected]?.copy}</blockquote></>}
      <button type="button" autoFocus onClick={closeDetail}>{locale === 'fa' ? 'بستن' : 'Close'}</button>
    </dialog>
  </section>
}
