import { db, type Area, type Budget, type BudgetEntry, type Loop, type LoopItem, type Note } from './schema'
import { fmtMoney } from '../lib/meta'
import { nextOccurrenceAfter } from '../lib/recurrence'

export const uid = () => crypto.randomUUID()
export const now = () => Date.now()

export async function ensurePersistentStorage(): Promise<'granted' | 'already' | 'denied'> {
  try {
    if (!navigator.storage?.persist) return 'denied'
    if (await navigator.storage.persisted()) return 'already'
    return (await navigator.storage.persist()) ? 'granted' : 'denied'
  } catch { return 'denied' }
}
export async function storageEstimate() {
  if (!navigator.storage?.estimate) return null
  const { usage = 0, quota = 0 } = await navigator.storage.estimate()
  return { usage, quota }
}
export const touchLoop = (loopId: string) => db.loops.update(loopId, { lastActivityAt: now(), updatedAt: now() })

/* Aree */
export const createArea = (data: Partial<Area> & { name: string }) =>
  db.areas.add({ id: uid(), icon: 'FileText', color: '#f59e0b', isFavorite: false, order: Date.now(), createdAt: now(), updatedAt: now(), ...data } as Area)
export const updateArea = (id: string, p: Partial<Area>) => db.areas.update(id, { ...p, updatedAt: now() })
export const deleteArea = (id: string) => db.transaction('rw', db.areas, db.loops, async () => {
  await db.loops.where('areaId').equals(id).modify({ areaId: null })
  await db.areas.delete(id)
})

/* Loop */
export const createLoop = (data: Partial<Loop> & { title: string }) => {
  const t = now()
  return db.loops.add({ id: uid(), areaId: null, goal: '', status: 'active', isFavorite: false, lastActivityAt: t, createdAt: t, updatedAt: t, ...data } as Loop)
}
export const updateLoop = (id: string, p: Partial<Loop>) => db.loops.update(id, { ...p, updatedAt: now() })
export async function deleteLoop(id: string) {
  await db.transaction('rw', db.loops, db.items, db.budgets, db.budgetEntries, db.attachments, db.reminders, async () => {
    const itemIds = (await db.items.where('loopId').equals(id).toArray()).map(i => i.id)
    const budgetIds = (await db.budgets.where('loopId').equals(id).toArray()).map(b => b.id)
    if (itemIds.length) {
      await db.attachments.where('parentId').anyOf(itemIds).delete()
      await db.reminders.where('itemId').anyOf(itemIds).delete()
    }
    if (budgetIds.length) await db.budgetEntries.where('budgetId').anyOf(budgetIds).delete()
    await db.items.where('loopId').equals(id).delete()
    await db.budgets.where('loopId').equals(id).delete()
    await db.loops.delete(id)
  })
}

/* Elementi */
export async function createItem(data: Partial<LoopItem> & { loopId: string; type: LoopItem['type']; title: string }) {
  const t = now()
  const recorded = data.type === 'fact' || data.type === 'event'
  const id = await db.items.add({ content: '', status: recorded ? 'recorded' : 'pending', isFocus: false, attachmentIds: [], createdAt: t, updatedAt: t, ...data } as LoopItem)
  await touchLoop(data.loopId)
  return id
}
export async function updateItem(id: string, p: Partial<LoopItem>) {
  const it = await db.items.get(id); if (!it) return
  const clean = Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined))
  await db.items.update(id, { ...clean, updatedAt: now() })
  await touchLoop(it.loopId)
}
export async function deleteItem(id: string) {
  const it = await db.items.get(id); if (!it) return
  await db.transaction('rw', db.items, db.attachments, db.reminders, async () => {
    await db.attachments.where('parentId').equals(id).delete()
    await db.reminders.where('itemId').equals(id).delete()
    await db.items.delete(id)
  })
  await touchLoop(it.loopId)
}
export async function toggleFocus(id: string) {
  const it = await db.items.get(id); if (!it) return
  await updateItem(id, { isFocus: !it.isFocus })
}
export async function completeWithOutcome(id: string, outcome?: string) {
  const it = await db.items.get(id); if (!it) return
  await db.items.where('id').equals(id).modify(i => {
    i.status = 'completed'; i.completedAt = now(); i.updatedAt = now()
    if (outcome && outcome.trim()) i.outcome = outcome.trim(); else delete i.outcome
  })
  await db.reminders.where('itemId').equals(id).delete()
  await touchLoop(it.loopId)
}
export async function reopenItem(id: string) {
  const it = await db.items.get(id); if (!it) return
  await db.items.where('id').equals(id).modify(i => { i.status = 'pending'; delete i.completedAt; i.updatedAt = now() })
  await touchLoop(it.loopId)
}
export async function completeOccurrence(parentId: string, occStart: number, outcome?: string) {
  const parent = await db.items.get(parentId); if (!parent) return
  const r = parent.recurrence
  if (!r || r.frequency === 'none') { await completeWithOutcome(parentId, outcome); return }
  const dur = parent.endAt && parent.scheduledAt ? parent.endAt - parent.scheduledAt : 0
  await db.items.add({
    ...parent, id: uid(), status: 'completed', outcome: outcome?.trim() || undefined,
    completedAt: occStart, scheduledAt: occStart, endAt: dur ? occStart + dur : undefined,
    recurrence: undefined, attachmentIds: [], createdAt: now(), updatedAt: now(),
  })
  const next = nextOccurrenceAfter(parent, occStart)
  if (next === null || (r.endDate && next > r.endDate)) {
    await db.items.update(parentId, { status: 'completed', completedAt: now(), recurrence: undefined, updatedAt: now() })
  } else {
    await db.items.update(parentId, { scheduledAt: next, endAt: dur ? next + dur : undefined, updatedAt: now() })
  }
  await touchLoop(parent.loopId)
}

