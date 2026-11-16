import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { CloudUpload, Download, FileDown, FileText, Upload } from 'lucide-react'
import { db } from '../db/schema'
import { useAreas, useBudgets, useItems, useLoop } from '../hooks/useDb'
import { applyRemote, checkpointInfo, downloadBlob, exportBackup, readBackupMeta, restoreBackup } from '../lib/backup'
import { exportLoopPdf, downloadText, loopToMarkdown } from '../lib/export'
import { lastSync, webdavDownload, webdavPrefs, webdavUpload } from '../lib/sync'
import { fmtDateTime } from '../lib/meta'
import { Btn, Field, Modal, TextInput, useToast } from './ui'

function Bar({ p, label }: { p: number; label: string }) {
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-meet transition-all" style={{ width: `${Math.round(p * 100)}%` }} /></div>
      <p className="mt-1 text-xs text-muted">{label} · {Math.round(p * 100)}%</p>
    </div>
  )
}

export function BackupPanel() {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [ck, setCk] = useState<{ line: number } | null>(null)
  const [replace, setReplace] = useState(false)
  const [resume, setResume] = useState(true)
  const [prog, setProg] = useState<{ p: number; label: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const wd = webdavPrefs.get()
  const [url, setUrl] = useState(wd?.url ?? '')
  const [user, setUser] = useState(wd?.user ?? '')
  const [pass, setPass] = useState(wd?.pass ?? '')
  const [conflict, setConflict] = useState<{ meta: { createdAt: number; counts: Record<string, number> }; remote: Blob; local: Blob } | null>(null)
  const [sync, setSync] = useState(lastSync.get())

  const doExport = async () => {
    if (pw.length < 6) return toast('Password di almeno 6 caratteri')
    setBusy(true)
    try {
      const blob = await exportBackup(pw, (p, label) => setProg({ p, label }))
      downloadBlob(`loop-${new Date().toISOString().slice(0, 10)}.loop`, blob)
      toast('Backup cifrato esportato')
    } catch (e) { toast(`Errore: ${(e as Error).message}`) }
    setProg(null); setBusy(false)
  }
  const doRestore = async () => {
    if (!file) return toast('Scegli un file .loop')
    if (!pw2) return toast('Inserisci la password del backup')
    setBusy(true)
    try {
      await restoreBackup(file, pw2, { replace, resume: resume && !!ck, onProgress: (p, label) => setProg({ p, label }) })
      toast('Ripristino completato'); setFile(null); setCk(null)
    } catch (e) { toast(`Errore: ${(e as Error).message} — il checkpoint è conservato, puoi riprendere`) }
    setProg(null); setBusy(false)
  }
  const doSync = async () => {
    if (!url || !user || !pass) return toast('Compila URL, utente e password WebDAV')
    if (pw.length < 6) return toast('Usa la password di cifratura (min 6 caratteri)')
    const cfg = { url, user, pass }
    webdavPrefs.set(cfg)
    setBusy(true)
    try {
      setProg({ p: 0, label: 'Cifratura locale…' })
      const local = await exportBackup(pw, (p, label) => setProg({ p: p * 0.5, label }))
      const remote = await webdavDownload(cfg)
      if (!remote) {
        await webdavUpload(cfg, local); lastSync.set(); setSync(lastSync.get()); toast('Primo upload completato')
      } else {
        const meta = await readBackupMeta(remote, pw)
        setConflict({ meta, remote, local })
      }
    } catch (e) { toast(`Sync: ${(e as Error).message}`) }
    setProg(null); setBusy(false)
  }
  const resolve = async (mode: 'merge' | 'remote' | 'local') => {
    if (!conflict) return
    const cfg = { url, user, pass }
    setBusy(true); setConflict(null)
    try {
      if (mode === 'merge') {
        await applyRemote(conflict.remote, pw, 'merge', (p, label) => setProg({ p: p * 0.5, label }))
        const fresh = await exportBackup(pw, (p, label) => setProg({ p: 0.5 + p * 0.4, label }))
        await webdavUpload(cfg, fresh)
      } else if (mode === 'remote') {
        await applyRemote(conflict.remote, pw, 'remote', (p, label) => setProg({ p, label }))
      } else {
        await webdavUpload(cfg, conflict.local)
      }
      lastSync.set(); setSync(lastSync.get()); toast('Sincronizzazione completata')
    } catch (e) { toast(`Sync: ${(e as Error).message}`) }
    setProg(null); setBusy(false)
  }

  return (
    <div className="space-y-4">
      <Field label="Password di cifratura (AES-GCM 256)"><TextInput type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 6 caratteri — non recuperabile!" /></Field>
      <div className="flex flex-wrap gap-2">
        <Btn variant="soft" disabled={busy} onClick={doExport}><span className="flex items-center gap-1"><Download size={14} /> Esporta .loop</span></Btn>
        <Btn variant="soft" disabled={busy} onClick={() => fileRef.current?.click()}><span className="flex items-center gap-1"><Upload size={14} /> Importa .loop</span></Btn>
        <input ref={fileRef} type="file" accept=".loop,application/octet-stream" className="hidden"
          onChange={e => { const f = e.target.files?.[0] ?? null; setFile(f); setCk(f ? checkpointInfo(f) : null); e.target.value = '' }} />
      </div>
      {file && (
        <div className="space-y-2 rounded-xl border border-line bg-surface2 p-3">
          <p className="text-sm font-semibold">{file.name} · {Math.round(file.size / 1024)} KB</p>
          {ck && (
            <label className="flex items-center gap-2 text-sm text-meet">
              <input type="checkbox" checked={resume} onChange={e => setResume(e.target.checked)} /> Riprendi dal blocco {ck.line} (checkpoint trovato)
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} /> Sostituisci tutto (cancella i dati locali prima del ripristino)
          </label>
          <Field label="Password del backup"><TextInput type="password" value={pw2} onChange={e => setPw2(e.target.value)} /></Field>
          <Btn disabled={busy} onClick={doRestore}>Avvia ripristino</Btn>
        </div>
      )}
      {prog && <Bar p={prog.p} label={prog.label} />}

      <div className="rounded-xl border border-line bg-surface2 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Cloud Sync WebDAV (zero-knowledge)</p>
        <div className="space-y-2">
          <TextInput value={url} onChange={e => setUrl(e.target.value)} placeholder="https://cloud.esempio.it/remote.php/dav/files/utente/Loop" />
          <div className="grid grid-cols-2 gap-2">
            <TextInput value={user} onChange={e => setUser(e.target.value)} placeholder="Utente" />
            <TextInput type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="App password" />
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="soft" disabled={busy} onClick={doSync}><span className="flex items-center gap-1"><CloudUpload size={14} /> Sincronizza ora</span></Btn>
            <span className="text-xs text-muted">{sync ? `Ultima sync: ${fmtDateTime(sync)}` : 'Mai sincronizzato'}</span>
          </div>
          <p className="text-xs text-muted">Il cloud riceve solo il file cifrato: il provider non può leggere nulla. Compatibile Nextcloud, ownCloud, NAS WebDAV.</p>
        </div>
      </div>

      <Modal open={!!conflict} onClose={() => setConflict(null)} title="Conflitto: quale versione tenere?">
        {conflict && (
          <div className="space-y-3">
            <p className="text-sm text-muted">Cloud: backup del <b className="text-ink">{fmtDateTime(conflict.meta.createdAt)}</b> ({Object.values(conflict.meta.counts).reduce((a, b) => a + b, 0)} elementi). Il locale contiene le tue ultime modifiche.</p>
            <Btn className="w-full" onClick={() => resolve('merge')}>Unisci per UUID (vince la versione più recente)</Btn>
            <Btn variant="soft" className="w-full" onClick={() => resolve('remote')}>Usa il cloud (sovrascrivi il locale)</Btn>
            <Btn variant="soft" className="w-full" onClick={() => resolve('local')}>Usa il locale (sovrascrivi il cloud)</Btn>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function ExportLoopModal({ loopId, open, onClose }: { loopId: string; open: boolean; onClose: () => void }) {
  const loop = useLoop(loopId)
  const items = useItems(loopId)
  const areas = useAreas()
  const budgets = useBudgets(loopId)
  const entries = useLiveQuery(() => db.budgetEntries.where('loopId').equals(loopId).toArray(), [loopId], [])
  const toast = useToast()
  if (!loop) return null
  const bundle = { loop, area: areas.find(a => a.id === loop.areaId), items, budgets, entries }
  const md = () => { downloadText(`${loop.title}.md`, loopToMarkdown(bundle)); toast('Markdown esportato'); onClose() }
  const pdf = () => { try { exportLoopPdf(bundle); onClose() } catch (e) { toast((e as Error).message) } }
  return (
    <Modal open={open} onClose={onClose} title={`Esporta «${loop.title}»`}>
      <div className="space-y-2">
        <Btn variant="soft" className="w-full" onClick={md}><span className="flex items-center justify-center gap-2"><FileText size={15} /> Dossier Markdown (.md)</span></Btn>
        <Btn variant="soft" className="w-full" onClick={pdf}><span className="flex items-center justify-center gap-2"><FileDown size={15} /> Report PDF stampabile</span></Btn>
        <p className="text-xs text-muted">Include Timeline, Punti Chiave, azioni aperte e tabella Budget.</p>
      </div>
    </Modal>
  )
}