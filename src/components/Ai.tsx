import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { DEFAULT_MODELS, aiPrefs, askLoop, testAi, type AiCfg } from '../lib/ai'
import { Btn, Field, Modal, Select, TextInput, useToast } from './ui'

export function useAiCfg(): AiCfg | null {
  const [cfg, setCfg] = useState<AiCfg | null>(aiPrefs.get())
  useEffect(() => { const h = () => setCfg(aiPrefs.get()); window.addEventListener('loop-ai', h); return () => window.removeEventListener('loop-ai', h) }, [])
  return cfg
}

export function AiSettings() {
  const toast = useToast()
  const current = aiPrefs.get()
  const [provider, setProvider] = useState<AiCfg['provider']>(current?.provider ?? 'gemini')
  const [key, setKey] = useState(current?.key ?? '')
  const [model, setModel] = useState(current?.model ?? DEFAULT_MODELS.gemini)
  const [busy, setBusy] = useState(false)
  const save = () => {
    if (!key.trim()) { aiPrefs.clear(); toast('Chiave AI rimossa'); return }
    aiPrefs.set({ provider, key: key.trim(), model: model.trim() || DEFAULT_MODELS[provider] })
    toast('Configurazione AI salvata (solo su questo dispositivo)')
  }
  const test = async () => {
    if (!key.trim()) return toast('Inserisci una chiave')
    setBusy(true)
    try { const r = await testAi({ provider, key: key.trim(), model: model.trim() || DEFAULT_MODELS[provider] }); toast(`AI funzionante: ${r.slice(0, 40)}`) }
    catch (e) { toast(`Errore AI: ${(e as Error).message.slice(0, 80)}`) }
    setBusy(false)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Provider">
          <Select value={provider} onChange={e => { const p = e.target.value as AiCfg['provider']; setProvider(p); setModel(DEFAULT_MODELS[p]) }}>
            <option value="gemini">Google Gemini</option><option value="openai">OpenAI</option><option value="groq">Groq</option>
          </Select>
        </Field>
        <Field label="Modello"><TextInput value={model} onChange={e => setModel(e.target.value)} /></Field>
      </div>
      <Field label="API Key (BYOK — resta sul dispositivo)">
        <TextInput type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="Incolla la tua chiave…" />
      </Field>
      <div className="flex gap-2">
        <Btn variant="soft" onClick={save}>Salva</Btn>
        <Btn variant="soft" disabled={busy} onClick={test}>{busy ? 'Test…' : 'Test connessione'}</Btn>
      </div>
      <p className="text-xs text-muted">Le chiamate partono direttamente dal tuo browser verso il provider: nessun server intermedio.</p>
    </div>
  )
}

export function AskLoopModal({ loopId, open, onClose }: { loopId: string; open: boolean; onClose: () => void }) {
  const cfg = useAiCfg()
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { if (open) { setQ(''); setAnswer(''); setError('') } }, [open])
  const ask = async () => {
    if (!q.trim() || !cfg) return
    setBusy(true); setError(''); setAnswer('')
    try { setAnswer(await askLoop(cfg, loopId, q.trim())) }
    catch (e) { setError((e as Error).message) }
    setBusy(false)
  }
  return (
    <Modal open={open} onClose={onClose} title="Chiedi al Loop" wide>
      {!cfg ? (
        <p className="text-sm text-muted">Configura la tua chiave AI in <b>Altro → AI</b> per usare l'assistente contestuale.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <TextInput value={q} onChange={e => setQ(e.target.value)} placeholder='Es. "Quanto avevamo concordato per il trasporto?"'
              onKeyDown={e => { if (e.key === 'Enter') void ask() }} autoFocus />
            <Btn onClick={ask} disabled={busy}><span className="flex items-center gap-1"><Sparkles size={15} />{busy ? '…' : 'Chiedi'}</span></Btn>
          </div>
          {busy && <p className="text-sm text-muted">Sto leggendo la Timeline del Loop…</p>}
          {error && <p className="text-sm text-danger">{error}</p>}
          {answer && <div className="whitespace-pre-wrap rounded-2xl border border-line bg-surface2 p-4 text-sm leading-relaxed">{answer}</div>}
          <p className="text-xs text-muted">L'AI legge solo i dati di questo Loop e può sbagliare: verifica sempre cifre e date.</p>
        </div>
      )}
    </Modal>
  )
}