import { useMemo, useState } from 'react'
import { Clock, MapPin, Paperclip, Pencil, RotateCcw, Search, Star, Trash2 } from 'lucide-react'
import { db, type LoopItem } from '../db/schema'
import { deleteItem, reopenItem, toggleFocus } from '../db/services'
import { C, TYPE_META, effDate, fmtDateTime, relDay } from '../lib/meta'
import { AttachmentList } from './Attachments'
import { RichText } from './RichText'
import { Badge, Chip, Empty, IconBtn, Seg, TextInput, useToast } from './ui'
import { ItemForm } from './forms'

type Filter = 'all' | 'focus' | 'fact' | 'done' | 'meet' | 'event' | 'attached'
type Period = 'all' | '7' | '30' | '365'

export function Timeline({ items }: { items: LoopItem[] }) {
  const [view, setView] = useState<'path' | 'list'>('path')
  const [filter, setFilter] = useState<Filter>('all')
  const [period, setPeriod] = useState<Period>('all')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<LoopItem | null>(null)
  const toast = useToast()

  const list = useMemo(() => {
    const cutoff = period === 'all' ? 0 : Date.now() - parseInt(period) * 86400000
    return items
      .filter(i => i.status !== 'pending')
      .filter(i => effDate(i) >= cutoff)
      .filter(i => {
        if (filter === 'focus') return i.isFocus
        if (filter === 'fact') return i.type === 'fact'
        if (filter === 'done') return i.type === 'action' && i.status === 'completed'
        if (filter === 'meet') return i.type === 'meet'
        if (filter === 'event') return i.type === 'event'
        if (filter === 'attached') return i.attachmentIds.length > 0
        return true
      })
      .filter(i => !q || (i.title + ' ' + i.content + ' ' + (i.outcome ?? '')).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => effDate(b) - effDate(a))
  }, [items, filter, period, q])

  const remove = async (it: LoopItem) => {
    await deleteItem(it.id)
    toast('Elemento eliminato', { label: 'Annulla', fn: () => { void db.items.add(it) } })
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Timeline</h2>
        <Seg value={view} onChange={setView} options={[{ value: 'path', label: 'Percorso' }, { value: 'list', label: 'Elenco' }]} />
      </div>
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca nel Loop…" className="!pl-9" />
      </div>
      <div className="loop-scroll mb-4 flex gap-2 overflow-x-auto pb-1">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>Tutti</Chip>
        <Chip active={filter === 'focus'} onClick={() => setFilter('focus')} color={C.focus}>★ Focus</Chip>
        <Chip active={filter === 'fact'} onClick={() => setFilter('fact')} color={C.fact}>Fatti</Chip>
        <Chip active={filter === 'done'} onClick={() => setFilter('done')} color={C.outcome}>Azioni concluse</Chip>
        <Chip active={filter === 'meet'} onClick={() => setFilter('meet')} color={C.meet}>Incontri</Chip>
        <Chip active={filter === 'event'} onClick={() => setFilter('event')} color={C.event}>Eventi</Chip>
        <Chip active={filter === 'attached'} onClick={() => setFilter('attached')}>Con allegati</Chip>
        <select value={period} onChange={e => setPeriod(e.target.value as Period)}
          className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-muted outline-none">
          <option value="all">Tutto il periodo</option><option value="7">Ultimi 7 giorni</option>
          <option value="30">Ultimi 30 giorni</option><option value="365">Ultimo anno</option>
        </select>
      </div>

      {list.length === 0 && <Empty title="Nessun nodo nella Timeline" hint="Completa un'azione o registra un fatto per costruire la memoria di questo Loop." />}

      <div className={view === 'path' ? 'relative ml-4 border-l-2 border-line pl-8' : 'space-y-2'}>
        {list.map(it => <Node key={it.id} it={it} view={view} onEdit={() => setEditing(it)} onDelete={() => remove(it)} />)}
      </div>

      <ItemForm open={!!editing} onClose={() => setEditing(null)} item={editing} loopId={editing?.loopId} />
    </div>
  )
}

function Node({ it, view, onEdit, onDelete }: { it: LoopItem; view: 'path' | 'list'; onEdit: () => void; onDelete: () => void }) {
  const M = TYPE_META[it.type]
  const done = it.status === 'completed'
  const color = it.isFocus ? C.focus : done ? C.outcome : M.color
  const label = it.isFocus ? 'FOCUS' : done && it.type === 'action' ? (it.outcome ? 'ESITO' : 'AZIONE') : M.label.toUpperCase()
  const Icon = it.isFocus ? Star : done ? TYPE_META.action.icon : M.icon
  const date = effDate(it)

  const actions = (
    <div className="flex shrink-0 items-center">
      <IconBtn title="Punto Chiave" onClick={() => toggleFocus(it.id)} className={it.isFocus ? '!text-focus' : ''}><Star size={15} fill={it.isFocus ? 'currentColor' : 'none'} /></IconBtn>
      <IconBtn title="Modifica" onClick={onEdit}><Pencil size={15} /></IconBtn>
      {done && <IconBtn title="Riapri" onClick={() => reopenItem(it.id)}><RotateCcw size={15} /></IconBtn>}
      <IconBtn title="Elimina" onClick={onDelete} className="hover:!text-danger"><Trash2 size={15} /></IconBtn>
    </div>
  )

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Badge color={color}>{label}</Badge>
        {view === 'list' && actions}
      </div>
      <p className="mt-1 font-semibold leading-snug">{it.title}</p>
      {it.content && <RichText html={it.content} className="mt-1 text-sm text-muted" />}
      {it.outcome && (
        <div className="mt-2 rounded-xl border border-outcome/30 bg-outcome/10 px-3 py-2 text-sm">
          <span className="text-xs font-bold uppercase tracking-wider text-outcome">Esito · </span>{it.outcome}
        </div>
      )}
      <AttachmentList ids={it.attachmentIds} />
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        <span className="flex items-center gap-1"><Clock size={12} />{relDay(date)} · {fmtDateTime(date)}</span>
        {it.locationOrLink && <span className="flex items-center gap-1"><MapPin size={12} />{it.locationOrLink}</span>}
        {it.attachmentIds.length > 0 && <span className="flex items-center gap-1"><Paperclip size={12} />{it.attachmentIds.length}</span>}
      </div>
    </>
  )

  if (view === 'list') return <div className="rounded-2xl bg-surface p-4">{body}</div>
  return (
    <div className="relative mb-5">
      <span className="absolute -left-[49px] top-0 grid h-8 w-8 place-items-center rounded-full border-2 border-bg" style={{ background: color, color: '#0b0c0e' }}>
        <Icon size={15} />
      </span>
      <div className="rounded-2xl bg-surface p-4">
        {body}
        <div className="mt-2 flex justify-end border-t border-line pt-2">{actions}</div>
      </div>
    </div>
  )
}