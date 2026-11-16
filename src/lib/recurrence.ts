import type { LoopItem, Recurrence } from '../db/schema'

export type Occurrence = { item: LoopItem; start: number; end?: number; key: string; isVirtual: boolean }
const DAY = 86400000
const WEEK = 7 * DAY
const weekStart = (ts: number) => { const d = new Date(ts); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d.getTime() }

export const describeRecurrence = (r?: Recurrence): string => {
  if (!r || r.frequency === 'none') return ''
  const n = r.interval > 1 ? `${r.interval} ` : ''
  if (r.frequency === 'daily') return `Ogni ${n}${r.interval > 1 ? 'giorni' : 'giorno'}`
  if (r.frequency === 'weekly') {
    const days = (r.daysOfWeek ?? []).map(d => ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'][d]).join(', ')
    return `Ogni ${n}${r.interval > 1 ? 'settimane' : 'settimana'}${days ? ` (${days})` : ''}`
  }
  if (r.frequency === 'monthly') return `Ogni ${n}${r.interval > 1 ? 'mesi' : 'mese'}`
  return `Ogni ${n}${r.interval > 1 ? 'anni' : 'anno'}`
}

function step(ts: number, r: Recurrence, base: number): number {
  const d = new Date(ts)
  if (r.frequency === 'daily') { d.setDate(d.getDate() + r.interval); return d.getTime() }
  if (r.frequency === 'monthly') { d.setMonth(d.getMonth() + r.interval); return d.getTime() }
  if (r.frequency === 'yearly') { d.setFullYear(d.getFullYear() + r.interval); return d.getTime() }
  if (r.frequency === 'weekly') {
    const days = r.daysOfWeek?.length ? r.daysOfWeek : [new Date(base).getDay()]
    const bw = weekStart(base)
    for (let i = 1; i <= 7 * r.interval + 7; i++) {
      const nd = new Date(ts); nd.setDate(nd.getDate() + i)
      const wi = Math.round((weekStart(nd.getTime()) - bw) / WEEK)
      if (days.includes(nd.getDay()) && wi % r.interval === 0) return nd.getTime()
    }
    d.setDate(d.getDate() + 7 * r.interval); return d.getTime()
  }
  return ts + DAY
}

export function expandOccurrences(items: LoopItem[], from: number, to: number): Occurrence[] {
  const out: Occurrence[] = []
  for (const it of items) {
    const base = it.scheduledAt
    if (base === undefined) continue
    const r = it.recurrence
    const dur = it.endAt ? it.endAt - base : 0
    if (!r || r.frequency === 'none' || r.interval < 1) {
      if (base >= from && base < to) out.push({ item: it, start: base, end: it.endAt, key: it.id, isVirtual: false })
      continue
    }
    const limit = r.endDate ? Math.min(to, r.endDate + DAY) : to
    let cursor = base, guard = 0
    while (cursor < limit && guard < 1500) {
      if (cursor >= from) out.push({ item: it, start: cursor, end: dur ? cursor + dur : undefined, key: `${it.id}@${cursor}`, isVirtual: cursor !== base })
      const nxt = step(cursor, r, base)
      if (nxt <= cursor) break
      cursor = nxt; guard++
    }
  }
  return out.sort((a, b) => a.start - b.start)
}

export function nextOccurrenceAfter(it: LoopItem, after: number): number | null {
  const r = it.recurrence
  if (!r || r.frequency === 'none') return null
  const base = it.scheduledAt ?? after
  let cursor = base
  for (let i = 0; i < 2000; i++) {
    const nxt = step(cursor, r, base)
    if (nxt > after) return nxt
    if (nxt <= cursor) return null
    cursor = nxt
  }
  return null
}