import { useMemo, useState } from 'react'
import { Mic, Pencil, Plus, Search, Send, Sparkles, Star, Trash2 } from 'lucide-react'
import { db, type Area, type Loop, type LoopItem, type Note } from '../db/schema'
import { useAllItems, useAreas, useLoops, useNotes } from '../hooks/useDb'
import { createNote, deleteArea, deleteLoop, deleteNote, updateArea, updateLoop } from '../db/services'
import { aiPrefs, routeNote } from '../lib/ai'
import { htmlToText } from '../lib/media'
import { C, STATUS_META, TYPE_META, AreaIcon, fmtTime, startOfDay, timeAgo, usePrefs } from '../lib/meta'
import { AttachmentList } from './Attachments'
import { RichText } from './RichText'
import { NoteComposer } from './NoteComposer'
import { Badge, Btn, Chip, Confirm, Empty, IconBtn, SectionTitle, Select, TextInput, useToast } from './ui'
import { AreaForm, ItemForm, LoopForm } from './forms'

export { AgendaPage } from './Agenda'
export { SettingsPage } from './Settings'

export function HomePage({ onOpenLoop }: { onOpenLoop: (id: string) => void }) {
  const loops = useLoops(); const items = useAllItems(); const notes = useNotes(); const areas = useAreas()
  const { name } = usePrefs()
  const toast = useToast()
  const [draft, setDraft] = useState('')
  const [composer, setComposer] = useState(false)
  const [smista, setSmista] = useState<Note | null>(null)
  const [routeLoop, setRouteLoop] = useState<string | undefined>()
  const [routing, setRouting] = useState<string | null>(null)
  const h = new Date().getHours()
  const greet = h < 12 ? 'Buongiorno' : h < 18 ? 'Buon pomeriggio' : 'Buonasera'
  const today = startOfDay(Date.now())
  const todayItems = items.filter(i => i.status === 'pending' && i.scheduledAt !== undefined && i.scheduledAt >= today && i.scheduledAt < today + 86400000)
  const overdue = items.filter(i => i.status === 'pending' && i.type === 'action' && i.scheduledAt !== undefined && i.scheduledAt < today)
  const active = loops.filter(l => l.status !== 'completed')
  const favLoops = loops.filter(l => l.isFavorite)
  const favAreas = areas.filter(a => a.isFavorite)

  const send = async () => { if (!draft.trim()) return; await createNote({ content: draft.trim() }); setDraft(''); toast('Appunto catturato') }
  const removeNote = async (n: Note) => { await deleteNote(n.id); toast('Appunto eliminato', { label: 'Annulla', fn: () => { void db.notes.add(n) } }) }
  const aiRoute = async (n: Note) => {
    const cfg = aiPrefs.get()
    if (!cfg) return toast('Configura la chiave AI in Altro → AI')
    setRouting(n.id)
    try {
      const r = await routeNote(cfg, htmlToText(n.content), loops.filter(l => l.status === 'active').map(l => ({ id: l.id, title: l.title, goal: l.goal })))
      if (r.loopId) { setRouteLoop(r.loopId); setSmista(n); toast(`AI: ${loops.find(l => l.id === r.loopId)?.title} — ${r.reason}`) }
      else { setRouteLoop(undefined); setSmista(n); toast('AI: nessun Loop adatto, scegli manualmente') }
    } catch (e) { toast(`AI: ${(e as Error).message.slice(0, 80)}`) }
    setRouting(null)
  }

  return (
    <div className="loop-scroll p-5 split:h-full split:overflow-y-auto">
      <h1 className="text-3xl font-bold">{name ? `${greet}, ${name}` : greet}</h1>
      <p className="text-sm text-muted">{new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }).format(Date.now())}</p>

      <SectionTitle>Oggi</SectionTitle>
      {[...todayItems, ...overdue].map(i => {
        const M = TYPE_META[i.type]; const I = M.icon
        const late = i.scheduledAt! < today
        return (
          <button key={i.id} onClick={() => onOpenLoop(i.loopId)} className="mb-2 flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: M.color + '22', color: M.color }}><I size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold" style={{ color: M.color }}>{M.label}{i.scheduledAt ? ` · ${fmtTime(i.scheduledAt)}` : ''}</p>
              <p className="truncate font-semibold">{i.title}</p>
            </div>
            {late && <Badge color={C.danger}>Scaduto</Badge>}
          </button>
        )
      })}
      {todayItems.length + overdue.length === 0 && <Empty title="Niente in scadenza oggi" hint="Goditi la calma, oppure cattura un appunto." />}

      <div className="mt-6">
        <SectionTitle>Appunto rapido {notes.length > 0 && <span className="text-action">· {notes.length} da smistare</span>}</SectionTitle>
        <div className="flex items-center gap-2 rounded-2xl bg-surface p-2">
          <button onClick={() => setComposer(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface2 text-muted" title="Nota con foto/audio"><Mic size={16} /></button>
          <TextInput value={draft} onChange={e => setDraft(e.target.value)} placeholder="Cattura al volo…" className="!border-0 !bg-transparent" onKeyDown={e => { if (e.key === 'Enter') send() }} />
          <Btn onClick={send}><Send size={16} /></Btn>
        </div>
        {notes.length > 0 && (
          <div className="mt-2 space-y-2">
            {notes.map(n => (
              <div key={n.id} className="rounded-2xl bg-surface p-3">
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1 text-sm"><RichText html={n.content} /></div>
                  <IconBtn title="Suggerisci Loop con AI" onClick={() => aiRoute(n)} className={routing === n.id ? '!text-focus' : 'hover:!text-focus'}><Sparkles size={15} /></IconBtn>
                  <Btn variant="soft" onClick={() => { setRouteLoop(undefined); setSmista(n) }}>Smista</Btn>
                  <IconBtn onClick={() => removeNote(n)} className="hover:!text-danger"><Trash2 size={14} /></IconBtn>
                </div>
                <AttachmentList ids={n.attachmentIds} />
              </div>
            ))}
          </div>
        )}
      </div>

      {(favLoops.length > 0 || favAreas.length > 0) && (
        <div className="mt-6">
          <SectionTitle>Preferiti</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {favAreas.map(a => (
              <button key={a.id} onClick={() => toast(`Area «${a.name}»: aprila dalla tab Loop per vedere i suoi Loop`)}
                className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: a.color + '66', background: a.color + '1f', color: a.color }}>
                <AreaIcon name={a.icon} size={12} />{a.name}
              </button>
            ))}
            {favLoops.map(l => <Chip key={l.id} active={false} onClick={() => onOpenLoop(l.id)}>★ {l.title}</Chip>)}
          </div>
        </div>
      )}

      <div className="mt-6">
        <SectionTitle>Loop da riprendere</SectionTitle>
        {active.map(l => <LoopCard key={l.id} loop={l} areas={areas} items={items} onOpen={() => onOpenLoop(l.id)} />)}
        {active.length === 0 && <Empty title="Nessun Loop attivo" hint="Crea il tuo primo Loop dalla tab Loop, o clona un template da Altro → Catalogo esempi." />}
      </div>

      <NoteComposer open={composer} onClose={() => setComposer(false)} />
      <ItemForm open={!!smista} onClose={() => { setSmista(null); setRouteLoop(undefined) }} fromNote={smista} loopId={routeLoop} defaultType="fact" />
    </div>
  )
}

