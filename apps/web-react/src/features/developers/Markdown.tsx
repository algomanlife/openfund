import { useState, type ReactNode } from 'react'

/** Minimal, safe Markdown for developer docs: headings (###), paragraphs,
 *  unordered and ordered lists, fenced code blocks with a copy button,
 *  inline code, bold and links (https or site-relative only). It builds React
 *  elements; no HTML from the source is ever injected. */
function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = []
  const re = /`([^`]+)`|\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0, m: RegExpExecArray | null, i = key
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] != null) out.push(<code key={i++} dir="ltr">{m[1]}</code>)
    else if (m[2] != null) out.push(<strong key={i++}>{m[2]}</strong>)
    else {
      const href = m[4]
      const safe = /^https:\/\//.test(href) || /^\/[\w/.-]*$/.test(href)
      out.push(safe ? <a key={i++} href={href} {...(href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{m[3]}</a> : m[3])
    }
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

function CodeBlock({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [done, setDone] = useState(false)
  return <div className="dd-code">
    <pre dir="ltr"><code>{code}</code></pre>
    <button type="button" className="dd-copy" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setDone(true); setTimeout(() => setDone(false), 1600) } catch { /* the code stays selectable */ }
    }}>{done ? copiedLabel : copyLabel}<span className="sr-only" aria-live="polite">{done ? copiedLabel : ''}</span></button>
  </div>
}

export default function Markdown({ source, copyLabel, copiedLabel }: { source: string; copyLabel: string; copiedLabel: string }) {
  const lines = source.replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let i = 0, k = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const body: string[] = []; i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      i++; blocks.push(<CodeBlock key={k++} code={body.join('\n')} copyLabel={copyLabel} copiedLabel={copiedLabel} />); continue
    }
    if (/^#{2,4}\s/.test(line)) { blocks.push(<h4 key={k++}>{inline(line.replace(/^#+\s/, ''))}</h4>); i++; continue }
    if (/^\s*[-*]\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s/, ''))
      blocks.push(<ul key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ul>); continue
    }
    if (/^\s*\d+\.\s/.test(line)) {
      const items: string[] = []
      while (i < lines.length && /^\s*\d+\.\s/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+\.\s/, ''))
      blocks.push(<ol key={k++}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</ol>); continue
    }
    if (!line.trim()) { i++; continue }
    const para: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(```|#{2,4}\s|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) para.push(lines[i++])
    blocks.push(<p key={k++}>{inline(para.join(' '))}</p>)
  }
  return <>{blocks}</>
}
