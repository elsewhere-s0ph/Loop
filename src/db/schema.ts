import Dexie, { type Table } from 'dexie'

export type LoopStatus = 'active' | 'paused' | 'completed'
export type ItemType = 'fact' | 'action' | 'meet' | 'event'
export type ItemStatus = 'pending' | 'completed' | 'recorded'
export type Priority = 'now' | 'later'

export interface Area {
  id: string; name: string; icon: string; color: string
  isFavorite: boolean; order: number; createdAt: number; updatedAt: number
}
export interface Loop {
  id: string; areaId: string | null; title: string; goal: string
  status: LoopStatus; isFavorite: boolean
  lastActivityAt: number; createdAt: number; updatedAt: number
}
export interface ChecklistEntry { id: string; text: string; done: boolean }
export interface Recurrence {
  frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval: number; daysOfWeek?: number[]; endDate?: number
}
export interface LoopItem {
  id: string; loopId: string; type: ItemType; title: string
  content: string
  status: ItemStatus
  priority?: Priority; outcome?: string; completedAt?: number
  isFocus: boolean
  checklist?: ChecklistEntry[]
  scheduledAt?: number; endAt?: number; locationOrLink?: string
  linkedActionId?: string; recurrence?: Recurrence
  attachmentIds: string[]; createdAt: number; updatedAt: number
}
export interface Note {
  id: string; content: string; links: string[]; attachmentIds: string[]
  createdAt: number; updatedAt: number
}
export interface Budget {
  id: string; loopId: string; name: string; currency: string
  ceiling?: number; status: 'open' | 'closed'; closedAt?: number
  createdAt: number; updatedAt: number
}
export interface BudgetEntry {
  id: string; budgetId: string; loopId: string; title: string; amount: number
  entryType: 'estimate' | 'actual'; linkedActionId?: string
  date: number; notes?: string; attachmentIds?: string[]
}
export interface Attachment {
  id: string; parentType: 'item' | 'note' | 'budget'; parentId: string
  kind: 'audio' | 'image' | 'file'; mimeType: string; blob: Blob
  durationSec?: number; createdAt: number
}
export interface Reminder {
  id: string; itemId: string; loopId: string; title: string; body: string
  scheduledAt: number; createdAt: number; notified: boolean
}

export class LoopDatabase extends Dexie {
  areas!: Table<Area, string>
  loops!: Table<Loop, string>
  items!: Table<LoopItem, string>
  notes!: Table<Note, string>
  budgets!: Table<Budget, string>
  budgetEntries!: Table<BudgetEntry, string>
  attachments!: Table<Attachment, string>
  reminders!: Table<Reminder, string>

  constructor() {
    super('LoopDatabase')
    this.version(2).stores({
      areas: 'id, order, name, updatedAt',
      loops: 'id, areaId, status, lastActivityAt, isFavorite, updatedAt, [areaId+status]',
      items: 'id, loopId, type, status, scheduledAt, isFocus, createdAt, updatedAt, [loopId+type], [loopId+status], [loopId+scheduledAt]',
      notes: 'id, createdAt',
      budgets: 'id, loopId, status',
      budgetEntries: 'id, budgetId, loopId, entryType, date',
      attachments: 'id, parentId, kind, [parentType+parentId]',
      reminders: 'id, itemId, loopId, scheduledAt, notified',
    })
  }
}
export const db = new LoopDatabase()