export function LoopCard({ loop, areas, items, onOpen, onEdit, onDelete }: {
  loop: Loop; areas: Area[]; items: LoopItem[]; onOpen: () => void; onEdit?: () => void; onDelete?: () => void
}) {
  const a = areas.find(x => x.id === loop.areaId)
  const S = STATUS_META[loop.status]
  const open = items.filter(i => i.loopId === loop.id && i.status === 'pending' && i.type === 'action').length
  return (
    <div className="mb-2 rounded-2xl bg-surface p-4">
      <div className="flex items-center gap-3">
        <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a?.color ?? C.event }} />
          <span className="truncate font-semibold">{loop.title}</span>
        </button>
        {a && <Badge color={a.color}><AreaIcon name={a.icon} size={12} />{a.name}</Badge>}
        <button onClick={() => updateLoop(loop.id, { isFavorite: !loop.isFavorite })} className={loop.isFavorite ? 'text-budget' : 'text-muted'}><Star size={16} fill={loop.isFavorite ? 'currentColor' : 'none'} /></button>
        {onEdit && <IconBtn onClick={onEdit}><Pencil size={14} /></IconBtn>}
        {onDelete && <IconBtn onClick={onDelete} className="hover:!text-danger"><Trash2 size={14} /></IconBtn>}
      </div>
      <button onClick={onOpen} className="mt-1 block text-left text-sm text-muted">{open} azioni aperte · agg. {timeAgo(loop.lastActivityAt)} · <span style={{ color: S.color }}>{S.label}</span></button>
    </div>
  )
}

