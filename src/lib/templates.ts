import { createArea, createBudget, addBudgetEntry, createItem, createLoop, uid } from '../db/services'
import { db } from '../db/schema'

export type Template = {
  id: string; title: string; desc: string; icon: string; color: string
  areaName: string; goal: string
  facts: string[]; steps: { title: string; now?: boolean; inDays?: number; checklist?: string[] }[]
  meets: { title: string; inDays: number; hour: number; location?: string }[]
  events: { title: string; inDays: number }[]
  budget?: { ceiling: number; entries: { title: string; amount: number; type: 'estimate' | 'actual' }[] }
}
const day = (n: number, h = 9) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(h, 0, 0, 0); return d.getTime() }

export const TEMPLATES: Template[] = [
  {
    id: 'reno-bath', title: 'Ristrutturazione bagno', icon: 'Hammer', color: '#f59e0b', areaName: 'Casa',
    desc: 'Preventivi, impresa, materiali, posa e collaudo con budget dedicato.',
    goal: 'Bagno rifinito e collaudato entro 8 settimane',
    facts: ['Misurato vano e fotografato stato impianti', 'Scelta formato piastrelle: gres 60x60'],
    steps: [
      { title: 'Richiedere 3 preventivi a imprese locali', now: true, checklist: ['Lista imprese', 'Invio richieste', 'Confronto voci'] },
      { title: 'Firmare contratto con impresa scelta', inDays: 7, checklist: ['Verifica clausole', 'Acconto', 'Copia firmata'] },
      { title: 'Ordinare sanitari e rubinetteria', inDays: 12 },
      { title: 'Confermare data posa piastrelle', inDays: 18 },
      { title: 'Collaudo impianti e consegna', inDays: 45 },
    ],
    meets: [{ title: 'Sopralluogo con impresa', inDays: 3, hour: 15, location: 'Via di casa' }, { title: 'Scelta materiali in showroom', inDays: 9, hour: 11 }],
    events: [{ title: 'Inizio lavori', inDays: 20 }],
    budget: { ceiling: 8000, entries: [{ title: 'Preventivo impresa (stima)', amount: 5200, type: 'estimate' }, { title: 'Materiali (stima)', amount: 1800, type: 'estimate' }] },
  },
  {
    id: 'bonus-tax', title: 'Pratica bonus / detrazione', icon: 'Landmark', color: '#3b82f6', areaName: 'Burocrazia',
    desc: 'Documenti, CAF, scadenze fiscali e ricevute in un unico contesto.',
    goal: 'Pratica completa e inviata entro la scadenza fiscale',
    facts: ['Verificata categoria di intervento ammessa', 'Raccolta prima tranche di fatture'],
    steps: [
      { title: 'Raccogliere fatture e bonifici parlanti', now: true, checklist: ['Fatture impresa', 'Bonifici', 'Scheda descrittiva'] },
      { title: 'Inviare documentazione al CAF', inDays: 5 },
      { title: 'Prenotare appuntamento Agenzia Entrate', inDays: 10 },
      { title: 'Conservare ricevuta di invio', inDays: 20 },
    ],
    meets: [{ title: 'Appuntamento CAF', inDays: 6, hour: 10, location: 'CAF di zona' }],
    events: [{ title: 'Scadenza invio domanda', inDays: 30 }],
  },
  {
    id: 'thesis', title: 'Tesi di laurea', icon: 'GraduationCap', color: '#22c55e', areaName: 'Studio',
    desc: 'Indice, capitoli, revisioni del relatore e consegna finale.',
    goal: 'Tesi revisionata e depositata entro la sessione',
    facts: ['Concordato indice preliminare con il relatore', 'Definita domanda di ricerca'],
    steps: [
      { title: 'Ricerca bibliografica e schede fonti', now: true, checklist: ['Catalogo biblioteca', 'Database articoli', 'Zotero'] },
      { title: 'Scrivere capitolo 1', inDays: 14 },
      { title: 'Inviare bozza al relatore', inDays: 28 },
      { title: 'Preparare slide discussione', inDays: 50 },
    ],
    meets: [{ title: 'Ricevimento relatore', inDays: 7, hour: 14, location: 'Studio docente' }],
    events: [{ title: 'Deposito tesi', inDays: 60 }],
  },
  {
    id: 'trip-japan', title: 'Viaggio in Giappone', icon: 'Plane', color: '#a855f7', areaName: 'Personale',
    desc: 'Itinerario, prenotazioni, documenti e budget di viaggio.',
    goal: 'Itinerario chiuso e prenotazioni confermate',
    facts: ['Scelte date: 12 notti tra Tokyo, Kyoto e Osaka', 'Passaporto verificato in scadenza'],
    steps: [
      { title: 'Prenotare voli', now: true, checklist: ['Confronto tariffe', 'Bagaglio', 'Assicurazione'] },
      { title: 'Prenotare alloggi Tokyo', inDays: 4 },
      { title: 'Attivare JR Pass / trasporti', inDays: 10 },
      { title: 'Check-in online e documenti', inDays: 25 },
    ],
    meets: [{ title: 'Visto / consolato (se necessario)', inDays: 12, hour: 9 }],
    events: [{ title: 'Partenza', inDays: 40 }],
    budget: { ceiling: 4500, entries: [{ title: 'Voli (stima)', amount: 1100, type: 'estimate' }, { title: 'Alloggi (stima)', amount: 1600, type: 'estimate' }] },
  },
]

export async function cloneTemplate(t: Template): Promise<string> {
  const areas = await db.areas.toArray()
  let area = areas.find(a => a.name.toLowerCase() === t.areaName.toLowerCase())
  const areaId = area?.id ?? await createArea({ name: t.areaName, icon: t.icon, color: t.color })
  const loopId = await createLoop({ title: t.title, goal: t.goal, areaId, status: 'active' })
  for (const f of t.facts) await createItem({ loopId, type: 'fact', title: f, isFocus: false })
  for (const s of t.steps) await createItem({
    loopId, type: 'action', title: s.title, priority: s.now ? 'now' : 'later',
    scheduledAt: s.inDays !== undefined ? day(s.inDays) : undefined,
    checklist: s.checklist?.map(text => ({ id: uid(), text, done: false })),
  })
  for (const m of t.meets) await createItem({ loopId, type: 'meet', title: m.title, scheduledAt: day(m.inDays, m.hour), endAt: day(m.inDays, m.hour + 1), locationOrLink: m.location })
  for (const e of t.events) await createItem({ loopId, type: 'event', title: e.title, scheduledAt: day(e.inDays, 12) })
  if (t.budget) {
    const bid = await createBudget({ loopId, name: `Budget ${t.title}`, ceiling: t.budget.ceiling })
    for (const e of t.budget.entries) await addBudgetEntry({ budgetId: bid, loopId, title: e.title, amount: e.amount, entryType: e.type })
  }
  return loopId
}