'use client'
import { useMemo } from 'react'

// Renderer markdown ringan khusus jawaban AI Financial Coach.
// Aman: tanpa dangerouslySetInnerHTML — semua teks jadi React text node,
// lalu **bold**, *italic*, bullet list, numbered list, dan heading di-parse manual.
function renderInline(text, prefix) {
  const out = []
  const re = /\*\*(.+?)\*\*|\*([^*\n]+?)\*/g
  let last = 0
  let m
  let k = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) {
      out.push(<strong key={`${prefix}-${k++}`} className="font-semibold text-foreground">{m[1]}</strong>)
    } else {
      out.push(<em key={`${prefix}-${k++}`}>{m[2]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out.length > 0 ? out : [text]
}

export default function CoachMarkdown({ text }) {
  const blocks = useMemo(() => {
    const out = []
    const lines = String(text ?? '').split('\n')
    let list = null
    const flush = () => { if (list) { out.push(list); list = null } }
    for (const line of lines) {
      const bullet = line.match(/^\s*[*•-]\s+(.+)$/)
      const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/)
      const heading = line.match(/^\s*#{1,4}\s+(.+)$/)
      if (bullet) {
        if (!list || list.type !== 'ul') { flush(); list = { type: 'ul', items: [] } }
        list.items.push(bullet[1])
      } else if (ordered) {
        if (!list || list.type !== 'ol') { flush(); list = { type: 'ol', items: [] } }
        list.items.push(ordered[1])
      } else {
        flush()
        if (heading) out.push({ type: 'h', text: heading[1] })
        else if (line.trim() !== '') out.push({ type: 'p', text: line })
      }
    }
    flush()
    return out
  }, [text])

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        if (b.type === 'ul') {
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/70" />
                  <span className="min-w-0">{renderInline(it, `u${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          )
        }
        if (b.type === 'ol') {
          return (
            <ol key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="shrink-0 font-semibold text-muted-foreground">{j + 1}.</span>
                  <span className="min-w-0">{renderInline(it, `o${i}-${j}`)}</span>
                </li>
              ))}
            </ol>
          )
        }
        if (b.type === 'h') {
          return <p key={i} className="font-semibold text-foreground pt-1">{renderInline(b.text, `h${i}`)}</p>
        }
        return <p key={i}>{renderInline(b.text, `p${i}`)}</p>
      })}
    </div>
  )
}