export function LoopsPage({ onOpenLoop }: { onOpenLoop: (id: string) => void }) {
  const loops = useLoops(); const areas = useAreas(); const items = useAllItems()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | 'active' | 'paused' | 'completed'>('all')
  const [area, setArea] = useState('all')
  const [sort, setSort] = useState<'activity' | 'title' | 'created'>('activity')
  const [form, setForm] = useState<{ open: boolean; loop?: Loop | null }>({ open: false })
  const [areaForm, setAreaForm] = useState<{ open: boolean; area?: Area | null }>({ open: false })
  const [delArea, setDelArea] = useState<Area | null>(null)

  const list = useMemo(() => loops
    .filter(l => status === 'all' || l.status === status)
    .filter(l => area === 'all' || l.areaId === area)
    .filter(l => !q || l.title.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt - a.createdAt : b.lastActivityAt - a.lastActivityAt),
    [loops, status, area, q, sort])

  const removeLoop = async (l: Loop) => {
    const its = await db.items.where('loopId').equals(l.id).toArray()
    await deleteLoop(l.id)
    toast('Loop eliminato', { label: 'Annulla', fn: () => { void db.loops.add(l).then(() => db.items.bulkAdd(its)) } })
  }

  return (
    <div className="loop-scroll p-5 split:h-full split:overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Loop & Aree</h1>
        <Btn onClick={() => setForm({ open: true })}><span className="flex items-center gap-1"><Plus size={16} /> Nuovo Loop</span></Btn>
      </div>
      <div className="relative mt-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder="Cerca un Loop…" className="!pl-9" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Chip active={status === 'all'} onClick={() => setStatus('all')}>Tutti</Chip>
        <Chip active={status === 'active'} onClick={() => setStatus('active')} color={C.outcome}>Attivi</Chip>
        <Chip active={status === 'paused'} onClick={() => setStatus('paused')} color={C.action}>In pausa</Chip>
        <Chip active={status === 'completed'} onClick={() => setStatus('completed')} color={C.event}>Conclusi</Chip>
        <Select value={area} onChange={e => setArea(e.target.value)} className="!w-auto"><option value="all">Tutte le aree</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
        <Select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="!w-auto"><option value="activity">Attività recente</option><option value="title">Titolo</option><option value="created">Creazione</option></Select>
      </div>
      <div className="mt-4">
        {list.map(l => <LoopCard key={l.id} loop={l} areas={areas} items={items} onOpen={() => onOpenLoop(l.id)} onEdit={() => setForm({ open: true, loop: l })} onDelete={() => removeLoop(l)} />)}
        {list.length === 0 && <Empty title="Nessun Loop trovato" />}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <SectionTitle>Aree</SectionTitle>
        <Btn variant="soft" onClick={() => setAreaForm({ open: true })}><span className="flex items-center gap-1"><Plus size={14} /> Area</span></Btn>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {areas.map(a => (
          <div key={a.id} className="flex items-center gap-2 rounded-2xl bg-surface p-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: a.color + '22', color: a.color }}><AreaIcon name={a.icon} size={16} /></span>
            <span className="flex-1 truncate text-sm font-semibold">{a.name}</span>
            <IconBtn title="Preferita" onClick={() => updateArea(a.id, { isFavorite: !a.isFavorite })} className={a.isFavorite ? '!text-budget' : ''}><Star size={14} fill={a.isFavorite ? 'currentColor' : 'none'} /></IconBtn>
            <IconBtn onClick={() => setAreaForm({ open: true, area: a })}><Pencil size={14} /></IconBtn>
            <IconBtn onClick={() => setDelArea(a)} className="hover:!text-danger"><Trash2 size={14} /></IconBtn>
          </div>
        ))}
      </div>

      <LoopForm open={form.open} onClose={() => setForm({ open: false })} loop={form.loop} onCreated={onOpenLoop} />
      <AreaForm open={areaForm.open} onClose={() => setAreaForm({ open: false })} area={areaForm.area} />
      <Confirm open={!!delArea} onClose={() => setDelArea(null)} title="Eliminare l'area?" message={`I Loop in «${delArea?.name}» resteranno senza area.`} onConfirm={() => delArea && deleteArea(delArea.id)} />
    </div>
  )
}