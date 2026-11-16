import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, FileUp, Mic, X } from 'lucide-react'
import { compressImage, formatBytes } from '../lib/media'
import { useAttachments } from '../hooks/useDb'
import { AudioPlayer, AudioRecorder } from './Audio'
import { IconBtn } from './ui'

export type AttRef = { id?: string; kind: 'audio' | 'image' | 'file'; mimeType: string; blob: Blob; durationSec?: number }

export function AttachmentThumb({ att, onRemove }: { att: AttRef; onRemove?: () => void }) {
  const url = useMemo(() => att.kind === 'image' ? URL.createObjectURL(att.blob) : '', [att])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return (
    <div className="relative">
      {att.kind === 'image' && <img src={url} alt="allegato" className="h-20 w-20 rounded-xl object-cover" />}
      {att.kind === 'audio' && <div className="w-56 max-w-full"><AudioPlayer blob={att.blob} duration={att.durationSec} /></div>}
      {att.kind === 'file' && (
        <div className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl bg-surface2 text-muted">
          <FileUp size={18} />
          <span className="text-[10px]">{att.mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'}</span>
          <span className="text-[10px]">{formatBytes(att.blob.size)}</span>
        </div>
      )}
      {onRemove && (
        <button onClick={onRemove} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-danger text-bg shadow"><X size={12} /></button>
      )}
    </div>
  )
}

export function AttachmentManager({ value, onChange }: { value: AttRef[]; onChange: (v: AttRef[]) => void }) {
  const [recOpen, setRecOpen] = useState(false)
  const imgRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const addImage = async (f: File) => {
    const { blob, mime } = await compressImage(f)
    onChange([...value, { kind: 'image', mimeType: mime, blob }])
  }
  return (
    <div>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Allegati</span>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3">
          {value.map((a, i) => <AttachmentThumb key={a.id ?? i} att={a} onRemove={() => onChange(value.filter((_, j) => j !== i))} />)}
        </div>
      )}
      <div className="flex gap-2">
        <IconBtn title="Foto / immagine" onClick={() => imgRef.current?.click()} className="!bg-surface2"><Camera size={16} /></IconBtn>
        <IconBtn title="Nota audio" onClick={() => setRecOpen(true)} className="!bg-surface2"><Mic size={16} /></IconBtn>
        <IconBtn title="File / PDF" onClick={() => fileRef.current?.click()} className="!bg-surface2"><FileUp size={16} /></IconBtn>
      </div>
      <input ref={imgRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = '' }} />
      <input ref={fileRef} type="file" accept=".pdf,application/pdf,image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onChange([...value, { kind: f.type.startsWith('image/') ? 'image' : 'file', mimeType: f.type || 'application/octet-stream', blob: f }]); e.target.value = '' }} />
      <AudioRecorder open={recOpen} onClose={() => setRecOpen(false)}
        onRecorded={(blob, duration, mime) => onChange([...value, { kind: 'audio', mimeType: mime, blob, durationSec: duration }])} />
    </div>
  )
}

export function AttachmentList({ ids }: { ids: string[] }) {
  const atts = useAttachments(ids)
  if (atts.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3">
      {atts.map(a => <AttachmentThumb key={a.id} att={{ id: a.id, kind: a.kind, mimeType: a.mimeType, blob: a.blob, durationSec: a.durationSec }} />)}
    </div>
  )
}