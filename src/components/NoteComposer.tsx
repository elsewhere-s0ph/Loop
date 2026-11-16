import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { createNote, addAttachment } from '../db/services'
import { analyzeNote, aiPrefs } from '../lib/ai'
import { b64 } from '../lib/crypto'
import { extractLinks, htmlToText } from '../lib/media'
import { AttachmentManager, type AttRef } from './Attachments'
import { RichTextEditor } from './RichText'
import { Btn, Modal, useToast } from './ui'

export function NoteComposer({ open, onClose, initialContent }: { open: boolean; onClose: () => void; initialContent?: string }) {
  const [html, setHtml] = useState('')
  const [atts, setAtts] = useState<AttRef[]>([])
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  useEffect(() => { if (open) { setHtml(initialContent ?? ''); setAtts([]) } }, [open, initialContent])

  const save = async () => {
    const text = htmlToText(html).trim()
    if (!text && atts.length === 0) return
    const id = await createNote({ content: html, links: extractLinks(text) })
    for (const a of atts) await addAttachment({ parentType: 'note', parentId: id, kind: a.kind, mimeType: a.mimeType, blob: a.blob, durationSec: a.durationSec })
    onClose()
  }
  const analyze = async () => {
    const cfg = aiPrefs.get()
    if (!cfg) return toast('Configura la chiave AI in Altro → AI')
    setBusy(true)
    try {
      const audio = atts.find(a => a.kind === 'audio')
      const audioPart = audio && cfg.provider === 'gemini' ? { mime: audio.mimeType.split(';')[0], b64: b64.fromBytes(new Uint8Array(await audio.blob.arrayBuffer())) } : undefined
      const r = await analyzeNote(cfg, htmlToText(html), audioPart)
      const extra = `<p><b>Sintesi AI:</b> ${r.summary}</p>` +
        (r.actions.length ? `<p><b>Passi suggeriti:</b></p><ul>${r.actions.map(a => `<li>${a.replace(/</g, '&lt;')}</li>`).join('')}</ul>` : '') +
        (r.amounts.length ? `<p><b>Cifre:</b> ${r.amounts.join(' · ')}</p>` : '')
      setHtml(h => h + extra)
      toast('Analisi AI aggiunta al contenuto')
    } catch (e) { toast(`AI: ${(e as Error).message.slice(0, 80)}`) }
    setBusy(false)
  }
  return (
    <Modal open={open} onClose={onClose} title="Nota rapida" wide>
      <div className="space-y-4">
        <RichTextEditor value={html} onChange={setHtml} placeholder="Cattura un pensiero, un link, una foto…" />
        <AttachmentManager value={atts} onChange={setAtts} />
        <div className="flex justify-between gap-2">
          <Btn variant="soft" disabled={busy} onClick={analyze}><span className="flex items-center gap-1"><Sparkles size={14} />{busy ? 'Analizzo…' : 'Analizza con AI'}</span></Btn>
          <div className="flex gap-2"><Btn variant="ghost" onClick={onClose}>Annulla</Btn><Btn onClick={save}>Salva in Inbox</Btn></div>
        </div>
      </div>
    </Modal>
  )
}