export type WebDavCfg = { url: string; user: string; pass: string }
export const webdavPrefs = {
  get(): WebDavCfg | null { try { return JSON.parse(localStorage.getItem('loop.webdav') ?? 'null') } catch { return null } },
  set(c: WebDavCfg) { localStorage.setItem('loop.webdav', JSON.stringify(c)) },
}
const FILE = 'loop-backup.loop'
const auth = (c: WebDavCfg) => 'Basic ' + btoa(`${c.user}:${c.pass}`)
const target = (u: string) => u.replace(/\/+$/, '') + '/' + FILE
export async function webdavUpload(c: WebDavCfg, blob: Blob) {
  const r = await fetch(target(c.url), { method: 'PUT', headers: { Authorization: auth(c) }, body: blob })
  if (!r.ok) throw new Error(`WebDAV PUT: HTTP ${r.status}`)
}
export async function webdavDownload(c: WebDavCfg): Promise<Blob | null> {
  const r = await fetch(target(c.url), { headers: { Authorization: auth(c) } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`WebDAV GET: HTTP ${r.status}`)
  return r.blob()
}
export const lastSync = {
  get(): number { return parseInt(localStorage.getItem('loop.lastSync') ?? '0') },
  set() { localStorage.setItem('loop.lastSync', String(Date.now())) },
}