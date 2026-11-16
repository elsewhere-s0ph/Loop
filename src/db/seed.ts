import { db, type Area, type Budget, type BudgetEntry, type Loop, type LoopItem, type Note } from './schema'
import { now, uid, wipeDatabase } from './services'

const day = (offset: number, hour = 9, min = 0) => {
  const t = new Date(); t.setDate(t.getDate() + offset); t.setHours(hour, min, 0, 0); return t.getTime()
}
const item = (loopId: string, type: LoopItem['type'], title: string, extra: Partial<LoopItem> = {}): LoopItem => ({
  id: uid(), loopId, type, title, content: '', attachmentIds: [], isFocus: false,
  status: type === 'fact' || type === 'event' ? 'recorded' : 'pending',
  createdAt: day(0), updatedAt: day(0), ...extra,
})

export async function seedCatalog() {
  await wipeDatabase()
  const t = now()
  const casa: Area = { id: uid(), name: 'Casa', icon: 'Home', color: '#f59e0b', isFavorite: true, order: 1, createdAt: t, updatedAt: t }
  const buro: Area = { id: uid(), name: 'Burocrazia', icon: 'FileText', color: '#3b82f6', isFavorite: false, order: 2, createdAt: t, updatedAt: t }
  const studio: Area = { id: uid(), name: 'Studio', icon: 'GraduationCap', color: '#22c55e', isFavorite: false, order: 3, createdAt: t, updatedAt: t }

  const bagno: Loop = { id: uid(), areaId: casa.id, title: 'Ristrutturazione Bagno', goal: 'Sostituire sanitari e rifare piastrelle entro dicembre', status: 'active', isFavorite: true, lastActivityAt: day(0, 9), createdAt: day(-40), updatedAt: day(0, 9) }
  const bonus: Loop = { id: uid(), areaId: buro.id, title: 'Pratica Bonus 2026', goal: 'Ottenere il bonus ristrutturazione', status: 'active', isFavorite: false, lastActivityAt: day(-2), createdAt: day(-15), updatedAt: day(-2) }
  const tesi: Loop = { id: uid(), areaId: studio.id, title: 'Tesi di Laurea', goal: 'Consegnare la tesi a marzo', status: 'paused', isFavorite: false, lastActivityAt: day(-12), createdAt: day(-60), updatedAt: day(-12) }

  const items: LoopItem[] = [
    item(bagno.id, 'meet', 'Incontro idraulico Rossi', { scheduledAt: day(0, 10, 30), locationOrLink: 'Via Roma 12' }),
    item(bagno.id, 'action', 'Firmare contratto impresa', {
      priority: 'now', scheduledAt: day(3),
      checklist: [
        { id: uid(), text: 'Sopralluogo tecnico', done: true },
        { id: uid(), text: 'Bozza contratto', done: true },
        { id: uid(), text: 'Firma digitale', done: false },
        { id: uid(), text: 'Invio documenti', done: false },
      ],
    }),
    item(bagno.id, 'action', 'Ordinare rubinetteria e accessori', { scheduledAt: day(6) }),
    item(bagno.id, 'action', 'Confermare data posa piastrelle', { scheduledAt: day(11) }),
    item(bagno.id, 'meet', 'Sopralluogo tecnico', { scheduledAt: day(4, 15) }),
    item(bagno.id, 'fact', 'Scelta piastrelle: gres porcellanato 60x60', { isFocus: true, createdAt: day(0, 9) }),
    item(bagno.id, 'action', 'Richiesta preventivo imprese', { status: 'completed', outcome: 'Preventivo ricevuto: 1.200€, esclusa certificazione finale', completedAt: day(-1, 16) }),
    item(bagno.id, 'fact', 'Telefonata al geometra Bianchi', { createdAt: day(-4, 11) }),
    item(bagno.id, 'meet', 'Sopralluogo iniziale completato', { status: 'recorded', scheduledAt: day(-9, 10), completedAt: day(-9, 11) }),
    item(bagno.id, 'event', 'Consegna chiavi appartamento', { scheduledAt: day(-30, 17) }),
    item(bonus.id, 'action', 'Inviare documenti CAF', { scheduledAt: day(-1) }),
    item(bonus.id, 'action', 'Prenotare appuntamento Agenzia Entrate'),
    item(tesi.id, 'fact', 'Concordato indice con il relatore', { createdAt: day(-12) }),
  ]

  const budget: Budget = { id: uid(), loopId: bagno.id, name: 'Budget Bagno', currency: 'EUR', ceiling: 8000, status: 'open', createdAt: day(-30), updatedAt: day(-1) }
  const entries: BudgetEntry[] = [
    { id: uid(), budgetId: budget.id, loopId: bagno.id, title: 'Preventivo impresa', amount: 3200, entryType: 'estimate', date: day(-1) },
    { id: uid(), budgetId: budget.id, loopId: bagno.id, title: 'Fattura acconto idraulico', amount: 900, entryType: 'actual', date: day(-2) },
    { id: uid(), budgetId: budget.id, loopId: bagno.id, title: 'Acquisto piastrelle', amount: 950, entryType: 'actual', date: day(-3) },
  ]

  const notes: Note[] = [
    { id: uid(), content: 'Chiamare geometra per pratica catastale', links: [], attachmentIds: [], createdAt: day(0, 8), updatedAt: day(0, 8) },
    { id: uid(), content: 'Bando bonus ristrutturazione', links: ['https://example.com/bando'], attachmentIds: [], createdAt: day(-1, 18), updatedAt: day(-1, 18) },
    { id: uid(), content: 'Foto scheda contatore da allegare alla pratica', links: [], attachmentIds: [], createdAt: day(-2, 12), updatedAt: day(-2, 12) },
  ]

  await db.transaction('rw', db.areas, db.loops, db.items, db.notes, db.budgets, db.budgetEntries, async () => {
    await db.areas.bulkAdd([casa, buro, studio])
    await db.loops.bulkAdd([bagno, bonus, tesi])
    await db.items.bulkAdd(items)
    await db.notes.bulkAdd(notes)
    await db.budgets.add(budget)
    await db.budgetEntries.bulkAdd(entries)
  })
}