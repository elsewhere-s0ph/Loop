import type { Table } from 'dexie'
import { db } from '../db/schema'
import { wipeDatabase } from '../db/services'
import { b64, decryptChunk, deriveKey, encryptChunk } from './crypto'

const enc = new TextEncoder()
const dec = new TextDecoder()
const TABLES = ['areas', 'loops', 'items', 'notes', 'budgets', 'budgetEntries'] as const
type TableName = typeof TABLES[number]
type Rec = { id: string; updatedAt?: number }
const CK = 'loop_restore_checkpoint'
export type Progress = (p: number, label: string) => void

async function* readLines(file: Blob): AsyncGenerator<string> {
  const reader = file.stream().getReader()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) yield line }
  }
  buf += dec.decode()
  if (buf.trim()) yield buf
}

export function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export async function exportBackup(password: string, onProgress: Progress): Promise<Blob> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await deriveKey(password, salt)
  const parts: string[] = [JSON.stringify({ fmt: 'LOOP1', salt: b64.fromBytes(salt), createdAt: Date.now() }), '\n']
  const counts: Record<string, number> = {}
  let total = 2
  for (const t of TABLES) { counts[t] = await db[t].count(); total += counts[t] }
  const attIds = await db.attachments.toCollection().primaryKeys() as string[]
  counts.attachments = attIds.length; total += attIds.length
  let done = 0
  const push = async (obj: unknown) => {
    parts.push(b64.fromBytes(await encryptChunk(key, enc.encode(JSON.stringify(obj)))), '\n')
    done++; onProgress(done / total, `Esportazione ${done}/${total}`)
  }
  await push({ t: 'meta', version: 1, createdAt: Date.now(), counts })
  for (const t of TABLES) { const rows = await db[t].toArray(); for (const r of rows) await push({ t: 'rec', table: t, data: r }) }
  for (let i = 0; i < attIds.length; i += 5) {
    const batch = await db.attachments.bulkGet(attIds.slice(i, i + 5))
    for (const a of batch) {
      if (!a) continue
      const bytes = new Uint8Array(await a.blob.arrayBuffer())
      const { blob: _blob, ...meta } = a
      await push({ t: 'att', data: meta, b64: b64.fromBytes(bytes) })
    }
    await new Promise(r => setTimeout(r, 0))
  }
  await push({ t: 'end' })
  return new Blob(parts, { type: 'application/octet-stream' })
}

export async function readBackupMeta(file: Blob, password: string): Promise<{ createdAt: number; counts: Record<string, number> }> {
  const it = readLines(file)
  const header = JSON.parse((await it.next()).value as string)
  if (header.fmt !== 'LOOP1') throw new Error('Formato backup non valido')
  const key = await deriveKey(password, b64.toBytes(header.salt))
  const meta = JSON.parse(dec.decode(await decryptChunk(key, b64.toBytes((await it.next()).value as string))))
  if (meta.t !== 'meta') throw new Error('Backup corrotto o password errata')
  return { createdAt: meta.createdAt, counts: meta.counts ?? {} }
}

export function checkpointInfo(file: File): { line: number } | null {
  try {
    const c = JSON.parse(localStorage.getItem(CK) ?? 'null')
    if (c && c.name === file.name && c.size === file.size && c.lastModified === file.lastModified) return { line: c.line }
  } catch { /* ignore */ }
  return null
}

export async function restoreBackup(file: File, password: string, opts: { replace: boolean; resume: boolean; onProgress: Progress }) {
  const ck = opts.resume ? checkpointInfo(file) : null
  let key: CryptoKey | null = null
  let idx = 0, bytes = 0
  for await (const line of readLines(file)) {
    const myIdx = idx++
    bytes += line.length + 1
    if (myIdx === 0) {
      const h = JSON.parse(line)
      if (h.fmt !== 'LOOP1') throw new Error('Formato backup non valido')
      key = await deriveKey(password, b64.toBytes(h.salt))
      continue
    }
    if (ck && myIdx < ck.line) continue
    let obj: { t: string; table?: TableName; data?: Rec & Record<string, unknown>; b64?: string }
    try { obj = JSON.parse(dec.decode(await decryptChunk(key!, b64.toBytes(line)))) }
    catch { throw new Error('Password errata o file corrotto') }
    if (obj.t === 'meta') { if (!ck && opts.replace) await wipeDatabase() }
    else if (obj.t === 'rec' && obj.table && obj.data) await (db[obj.table] as Table<Rec, string>).put(obj.data)
    else if (obj.t === 'att' && obj.data && obj.b64) {
      const meta = obj.data as { id: string; mimeType: string }
      await db.attachments.put({ ...(obj.data as object), blob: new Blob([b64.toBytes(obj.b64)], { type: meta.mimeType }) } as never)
    }
    else if (obj.t === 'end') break
    if (myIdx % 25 === 0) {
      localStorage.setItem(CK, JSON.stringify({ name: file.name, size: file.size, lastModified: file.lastModified, line: myIdx + 1 }))
      opts.onProgress(Math.min(0.99, bytes / file.size), `Ripristino blocco ${myIdx}`)
      await new Promise(r => setTimeout(r, 0))
    }
  }
  localStorage.removeItem(CK)
  opts.onProgress(1, 'Ripristino completato')
}

export async function applyRemote(file: Blob, password: string, strategy: 'merge' | 'remote', onProgress: Progress) {
  let key: CryptoKey | null = null
  let idx = 0, bytes = 0, wiped = false
  for await (const line of readLines(file)) {
    bytes += line.length + 1
    if (idx++ === 0) { const h = JSON.parse(line); key = await deriveKey(password, b64.toBytes(h.salt)); continue }
    const obj = JSON.parse(dec.decode(await decryptChunk(key!, b64.toBytes(line))))
    if (obj.t === 'meta') { if (strategy === 'remote' && !wiped) { await wipeDatabase(); wiped = true } }
    else if (obj.t === 'rec') {
      const t = db[obj.table as TableName] as Table<Rec, string>
      if (strategy === 'remote') await t.put(obj.data)
      else { const local = await t.get(obj.data.id); if (!local || (obj.data.updatedAt ?? 0) > (local.updatedAt ?? 0)) await t.put(obj.data) }
    } else if (obj.t === 'att') {
      const exist = await db.attachments.get(obj.data.id)
      if (strategy === 'remote' || !exist) await db.attachments.put({ ...obj.data, blob: new Blob([b64.toBytes(obj.b64)], { type: obj.data.mimeType }) } as never)
    } else if (obj.t === 'end') break
    onProgress(Math.min(0.99, bytes / file.size), 'Sincronizzazione…')
  }
  onProgress(1, 'Sync completato')
}