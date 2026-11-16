export type CalEvent = { uid: string; title: string; start: number; end?: number; location?: string; description?: string }
const pad = (n: number) => String(n).padStart(2, '0')
const icsDate = (ts: number) => { const d = new Date(ts); return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z` }
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')

export function buildICS(events: CalEvent[]): string {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Loop//PWA//IT', 'CALSCALE:GREGORIAN']
  for (const e of events) {
    L.push('BEGIN:VEVENT', `UID:${e.uid}@loop`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(e.start)}`, `DTEND:${icsDate(e.end ?? e.start + 3600000)}`, `SUMMARY:${esc(e.title)}`)
    if (e.location) L.push(`LOCATION:${esc(e.location)}`)
    if (e.description) L.push(`DESCRIPTION:${esc(e.description)}`)
    L.push('END:VEVENT')
  }
  L.push('END:VCALENDAR')
  return L.join('\r\n')
}
export function downloadICS(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function googleCalendarUrl(e: CalEvent): string {
  const p = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${icsDate(e.start)}/${icsDate(e.end ?? e.start + 3600000)}`, location: e.location ?? '', details: e.description ?? '' })
  return `https://calendar.google.com/calendar/render?${p}`
}