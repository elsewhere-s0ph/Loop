import { useState } from 'react'
import { Database, HardDrive, Monitor, Moon, Sun, Trash2 } from 'lucide-react'
import { db } from '../db/schema'
import { useNotes } from '../hooks/useDb'
import { deleteNote, ensurePersistentStorage, storageEstimate, wipeDatabase } from '../db/services'
import { seedCatalog } from '../db/seed'
import { prefs, usePrefs } from '../lib/meta'
import { useTheme, type Theme } from '../lib/theme'
import { AiSettings } from './Ai'
import { BackupPanel } from './BackupPanel'
import { NotificationSettings } from './NotificationSettings'
import { TemplateCatalog } from './TemplateCatalog'
import { Btn, Confirm, Field, IconBtn, SectionTitle, TextInput, useToast } from './ui'

export function SettingsPage({ onOpenLoop }: { onOpenLoop?: (id: string) => void }) {
  const { name } = usePrefs()
  const { theme, set } = useTheme()
  const notes = useNotes()
  const toast = useToast()
  const [storage, setStorage] = useState('…')
  const [wipe, setWipe] = useState(false)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    const p = await ensurePersistentStorage()
    const e = await storageEstimate()
    setStorage(`${p !== 'denied' ? 'Memoria persistente attiva' : 'Storage non persistente'} · ${e ? Math.round(e.usage / 1024) + ' KB usati' : ''}`)
  }
  useState(() => { void refresh() })

  const themes: { v: Theme; label: string; icon: typeof Moon }[] = [
    { v: 'dark', label: 'Scuro', icon: Moon },
    { v: 'light', label: 'Chiaro', icon: Sun },
    { v: 'system', label: 'Sistema', icon: Monitor },
  ]

  return (
    <div className="loop-scroll p-5 split:h-full split:overflow-y-auto">
      <h1 className="text-2xl font-bold">Altro</h1>

      <div className="mt-5 rounded-2xl bg-surface p-4">
        <SectionTitle>Aspetto</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {themes.map(t => {
            const I = t.icon
            return (
              <button key={t.v} onClick={() => set(t.v)}
                className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${theme === t.v ? 'border-meet bg-meet/15 text-meet' : 'border-line bg-surface2 text-muted hover:text-ink'}`}>
                <I size={18} />{t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Notifiche e promemoria</SectionTitle>
        <NotificationSettings />
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Profilo</SectionTitle>
        <Field label="Il tuo nome (per il saluto in Home)">
          <TextInput defaultValue={name} onChange={e => { prefs.name = e.target.value }} placeholder="Es. Marco" />
        </Field>
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Catalogo esempi — strutture pronte da clonare</SectionTitle>
        <TemplateCatalog onCloned={onOpenLoop} />
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Memoria & dati</SectionTitle>
        <p className="flex items-center gap-2 text-sm text-muted"><HardDrive size={15} /> {storage}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn variant="soft" onClick={refresh}>Verifica protezione</Btn>
          <Btn variant="soft" disabled={busy} onClick={async () => {
            setBusy(true); await seedCatalog(); setBusy(false)
            toast('Catalogo esempi caricato'); void refresh()
          }}>
            <span className="flex items-center gap-1"><Database size={15} /> Carica dati demo</span>
          </Btn>
          <Btn variant="danger" onClick={() => setWipe(true)}>Svuota database</Btn>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Backup cifrato & Cloud Sync</SectionTitle>
        <BackupPanel />
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>AI contestuale (BYOK)</SectionTitle>
        <AiSettings />
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4">
        <SectionTitle>Inbox appunti ({notes.length})</SectionTitle>
        {notes.length === 0 && <p className="text-sm text-muted">Nessun appunto da smistare.</p>}
        {notes.map(n => (
          <div key={n.id} className="flex items-center gap-2 border-b border-line py-2 last:border-0">
            <span className="flex-1 truncate text-sm">{n.content.replace(/<[^>]*>/g, '')}</span>
            <IconBtn onClick={async () => {
              await deleteNote(n.id)
              toast('Appunto eliminato', { label: 'Annulla', fn: () => { void db.notes.add(n) } })
            }} className="hover:!text-danger"><Trash2 size={14} /></IconBtn>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-2xl bg-surface p-4 text-sm text-muted">
        <SectionTitle>Info</SectionTitle>
        <p><span className="font-semibold text-ink">Loop</span> · PWA local-first di gestione del contesto. Dati cifrati AES-GCM nei backup, sync zero-knowledge, AI diretta dal browser.</p>
      </div>

      <Confirm open={wipe} onClose={() => setWipe(false)} title="Svuotare tutto?"
        message="Tutti i Loop, elementi, appunti, budget e promemoria verranno eliminati definitivamente."
        onConfirm={async () => { await wipeDatabase(); toast('Database svuotato'); void refresh() }} />
    </div>
  )
}