import { useEffect, useState } from 'react'
import { CalendarDays, FileDown, Home, Plus, RefreshCw, Settings2, Sparkles } from 'lucide-react'
import { useNotes } from './hooks/useDb'
import { ToastProvider } from './components/ui'
import { ItemForm } from './components/forms'
import { LoopDetail } from './components/LoopDetail'
import { AgendaPage, HomePage, LoopsPage, SettingsPage } from './components/pages'
import { AskLoopModal } from './components/Ai'
import { ExportLoopModal } from './components/BackupPanel'
import { NoteComposer } from './components/NoteComposer'

type Route = { page: 'home' } | { page: 'loops' } | { page: 'loop'; id: string } | { page: 'agenda' } | { page: 'settings' }

export default function App() {
  const [route, setRoute] = useState<Route>({ page: 'home' })
  const [fab, setFab] = useState(false)
  const [ask, setAsk] = useState(false)
  const [exp, setExp] = useState(false)
  const [shared, setShared] = useState<string | null>(null)
  const notes = useNotes()
  const openLoop = (id: string) => setRoute({ page: 'loop', id })

  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const text = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join('\n')
    if (text) { setShared(text); window.history.replaceState(null, '', window.location.pathname) }
  }, [])

  // Ricevi messaggi dal Service Worker (es. periodic sync per reminder)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'CHECK_REMINDERS') {
        import('./lib/notifications').then(m => { void m.processDueReminders() })
      }
    }
    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [])

  const tabs = [
    { key: 'home', label: 'Home', icon: Home },
    { key: 'loops', label: 'Loop', icon: RefreshCw },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays },
    { key: 'settings', label: 'Altro', icon: Settings2 },
  ] as const
  const current = route.page === 'loop' ? 'loops' : route.page

  const NavButtons = ({ vertical }: { vertical?: boolean }) => (
    <>
      {tabs.map(t => {
        const I = t.icon
        const active = current === t.key
        return (
          <button key={t.key} onClick={() => setRoute({ page: t.key } as Route)}
            className={`relative flex ${vertical ? 'flex-row gap-3 rounded-xl px-3 py-2.5 text-sm' : 'flex-col gap-1 text-[10px]'} items-center font-semibold transition ${active ? (vertical ? 'bg-surface2 text-ink' : 'text-ink') : 'text-muted hover:text-ink'}`}>
            <I size={vertical ? 18 : 20} />
            <span>{t.label}</span>
            {t.key === 'settings' && notes.length > 0 && (
              <span className={`grid h-4 min-w-4 place-items-center rounded-full bg-action px-1 text-[10px] font-bold text-bg ${vertical ? 'ml-auto' : 'absolute right-1/4 top-0'}`}>{notes.length}</span>
            )}
          </button>
        )
      })}
    </>
  )

  return (
    <ToastProvider>
      <div className="split:flex split:h-dvh">
        <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 split:flex">
          <div className="mb-6 flex items-center gap-2 px-2"><RefreshCw size={22} className="text-meet" /><span className="text-xl font-bold">Loop</span></div>
          <nav className="flex flex-col gap-1"><NavButtons vertical /></nav>
          <button onClick={() => setFab(true)} className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-meet py-2.5 text-sm font-semibold text-bg"><Plus size={16} /> Nuovo elemento</button>
          <p className="mt-auto px-2 text-xs text-muted">Local-first · i dati restano qui.</p>
        </aside>

        <main className="flex-1 pb-24 split:h-dvh split:overflow-hidden split:pb-0">
          {route.page === 'home' && <HomePage onOpenLoop={openLoop} />}
          {route.page === 'loops' && <LoopsPage onOpenLoop={openLoop} />}
          {route.page === 'loop' && <LoopDetail id={route.id} onBack={() => setRoute({ page: 'loops' })} />}
          {route.page === 'agenda' && <AgendaPage onOpenLoop={openLoop} />}
          {route.page === 'settings' && <SettingsPage onOpenLoop={openLoop} />}
        </main>

        {route.page === 'loop' && (
          <div className="fixed bottom-24 right-4 z-30 flex flex-col gap-2 split:bottom-6">
            <button onClick={() => setAsk(true)} title="Chiedi al Loop (AI)" className="grid h-12 w-12 place-items-center rounded-full bg-focus text-bg shadow-lg shadow-focus/30"><Sparkles size={20} /></button>
            <button onClick={() => setExp(true)} title="Esporta Markdown/PDF" className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface2 text-ink shadow-lg"><FileDown size={20} /></button>
          </div>
        )}

        <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur split:hidden">
          <div className="grid h-16 grid-cols-5 items-center">
            <NavButtons />
            <div className="col-start-3 row-start-1 flex justify-center">
              <button onClick={() => setFab(true)} className="-mt-6 grid h-14 w-14 place-items-center rounded-full bg-meet text-bg shadow-lg shadow-meet/30"><Plus size={26} /></button>
            </div>
          </div>
        </nav>

        <ItemForm open={fab} onClose={() => setFab(false)} loopId={route.page === 'loop' ? route.id : undefined} />
        {route.page === 'loop' && <AskLoopModal loopId={route.id} open={ask} onClose={() => setAsk(false)} />}
        {route.page === 'loop' && <ExportLoopModal loopId={route.id} open={exp} onClose={() => setExp(false)} />}
        {shared !== null && <NoteComposer open initialContent={shared} onClose={() => setShared(null)} />}
      </div>
    </ToastProvider>
  )
}