/* Appunti */
export const createNote = (data: Partial<Note> = {}) => {
  const t = now()
  return db.notes.add({ id: uid(), content: '', links: [], attachmentIds: [], createdAt: t, updatedAt: t, ...data } as Note)
}
export const updateNote = (id: string, p: Partial<Note>) => db.notes.update(id, { ...p, updatedAt: now() })
export async function deleteNote(id: string) {
  await db.attachments.where('[parentType+parentId]').equals(['note', id]).delete()
  await db.notes.delete(id)
}

/* Allegati */
export async function addAttachment(data: { parentType: 'item' | 'note' | 'budget'; parentId: string; kind: 'audio' | 'image' | 'file'; mimeType: string; blob: Blob; durationSec?: number }) {
  const id = uid()
  await db.attachments.add({ id, createdAt: now(), ...data })
  if (data.parentType === 'item') {
    const it = await db.items.get(data.parentId)
    if (it) await db.items.update(it.id, { attachmentIds: [...it.attachmentIds, id], updatedAt: now() })
  } else if (data.parentType === 'note') {
    const n = await db.notes.get(data.parentId)
    if (n) await db.notes.update(n.id, { attachmentIds: [...n.attachmentIds, id], updatedAt: now() })
  } else {
    const e = await db.budgetEntries.get(data.parentId)
    if (e) await db.budgetEntries.update(e.id, { attachmentIds: [...(e.attachmentIds ?? []), id] })
  }
  return id
}
export async function removeAttachment(id: string) {
  const a = await db.attachments.get(id); if (!a) return
  await db.attachments.delete(id)
  if (a.parentType === 'item') {
    const it = await db.items.get(a.parentId)
    if (it) await db.items.update(it.id, { attachmentIds: it.attachmentIds.filter(x => x !== id), updatedAt: now() })
  } else if (a.parentType === 'note') {
    const n = await db.notes.get(a.parentId)
    if (n) await db.notes.update(n.id, { attachmentIds: n.attachmentIds.filter(x => x !== id), updatedAt: now() })
  } else {
    const e = await db.budgetEntries.get(a.parentId)
    if (e) await db.budgetEntries.update(e.id, { attachmentIds: (e.attachmentIds ?? []).filter(x => x !== id) })
  }
}
export async function moveAttachmentsToItem(ids: string[], itemId: string) {
  for (const id of ids) {
    const a = await db.attachments.get(id); if (!a) continue
    await db.attachments.update(id, { parentType: 'item', parentId: itemId })
  }
}

/* Budget */
export const createBudget = (data: Partial<Budget> & { loopId: string; name: string }) => {
  const t = now()
  return db.budgets.add({ id: uid(), currency: 'EUR', status: 'open', createdAt: t, updatedAt: t, ...data } as Budget)
}
export const updateBudget = (id: string, p: Partial<Budget>) => db.budgets.update(id, { ...p, updatedAt: now() })
export const addBudgetEntry = (data: Partial<BudgetEntry> & { budgetId: string; loopId: string; title: string; amount: number; entryType: BudgetEntry['entryType'] }) =>
  db.budgetEntries.add({ id: uid(), date: now(), attachmentIds: [], ...data } as BudgetEntry)
export const updateBudgetEntry = (id: string, p: Partial<BudgetEntry>) => db.budgetEntries.update(id, p)
export const deleteBudgetEntry = (id: string) => db.budgetEntries.delete(id)
export async function closeBudget(id: string) {
  const b = await db.budgets.get(id); if (!b || b.status === 'closed') return
  const entries = await db.budgetEntries.where('budgetId').equals(id).toArray()
  const actual = entries.filter(e => e.entryType === 'actual').reduce((s, e) => s + e.amount, 0)
  await db.budgets.update(id, { status: 'closed', closedAt: now(), updatedAt: now() })
  await createItem({ loopId: b.loopId, type: 'event', title: `Budget chiuso: ${b.name}`, content: `Totale pagamenti: ${fmtMoney(actual, b.currency)}` })
}

export const wipeDatabase = () => Promise.all([
  db.areas.clear(), db.loops.clear(), db.items.clear(), db.notes.clear(),
  db.budgets.clear(), db.budgetEntries.clear(), db.attachments.clear(),
  db.reminders.clear(),
])