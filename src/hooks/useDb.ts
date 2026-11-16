import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'

export const useAreas = () => useLiveQuery(() => db.areas.orderBy('order').toArray(), [], [])
export const useLoops = () => useLiveQuery(() => db.loops.orderBy('lastActivityAt').reverse().toArray(), [], [])
export const useLoop = (id?: string) => useLiveQuery(() => (id ? db.loops.get(id) : undefined), [id])
export const useItems = (loopId?: string) =>
  useLiveQuery(() => (loopId ? db.items.where('loopId').equals(loopId).toArray() : Promise.resolve([])), [loopId], [])
export const useAllItems = () => useLiveQuery(() => db.items.toArray(), [], [])
export const useNotes = () => useLiveQuery(() => db.notes.orderBy('createdAt').reverse().toArray(), [], [])
export const useBudgets = (loopId?: string) =>
  useLiveQuery(() => (loopId ? db.budgets.where('loopId').equals(loopId).toArray() : db.budgets.toArray()), [loopId], [])
export const useBudgetEntries = (budgetId?: string) =>
  useLiveQuery(() => (budgetId ? db.budgetEntries.where('budgetId').equals(budgetId).toArray() : Promise.resolve([])), [budgetId], [])
export const useAttachments = (ids: string[]) =>
  useLiveQuery(() => (ids.length ? db.attachments.where('id').anyOf(ids).toArray() : Promise.resolve([])), [ids.join(',')], [])
export const useReminders = () =>
  useLiveQuery(() => db.reminders.where('notified').equals(0).sortBy('scheduledAt'), [], [])