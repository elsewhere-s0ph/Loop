import { useEffect, useState } from 'react'
import { Bell, BellOff, Check, X } from 'lucide-react'
import { countPendingReminders, getNotificationStatus, requestPermission } from '../lib/notifications'
import { useReminders } from '../hooks/useDb'
import { Badge, Btn, SectionTitle, useToast } from './ui'

export function NotificationSettings() {
  const toast = useToast()
  const reminders = useReminders()
  const [status, setStatus] = useState<'unsupported' | NotificationPermission>('default')
  const [count, setCount] = useState(0)

  useEffect(() => {
    void getNotificationStatus().then(setStatus)
    void countPendingReminders().then(setCount)
  }, [])

  useEffect(() => {
    void countPendingReminders().then(setCount)
  }, [reminders])

  const enable = async () => {
    const r = await requestPermission()
    setStatus(r)
    if (r === 'granted') toast('Notifiche abilitate: riceverai promemoria 15 minuti prima delle scadenze')
    else if (r === 'denied') toast('Permessi negati. Abilita dalle impostazioni del browser.')
  }

  const supportedPeriodic = 'PeriodicSyncManager' in window

  return (
    <div className="space-y-4">
      {status === 'unsupported' && (
        <div className="rounded-xl border border-danger bg-danger/10 p-3 text-sm text-danger">
          <BellOff size={16} className="inline" /> Il tuo browser non supporta le notifiche.
        </div>
      )}

      {status === 'denied' && (
        <div className="rounded-xl border border-danger bg-danger/10 p-3 text-sm space-y-1">
          <p className="text-danger flex items-center gap-2"><BellOff size={16} /> Notifiche bloccate</p>
          <p className="text-xs text-muted">
            Chrome Android: Impostazioni → Siti → questo sito → Notifiche → Consenti.
            <br />Chrome desktop: clicca l'icona lucchetto nella barra degli indirizzi.
          </p>
        </div>
      )}

      {status === 'default' && (
        <div className="space-y-2">
          <p className="text-sm text-muted">I promemoria suonano 15 minuti prima di ogni scadenza o incontro. Funzionano anche ad app chiusa su Chrome/Edge.</p>
          <Btn onClick={enable}><span className="flex items-center gap-2"><Bell size={16} /> Abilita notifiche</span></Btn>
        </div>
      )}

      {status === 'granted' && (
        <div className="space-y-3">
          <div className="rounded-xl border border-outcome bg-outcome/10 p-3 text-sm">
            <p className="text-outcome flex items-center gap-2"><Check size={16} /> Notifiche attive</p>
            <p className="mt-1 text-xs text-muted">
              {count} promemoria programmati · {supportedPeriodic ? 'Periodic Sync attivo (anche ad app chiusa)' : 'Solo a browser aperto'}
            </p>
          </div>

          {reminders.length > 0 && (
            <div>
              <SectionTitle>Prossimi promemoria ({reminders.length})</SectionTitle>
              <div className="space-y-1">
                {reminders.slice(0, 5).map(r => {
                  const diffMin = Math.round((r.scheduledAt - Date.now()) / 60000)
                  return (
                    <div key={r.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-3 py-2 text-xs">
                      <Bell size={12} className="text-meet shrink-0" />
                      <span className="flex-1 truncate">{r.title}</span>
                      <Badge color={diffMin < 60 ? 'var(--color-action)' : 'var(--color-meet)'}>
                        {diffMin < 60 ? `tra ${diffMin} min` : `tra ${Math.round(diffMin / 60)} h`}
                      </Badge>
                    </div>
                  )
                })}
                {reminders.length > 5 && <p className="text-xs text-muted text-center mt-1">+{reminders.length - 5} altri</p>}
              </div>
            </div>
          )}

          <div className="text-xs text-muted space-y-1">
            <p className="flex items-center gap-1"><X size={10} /> Le notifiche richiedono Chrome/Edge: su Firefox e Safari iOS non funzionano ad app chiusa.</p>
            <p className="flex items-center gap-1"><Check size={10} /> Su Android WebAPK: assicurati che l'app abbia i permessi notifiche attivi nelle impostazioni di sistema.</p>
          </div>
        </div>
      )}
    </div>
  )
}