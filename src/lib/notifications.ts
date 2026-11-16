import { db } from '../db/schema'
import { uid, now } from '../db/services'

const LEAD_TIME_MS = 15 * 60 * 1000 // 15 minuti prima dell'evento

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export async function getNotificationStatus(): Promise<'unsupported' | NotificationPermission> {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

export async function scheduleReminder(
  itemId: string,
  loopId: string,
  title: string,
  body: string,
  scheduledAt: number,
): Promise<void> {
  // Rimuovi reminder precedenti per questo item
  const existing = await db.reminders.where('itemId').equals(itemId).toArray()
  for (const r of existing) await db.reminders.delete(r.id)

  const notifyAt = scheduledAt - LEAD_TIME_MS
  if (notifyAt <= Date.now()) return // già passato, non programmare

  await db.reminders.add({
    id: uid(),
    itemId,
    loopId,
    title,
    body: body || `Promemoria: ${title}`,
    scheduledAt: notifyAt,
    createdAt: now(),
    notified: false,
  })
  registerPendingReminders()
}

export async function cancelReminder(itemId: string): Promise<void> {
  const list = await db.reminders.where('itemId').equals(itemId).toArray()
  for (const r of list) await db.reminders.delete(r.id)
}

export async function countPendingReminders(): Promise<number> {
  return db.reminders.where('notified').equals(0).count()
}

export async function processDueReminders(): Promise<void> {
  const due = await db.reminders.where('scheduledAt').belowOrEqual(Date.now()).and(r => !r.notified).toArray()
  for (const r of due) {
    await showLocalNotification(r.title, r.body, r.loopId, r.itemId)
    await db.reminders.update(r.id, { notified: true })
  }
}

async function showLocalNotification(title: string, body: string, loopId: string, itemId: string): Promise<void> {
  if (Notification.permission !== 'granted') return
  const data = { loopId, itemId, url: `${window.location.origin}/?focus=${loopId}` }

  // Prova tramite service worker (funziona anche con app in background)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, {
        body,
        icon: '/pwa-192.png',
        badge: '/pwa-192.png',
        tag: `loop-${loopId}`,
        data,
        requireInteraction: false,
      })
      return
    } catch (e) {
      console.warn('SW showNotification failed, fallback:', e)
    }
  }

  // Fallback: Notification API diretta
  try {
    const n = new Notification(title, { body, icon: '/pwa-192.png', tag: `loop-${loopId}` })
    n.onclick = () => {
      window.focus()
      window.location.href = data.url
      n.close()
    }
    setTimeout(() => n.close(), 8000)
  } catch (e) {
    console.warn('Notification API failed:', e)
  }
}

let checkInterval: number | null = null
export function registerPendingReminders(): void {
  if (checkInterval !== null) {
    window.clearInterval(checkInterval)
    checkInterval = null
  }
  // Controlla subito + ogni 30s
  void processDueReminders()
  checkInterval = window.setInterval(() => { void processDueReminders() }, 30_000)

  // Registra periodic background sync se supportato (Chrome/Edge)
  registerPeriodicSync()
}

async function registerPeriodicSync(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PeriodicSyncManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const tags = await reg.periodicSync.getTags()
    if (!tags.includes('loop-reminders')) {
      await reg.periodicSync.register('loop-reminders', { minInterval: 15 * 60 * 1000 }) // 15 min
    }
  } catch (e) {
    // Non supportato o permesso negato: non è un problema
    console.info('Periodic Sync non disponibile:', (e as Error).message)
  }
}