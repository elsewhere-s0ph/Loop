import { db } from '../db/schema'
import { htmlToText } from './media'
import { TYPE_META, effDate, fmtDateTime, fmtMoney } from './meta'

export type AiCfg = { provider: 'gemini' | 'openai' | 'groq'; key: string; model: string }
export const DEFAULT_MODELS: Record<AiCfg['provider'], string> = { gemini: 'gemini-2.0-flash', openai: 'gpt-4o-mini', groq: 'llama-3.3-70b-versatile' }
export const aiPrefs = {
  get(): AiCfg | null { try { const c = JSON.parse(localStorage.getItem('loop.ai') ?? 'null'); return c?.key ? c : null } catch { return null } },
  set(c: AiCfg) { localStorage.setItem('loop.ai', JSON.stringify(c)); window.dispatchEvent(new Event('loop-ai')) },
  clear() { localStorage.removeItem('loop.ai'); window.dispatchEvent(new Event('loop-ai')) },
}

async function callAi(cfg: AiCfg, system: string, user: string, audio?: { mime: string; b64: string }): Promise<string> {
  if (cfg.provider === 'gemini') {
    const parts: object[] = [{ text: user }]
    if (audio) parts.push({ inline_data: { mime_type: audio.mime, data: audio.b64 } })
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${cfg.key}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts }] }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error?.message ?? `Gemini HTTP ${r.status}`)
    return j?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  }
  const base = cfg.provider === 'openai' ? 'https://api.openai.com/v1' : 'https://api.groq.com/openai/v1'
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: system }, { role: 'user', content: user + (audio ? '\n[Nota: audio non supportato da questo provider; usa il testo.]' : '') }] }),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j?.error?.message ?? `HTTP ${r.status}`)
  return j?.choices?.[0]?.message?.content ?? ''
}
const parseJson = <T,>(s: string, fallback: T): T => {
  try { return JSON.parse(s.replace(/```json|```/g, '').trim()) as T } catch { return fallback }
}

export async function testAi(cfg: AiCfg): Promise<string> { return callAi(cfg, 'Rispondi solo con la parola OK.', 'ping') }

export async function askLoop(cfg: AiCfg, loopId: string, question: string): Promise<string> {
  const loop = await db.loops.get(loopId)
  if (!loop) throw new Error('Loop non trovato')
  const items = (await db.items.where('loopId').equals(loopId).toArray()).sort((a, b) => effDate(a) - effDate(b))
  const budgets = await db.budgets.where('loopId').equals(loopId).toArray()
  const entries = await db.budgetEntries.where('loopId').equals(loopId).toArray()
  const lines = items.map(i => `[${fmtDateTime(effDate(i))}] ${TYPE_META[i.type].label}${i.isFocus ? ' (PUNTO CHIAVE)' : ''}: ${i.title}${i.content ? ' — ' + htmlToText(i.content) : ''}${i.outcome ? ' — ESITO: ' + i.outcome : ''}${i.status === 'pending' ? ' (ancora da fare)' : ''}`)
  const budgetLines = budgets.map(b => {
    const be = entries.filter(e => e.budgetId === b.id)
    return `Budget "${b.name}": stime ${fmtMoney(be.filter(e => e.entryType === 'estimate').reduce((s, e) => s + e.amount, 0), b.currency)}, pagamenti ${fmtMoney(be.filter(e => e.entryType === 'actual').reduce((s, e) => s + e.amount, 0), b.currency)}. Voci: ${be.map(e => `${e.title} ${fmtMoney(e.amount, b.currency)} (${e.entryType === 'actual' ? 'pagato' : 'stimato'})`).join('; ')}`
  })
  const context = [`Loop: ${loop.title}`, loop.goal ? `Obiettivo: ${loop.goal}` : '', ...lines, ...budgetLines].filter(Boolean).join('\n').slice(0, 28000)
  return callAi(cfg,
    'Sei l\'assistente di un Loop (contesto di progetto). Rispondi in italiano basandoti ESCLUSIVAMENTE sui dati forniti. Cita date e cifre esatte quando presenti. Se l\'informazione non c\'è, dillo chiaramente.',
    `DATI DEL LOOP:\n${context}\n\nDOMANDA: ${question}`)
}

export async function routeNote(cfg: AiCfg, noteText: string, loops: { id: string; title: string; goal: string }[]): Promise<{ loopId: string | null; reason: string }> {
  const list = loops.map(l => `- id:${l.id} | ${l.title} | ${l.goal}`).join('\n')
  const out = await callAi(cfg,
    'Smista una nota rapida nel Loop più pertinente. Rispondi SOLO con JSON: {"loopId":"<id o null>","reason":"<max 12 parole in italiano>"}',
    `LOOP ATTIVI:\n${list}\n\nNOTA: ${noteText}`)
  const j = parseJson<{ loopId: string | null; reason: string }>(out, { loopId: null, reason: 'Risposta AI non valida' })
  return { loopId: loops.some(l => l.id === j.loopId) ? j.loopId : null, reason: j.reason ?? '' }
}

export async function analyzeNote(cfg: AiCfg, text: string, audio?: { mime: string; b64: string }): Promise<{ summary: string; actions: string[]; amounts: string[] }> {
  const out = await callAi(cfg,
    'Analizza la nota (testo e/o audio). Rispondi SOLO con JSON in italiano: {"summary":"<riassunto 1-2 frasi>","actions":["<azione concreta>"],"amounts":["<cifra e contesto>"]}',
    text || 'Trascrivi e analizza l\'audio allegato.', audio)
  return parseJson(out, { summary: '', actions: [], amounts: [] })
}