import { ChevronLeft, ChevronRight } from 'lucide-react'
import { startOfDay } from '../lib/meta'

export function MonthCalendar({ month, onMonth, selected, onSelect, markers }: {
  month: Date; onMonth: (d: Date) => void; selected: number; onSelect: (ts: number) => void; markers: Record<number, number>
}) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1)
  const start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  const today = startOfDay(Date.now())
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><ChevronLeft size={16} /></button>
        <p className="text-sm font-bold capitalize">{new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' }).format(month)}</p>
        <button onClick={() => onMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><ChevronRight size={16} /></button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase text-muted">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(d => <span key={d} className="py-1">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map(d => {
          const ts = startOfDay(d.getTime())
          const inMonth = d.getMonth() === month.getMonth()
          const count = markers[ts] ?? 0
          return (
            <button key={ts} onClick={() => onSelect(ts)}
              className={`relative flex h-10 flex-col items-center justify-center rounded-xl text-sm transition ${selected === ts ? 'bg-meet font-bold text-bg' : inMonth ? 'text-ink hover:bg-surface2' : 'text-muted/40 hover:bg-surface2'} ${ts === today && selected !== ts ? 'ring-1 ring-meet' : ''}`}>
              {d.getDate()}
              {count > 0 && <span className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${selected === ts ? 'bg-bg' : 'bg-action'}`} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}