import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Bold, Highlighter, Italic, Link2, List, Unlink } from 'lucide-react'
import { sanitizeHtml } from '../lib/media'

function TB({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={title} onMouseDown={e => e.preventDefault()} onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface2 hover:text-ink">
      {children}
    </button>
  )
}

export function RichTextEditor({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)
  const [bottom, setBottom] = useState(0)
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const savedRange = useRef<Range | null>(null)

  useEffect(() => { if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value }, [value])
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setBottom(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    update()
    vv.addEventListener('resize', update); vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

  const emit = () => { if (ref.current) onChange(ref.current.innerHTML) }
  const exec = (cmd: string, val?: string) => { ref.current?.focus(); document.execCommand(cmd, false, val); emit() }
  const highlight = () => {
    const text = window.getSelection()?.toString() ?? ''
    if (!text) return
    exec('insertHTML', `<mark>${text.replace(/</g, '&lt;')}</mark>`)
  }
  const saveRange = () => { const s = window.getSelection(); if (s && s.rangeCount) savedRange.current = s.getRangeAt(0).cloneRange() }
  const applyLink = () => {
    const s = window.getSelection()
    if (savedRange.current && s) { s.removeAllRanges(); s.addRange(savedRange.current) }
    if (linkUrl.trim()) exec('createLink', linkUrl.trim())
    setLinkOpen(false); setLinkUrl('')
  }

  return (
    <div>
      <div ref={ref} contentEditable suppressContentEditableWarning data-placeholder={placeholder}
        onInput={emit} onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 150)}
        className="rt loop-scroll min-h-24 w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none transition focus:border-meet" />
      {focused && (
        <div className="fixed inset-x-0 z-40 border-t border-line bg-surface px-2 py-1 md:static md:rounded-b-xl md:border-x md:border-b" style={{ bottom }}>
          <div className="flex items-center gap-1">
            <TB title="Grassetto" onClick={() => exec('bold')}><Bold size={16} /></TB>
            <TB title="Corsivo" onClick={() => exec('italic')}><Italic size={16} /></TB>
            <TB title="Evidenzia" onClick={highlight}><Highlighter size={16} /></TB>
            <TB title="Elenco puntato" onClick={() => exec('insertUnorderedList')}><List size={16} /></TB>
            <TB title="Inserisci link" onClick={() => { saveRange(); setLinkOpen(o => !o) }}><Link2 size={16} /></TB>
            <TB title="Rimuovi link" onClick={() => exec('unlink')}><Unlink size={16} /></TB>
            {linkOpen && (
              <span className="flex min-w-0 flex-1 items-center gap-1">
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://…"
                  className="min-w-0 flex-1 rounded-lg border border-line bg-surface2 px-2 py-1 text-xs outline-none focus:border-meet"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } }} />
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={applyLink} className="rounded-lg bg-meet px-2 py-1 text-xs font-semibold text-bg">OK</button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export const RichText = ({ html, className = '' }: { html: string; className?: string }) => (
  <div className={`rt ${className}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }} />
)