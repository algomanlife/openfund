import { text } from '../information/content'
import type { LessonBlock } from '../../cms/contentTypes'

type Locale = import('../../i18n/locales').AppLocale

/** renders the content blocks exactly as authored, in the reader's language */
export default function LessonBody({ blocks, locale }: { blocks: LessonBlock[]; locale: Locale }) {
  return <div className="lesson-body">
    {blocks.map((block, index) => {
      switch (block.type) {
        case 'h2': return <h2 key={index} id={blockAnchor(block)}>{block.text[locale]}</h2>
        case 'h3': return <h3 key={index}>{block.text[locale]}</h3>
        case 'p': return <p key={index}>{block.text[locale]}</p>
        case 'note': return <aside key={index} className="info-notice lesson-note">
          <span className="tiny-mark" aria-hidden="true">◇</span>
          <p>{block.text[locale]}</p>
        </aside>
        case 'ul': return <ul key={index} className="lesson-list">{block.items.map((item, i) => <li key={i}>{item[locale]}</li>)}</ul>
        case 'ol': return <ol key={index} className="lesson-list ordered">{block.items.map((item, i) => <li key={i}>{item[locale]}</li>)}</ol>
        case 'formula': return <div key={index} className="formula-block">
          <span>{text('Formula', 'فرمول')[locale]}</span>
          <pre dir="ltr">{block.expr}</pre>
          {block.text && <p>{block.text[locale]}</p>}
        </div>
        case 'terms': return <dl key={index} className="lesson-terms">
          {block.items.map((item, i) => <div key={i}><dt>{item.term[locale]}</dt><dd>{item.text[locale]}</dd></div>)}
        </dl>
        case 'table': return <div key={index} className="info-table-wrap"><table>
          <caption>{block.caption[locale]}</caption>
          <thead><tr>{block.head.map((cell, i) => <th key={i} scope="col">{cell[locale]}</th>)}</tr></thead>
          <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell[locale]}</td>)}</tr>)}</tbody>
        </table></div>
        default: return null
      }
    })}
  </div>
}

/** stable, readable anchors for the table of contents */
export function blockAnchor(block: Extract<LessonBlock, { type: 'h2' }>): string {
  return `h-${block.text.en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'section'}`
}

/** table of contents entries derived from the h2 blocks, in the reader's language */
export function lessonToc(blocks: LessonBlock[], locale: Locale): Array<{ id: string; label: string }> {
  const entries: Array<{ id: string; label: string }> = []
  for (const block of blocks) {
    if (block.type === 'h2') entries.push({ id: blockAnchor(block), label: block.text[locale] })
  }
  return entries
}
