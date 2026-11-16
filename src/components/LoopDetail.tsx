import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Clock, Download, ExternalLink, MapPin, Pencil, Plus, Repeat, Wallet } from 'lucide-react'
import { db, type ItemType, type LoopItem } from '../db/schema'
import { useAreas, useItems, useLoop } from '../hooks/useDb'
import { deleteItem, updateItem, updateLoop } from '../db/services'
import { buildICS, downloadICS, googleCalendarUrl } from '../lib/calendar'
import { C, STATUS_META, TYPE_META, AreaIcon, fmtDate, fmtTime, relDay } from '../lib/meta'
import { describeRecurrence, expandOccurrences } from '../lib/recurrence'
import { Badge, Btn, Empty, IconBtn, Select, useToast } from './ui'
import { BudgetModal } from './Budget'
import { ItemForm, LoopForm, OutcomeModal } from './forms'
import { Timeline } from './Timeline'

export function LoopDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const loop = useLoop(id)
  const items = useItems(id)
  const areas = useAreas()
  const toast = useToast()
  const [form, setForm] = useState<{ open: boolean; type?: ItemType; item?: LoopItem | null }>({ open: false })
  const [outcome, setOutcome] = useState<{ item: LoopItem; start?: number } | null>(null)
  const [budget, setBudget] = useState(false)
  const [editLoop, setEditLoop] = useState(false)

  const upcomingMeets = useMemo(() => expandOccurrences(items.filter(i => i.type === 'meet' && i.status === 'pending'), Date.now() - 86400000, Date.now() + 60 * 86400000), [items])

  if (!loop) return <div className="p-6"><Empty title="Loop non trovato" /></div>
  const area = areas.find(a => a.id === loop.areaId)
  const S = STATUS_META[loop.status]
  const nowActions = items.filter(i => i.type === 'action' && i.status === 'pending' && i.priority === 'now')
  const laterActions = items.filter(i => i.type === 'action' && i.status === 'pending' && i.priority !== 'now').sort((a, b) => (a.scheduledAt ?? Infinity) - (b.scheduledAt ?? Infinity))

  const remove = async (it: LoopItem) => { await deleteItem(it.id); toast('Elemento eliminato', { label: 'Annulla', fn: () => { void db.items.add(it) } }) }
  const toggleCheck = (it: LoopItem, cid: string) => updateItem(it.id, { checklist: it.checklist?.map(c => c.id === cid ? { ...c, done: !c.done } : c) })
  const cal = (it: LoopItem, start: number, end?: number) => ({ uid: `${it.id}@${start}`, title: it.title, start, end, location: it.locationOrLink, description: loop.title })

  return (
    <div className="split:grid split:h-full split:grid-cols-[2fr_3fr]">
      <div className="loop-scroll p-5 split:h-full split:overflow-y-auto split:border-r split:border-line">
        <button onClick={onBack} className="mb-4 flex items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} /> Indietro</button>
        <div className="flex flex-wrap items-center gap-2">
          {area && <Badge color={area.color}><AreaIcon name={area.icon} size={12} /> Area: {area.name}</Badge>}
          <Badge color={S.color}><S.icon size={12} /> {S.label}</Badge>
          <div className="ml-auto flex gap-1">
            <IconBtn title="Modifica Loop" onClick={() => setEditLoop(true)}><Pencil size={16} /></IconBtn>
            <Btn variant="soft" onClick={() => setBudget(true)}><span className="flex items-center gap-1"><Wallet size={15} /> Budget</span></Btn>
          </div>
        </div>
        <h1 className="mt-3 text-2xl font-bold leading-tight">{loop.title}</h1>
        {loop.goal && <p className="mt-1 text-sm text-muted">{loop.goal}</p>}
        <div className="mt-3"><Select value={loop.status} onChange={e => updateLoop(loop.id, { status: e.target.value as typeof loop.status })} className="!w-auto"><option value="active">Attivo</option><option value="paused">In pausa</option><option value="completed">Concluso</option></Select></div>

        <div className="mt-5 grid grid-cols-4 gap-2">
          {(Object.keys(TYPE_META) as ItemType[]).map(t => { const M = TYPE_META[t]; const I = M.icon; return (
            <button key={t} onClick={() => setForm({ open: true, type: t })} className="flex flex-col items-center gap-1 rounded-xl border border-line bg-surface p-3 text-xs font-semibold text-muted transition hover:text-ink" style={{ borderColor: M.color + '44' }}><I size={16} style={{ color: M.color }} />{M.label}</button>
          ) })}
        </div>

        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-muted">Adesso</h2>
        {nowActions.length === 0 && <Empty title="Nessuna azione prioritaria" hint="Crea un'azione con priorità «Da fare ora»." />}
        {nowActions.map(it => {
          const doneCount = it.checklist?.filter(c => c.done).length ?? 0
          const total = it.checklist?.length ?? 0
          return (
            <div key={it.id} className="mb-3 rounded-2xl border-l-4 bg-surface p-4" style={{ borderColor: C.action }}>
              <div className="flex items-start gap-3">
                <button onClick={() => setOutcome({ item: it })} className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-muted text-transparent transition hover:border-outcome hover:text-outcome"><Check size={14} /></button>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug">{it.title}</p>
                  {total > 0 && (
                    <>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-action" style={{ width: `${(doneCount / total) * 100}%` }} /></div>
                      <p className="mt-1 text-xs text-muted">{doneCount}/{total} completati</p>
                      <div className="mt-2 space-y-1">{it.checklist!.map(c => (
                        <button key={c.id} onClick={() => toggleCheck(it, c.id)} className="flex w-full items-center gap-2 text-left text-sm"><span className={`grid h-4 w-4 place-items-center rounded border ${c.done ? 'border-outcome bg-outcome text-bg' : 'border-line'}`}>{c.done && <Check size={10} />}</span><span className={c.done ? 'text-muted line-through' : ''}>{c.text}</span></button>
                      ))}</div>
                    </>
                  )}
                  {it.scheduledAt && <p className="mt-2 flex items-center gap-1 text-xs text-muted"><Clock size={12} /> Entro {relDay(it.scheduledAt)} · {fmtDate(it.scheduledAt)}</p>}
                </div>
                <div className="flex flex-col">
                  <IconBtn onClick={() => setForm({ open: true, item: it })}><Pencil size={15} /></IconBtn>
                  <IconBtn onClick={() => remove(it)} className="hover:!text-danger"><Plus size={15} className="rotate-45" /></IconBtn>
                </div>
              </div>
              <Btn className="mt-3 w-full !bg-outcome" onClick={() => setOutcome({ item: it })}>Completa con Esito</Btn>
            </div>
          )
        })}

        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-muted">Prossimi passi</h2>
        {laterActions.length === 0 && <p className="text-sm text-muted">Nessun passo programmato.</p>}
        {laterActions.map(it => (
          <div key={it.id} className="mb-2 flex items-center gap-3 rounded-2xl bg-surface p-3">
            <button onClick={() => setOutcome({ item: it })} className="grid h-5 w-5 shrink-0 place-items-center rounded-md border border-line text-transparent hover:border-outcome hover:text-outcome"><Check size={12} /></button>
            <span className="flex-1 text-sm font-medium">{it.title}</span>
            {it.scheduledAt && <span className="text-xs text-muted">{fmtDate(it.scheduledAt)}</span>}
            <IconBtn onClick={() => setForm({ open: true, item: it })}><Pencil size={14} /></IconBtn>
          </div>
        ))}

        <h2 className="mb-2 mt-6 text-xs font-bold uppercase tracking-widest text-muted">Prossimi incontri</h2>
        {upcomingMeets.length === 0 && <p className="text-sm text-muted">Nessun incontro in programma.</p>}
        {upcomingMeets.map(o => {
          const it = o.item
          const rec = describeRecurrence(it.recurrence)
          return (
            <div key={o.key} className="mb-2 rounded-2xl bg-surface p-3">
              <div className="flex items-center gap-3">
                <CalendarDays size={18} className="shrink-0 text-meet" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{it.title}</p>
                  <p className="text-xs text-muted">{relDay(o.start)} · {fmtDate(o.start)} · {fmtTime(o.start)}{it.locationOrLink ? ` · ${it.locationOrLink}` : ''}</p>
                  {rec && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-focus"><Repeat size={10} />{rec}</p>}
                </div>
                <div className="flex shrink-0 items-center">
                  <IconBtn title="Completa" onClick={() => setOutcome({ item: it, start: o.start })} className="hover:!text-outcome"><Check size={15} /></IconBtn>
                  <a title="Google Calendar" href={googleCalendarUrl(cal(it, o.start, o.end))} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><ExternalLink size={14} /></a>
                  <IconBtn title=".ics" onClick={() => downloadICS(`${it.title}.ics`, buildICS([cal(it, o.start, o.end)]))}><Download size={14} /></IconBtn>
                  <IconBtn onClick={() => setForm({ open: true, item: it })}><Pencil size={14} /></IconBtn>
                </div>
              </div>
            </div>
          )
        })}
        {upcomingMeets.length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin size={12} /> Gli incontri conclusi entrano nella Timeline con il loro esito.</p>}
      </div>

      <div className="loop-scroll border-t border-line p-5 split:h-full split:overflow-y-auto split:border-t-0"><Timeline items={items} /></div>

      <ItemForm open={form.open} onClose={() => setForm({ open: false })} loopId={id} defaultType={form.type} item={form.item} />
      <OutcomeModal item={outcome?.item ?? null} occurrenceStart={outcome?.start} onClose={() => setOutcome(null)} />
      {budget && <BudgetModal loop={loop} onClose={() => setBudget(false)} />}
      <LoopForm open={editLoop} onClose={() => setEditLoop(false)} loop={loop} />
    </div>
  )
}