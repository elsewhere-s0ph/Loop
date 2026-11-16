import { useMemo, useState } from 'react'
import { CalendarDays, Check, Download, ExternalLink, Repeat, Star } from 'lucide-react'
import type { LoopItem } from '../db/schema'
import { useAllItems, useAreas, useLoops } from '../hooks/useDb'
import { buildICS, downloadICS, googleCalendarUrl, type CalEvent } from '../lib/calendar'
import { C, TYPE_META, fmtDate, fmtTime, fromDateInput, relDay, startOfDay, toDateInput } from '../lib/meta'
import { expandOccurrences, describeRecurrence, type Occurrence } from '../lib/recurrence'
import { MonthCalendar } from './Calendar'
import { OutcomeModal } from './forms'
import { Badge, Btn, Chip, Empty, Field, IconBtn, Seg, Select, TextInput } from './ui'

export function AgendaPage({ onOpenLoop }: { onOpenLoop: (id: string) => void }) {
  const items = useAllItems(); const loops = useLoops(); const areas = useAreas()
  const [mode, setMode] = useState<'month' | 'range'>('month')
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(startOfDay(Date.now()))
  const [from, setFrom] = useState(toDateInput(Date.now()))
  const [to, setTo] = useState(toDateInput(Date.now() + 14 * 86400000))
  const [types, setTypes] = useState<Record<string, boolean>>({ meet: true, event: true, action: true })
  const [area, setArea] = useState('all')
  const [loop, setLoop] = useState('all')
  const [fav, setFav] = useState(false)
  const [outcome, setOutcome] = useState<{ item: LoopItem; start: number } | null>(null)

  const range = useMemo(() => {
    if (mode === 'range') return { from: fromDateInput(from), to: fromDateInput(to) + 86400000 }
    const first = new Date(month.getFullYear(), month.getMonth(), 1)
    const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
    return { from: start.getTime(), to: start.getTime() + 42 * 86400000 }
  }, [mode, month, from, to])

  const loopById = useMemo(() => new Map(loops.map(l => [l.id, l])), [loops])
  const occ = useMemo(() => expandOccurrences(
    items.filter(i => i.scheduledAt !== undefined)
      .filter(i => types[i.type])
      .filter(i => i.type === 'event' || i.status === 'pending')
      .filter(i => area === 'all' || loopById.get(i.loopId)?.areaId === area)
      .filter(i => loop === 'all' || i.loopId === loop)
      .filter(i => !fav || loopById.get(i.loopId)?.isFavorite),
    range.from, range.to), [items, types, area, loop, fav, loopById, range])

  const markers = useMemo(() => { const m: Record<number, number> = {}; for (const o of occ) { const d = startOfDay(o.start); m[d] = (m[d] ?? 0) + 1 } return m }, [occ])
  const visible = mode === 'month' ? occ.filter(o => startOfDay(o.start) === selected) : occ
  const days = [...new Set(visible.map(o => startOfDay(o.start)))]

  const toCal = (o: Occurrence): CalEvent => ({ uid: o.key, title: o.item.title, start: o.start, end: o.end, location: o.item.locationOrLink, description: `${loopById.get(o.item.loopId)?.title ?? ''} · ${o.item.content.replace(/<[^>]*>/g, '')}` })
  const exportAll = () => downloadICS('loop-agenda.ics', buildICS(visible.map(toCal)))

  return (
    <div className="loop-scroll p-5 split:h-full split:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Agenda</h1>
        <div className="flex items-center gap-2">
          <Seg value={mode} onChange={setMode} options={[{ value: 'month', label: 'Mese' }, { value: 'range', label: 'Intervallo' }]} />
          <Btn variant="soft" onClick={exportAll}><span className="flex items-center gap-1"><Download size={14} /> .ics</span></Btn>
        </div>
      </div>

      <div className="mt-4 split:grid split:grid-cols-[340px_1fr] split:gap-5">
        <div className="space-y-3">
          {mode === 'month'
            ? <MonthCalendar month={month} onMonth={setMonth} selected={selected} onSelect={setSelected} markers={markers} />
            : <div className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-surface p-3">
                <Field label="Dal"><TextInput type="date" value={from} onChange={e => setFrom(e.target.value)} /></Field>
                <Field label="Al"><TextInput type="date" value={to} onChange={e => setTo(e.target.value)} /></Field>
              </div>}
          <div className="flex flex-wrap gap-2">
            {(['meet', 'event', 'action'] as const).map(t => <Chip key={t} active={types[t]} color={TYPE_META[t].color} onClick={() => setTypes(x => ({ ...x, [t]: !x[t] }))}>{TYPE_META[t].plural}</Chip>)}
            <Chip active={fav} color={C.budget} onClick={() => setFav(f => !f)}><span className="flex items-center gap-1"><Star size={11} /> Preferiti</span></Chip>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={area} onChange={e => setArea(e.target.value)}><option value="all">Tutte le aree</option>{areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</Select>
            <Select value={loop} onChange={e => setLoop(e.target.value)}><option value="all">Tutti i Loop</option>{loops.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}</Select>
          </div>
        </div>

        <div className="mt-5 split:mt-0">
          <p className="mb-2 text-sm font-bold text-meet">{mode === 'month' ? `${relDay(selected)} · ${fmtDate(selected)}` : `${fmtDate(range.from)} → ${fmtDate(range.to - 86400000)}`} · {visible.length} impegni</p>
          {visible.length === 0 && <Empty title="Nessun impegno" hint="Cambia intervallo o filtri, oppure crea un appuntamento." icon={<CalendarDays size={28} />} />}
          {days.map(d => (
            <div key={d} className="mb-4">
              {mode === 'range' && <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">{relDay(d)} · {fmtDate(d)}</p>}
              {visible.filter(o => startOfDay(o.start) === d).map(o => {
                const M = TYPE_META[o.item.type]; const I = M.icon
                const lp = loopById.get(o.item.loopId)
                const ar = areas.find(a => a.id === lp?.areaId)
                const rec = describeRecurrence(o.item.recurrence)
                return (
                  <div key={o.key} className="mb-2 rounded-2xl bg-surface p-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: M.color + '22', color: M.color }}><I size={17} /></span>
                      <button onClick={() => onOpenLoop(o.item.loopId)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-sm font-semibold">{o.item.title}</p>
                        <p className="text-xs text-muted">{fmtTime(o.start)}{o.end ? `–${fmtTime(o.end)}` : ''} · {lp?.title}{ar ? ` · ${ar.name}` : ''}</p>
                        {rec && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-focus"><Repeat size={10} />{rec}</p>}
                      </button>
                      <div className="flex shrink-0 items-center">
                        {o.item.status === 'pending' && <IconBtn title="Completa" onClick={() => setOutcome({ item: o.item, start: o.start })} className="hover:!text-outcome"><Check size={16} /></IconBtn>}
                        <a title="Google Calendar" href={googleCalendarUrl(toCal(o))} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><ExternalLink size={15} /></a>
                        <IconBtn title="Scarica .ics" onClick={() => downloadICS(`${o.item.title}.ics`, buildICS([toCal(o)]))}><Download size={15} /></IconBtn>
                      </div>
                    </div>
                    {ar && <div className="mt-2"><Badge color={ar.color}>{ar.name}</Badge></div>}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <OutcomeModal item={outcome?.item ?? null} occurrenceStart={outcome?.start} onClose={() => setOutcome(null)} />
    </div>
  )
}