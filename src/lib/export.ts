import type { Area, Budget, BudgetEntry, Loop, LoopItem } from '../db/schema'
import { htmlToText } from './media'
import { STATUS_META, TYPE_META, effDate, fmtDateTime, fmtMoney } from './meta'

type Bundle = { loop: Loop; area?: Area; items: LoopItem[]; budgets: Budget[]; entries: BudgetEntry[] }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function loopToMarkdown({ loop, area, items, budgets, entries }: Bundle): string {
  const L: string[] = [`# ${loop.title}`, '']
  L.push(`- **Stato:** ${STATUS_META[loop.status].label}`)
  if (area) L.push(`- **Area:** ${area.name}`)
  L.push(`- **Creato:** ${fmtDateTime(loop.createdAt)}`, `- **Ultima attività:** ${fmtDateTime(loop.lastActivityAt)}`, '')
  if (loop.goal) L.push(`> ${loop.goal}`, '')
  const pending = items.filter(i => i.status === 'pending')
  if (pending.length) {
    L.push('## Da fare', '')
    for (const i of pending) L.push(`- [ ] ${i.title}${i.scheduledAt ? ` _(entro ${fmtDateTime(i.scheduledAt)})_` : ''}`)
    L.push('')
  }
  L.push('## Timeline', '')
  const hist = items.filter(i => i.status !== 'pending').sort((a, b) => effDate(b) - effDate(a))
  for (const i of hist) {
    const label = i.isFocus ? '★ PUNTO CHIAVE · ' : ''
    L.push(`### ${label}${TYPE_META[i.type].label} — ${i.title}`, `_${fmtDateTime(effDate(i))}_`, '')
    if (i.content) L.push(htmlToText(i.content), '')
    if (i.outcome) L.push(`> **Esito:** ${i.outcome}`, '')
    if (i.locationOrLink) L.push(`Luogo/link: ${i.locationOrLink}`, '')
  }
  for (const b of budgets) {
    const be = entries.filter(e => e.budgetId === b.id)
    const est = be.filter(e => e.entryType === 'estimate').reduce((s, e) => s + e.amount, 0)
    const act = be.filter(e => e.entryType === 'actual').reduce((s, e) => s + e.amount, 0)
    L.push(`## Budget: ${b.name} (${b.status === 'open' ? 'aperto' : 'chiuso'})`, '')
    if (b.ceiling) L.push(`Tetto: ${fmtMoney(b.ceiling, b.currency)} · `, '')
    L.push(`Stime: **${fmtMoney(est, b.currency)}** · Pagamenti: **${fmtMoney(act, b.currency)}**`, '')
    L.push('| Data | Voce | Tipo | Importo |', '|---|---|---|---|')
    for (const e of be) L.push(`| ${fmtDateTime(e.date)} | ${e.title} | ${e.entryType === 'actual' ? 'Pagamento' : 'Stima'} | ${fmtMoney(e.amount, b.currency)} |`)
    L.push('')
  }
  L.push('---', '_Esportato da Loop — PWA local-first_')
  return L.join('\n')
}

export function downloadText(name: string, text: string, mime = 'text/markdown') {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function exportLoopPdf(bundle: Bundle) {
  const { loop, area, items, budgets, entries } = bundle
  const hist = items.filter(i => i.status !== 'pending').sort((a, b) => effDate(b) - effDate(a))
  const pending = items.filter(i => i.status === 'pending')
  const rows = hist.map(i => `
    <div class="node ${i.isFocus ? 'focus' : ''}">
      <div class="meta">${i.isFocus ? '★ PUNTO CHIAVE · ' : ''}${TYPE_META[i.type].label} · ${fmtDateTime(effDate(i))}</div>
      <div class="title">${esc(i.title)}</div>
      ${i.content ? `<div class="body">${esc(htmlToText(i.content))}</div>` : ''}
      ${i.outcome ? `<div class="outcome"><b>Esito:</b> ${esc(i.outcome)}</div>` : ''}
    </div>`).join('')
  const budgetHtml = budgets.map(b => {
    const be = entries.filter(e => e.budgetId === b.id)
    const act = be.filter(e => e.entryType === 'actual').reduce((s, e) => s + e.amount, 0)
    const est = be.filter(e => e.entryType === 'estimate').reduce((s, e) => s + e.amount, 0)
    return `<h2>Budget: ${esc(b.name)}</h2><p>Stime ${fmtMoney(est, b.currency)} · Pagamenti ${fmtMoney(act, b.currency)}${b.ceiling ? ` · Tetto ${fmtMoney(b.ceiling, b.currency)}` : ''}</p>
    <table><tr><th>Data</th><th>Voce</th><th>Tipo</th><th>Importo</th></tr>${be.map(e => `<tr><td>${fmtDateTime(e.date)}</td><td>${esc(e.title)}</td><td>${e.entryType === 'actual' ? 'Pagamento' : 'Stima'}</td><td>${fmtMoney(e.amount, b.currency)}</td></tr>`).join('')}</table>`
  }).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(loop.title)} — Loop</title><style>
    body{font-family:system-ui,sans-serif;color:#111;max-width:720px;margin:24px auto;padding:0 16px}
    h1{margin-bottom:4px} .sub{color:#666;margin-bottom:16px} .goal{border-left:3px solid #14b8a6;padding-left:10px;color:#333}
    .node{border:1px solid #ddd;border-radius:10px;padding:10px 12px;margin:10px 0;page-break-inside:avoid}
    .node.focus{border-color:#a855f7;background:#faf5ff} .meta{font-size:11px;color:#777;text-transform:uppercase;letter-spacing:.5px}
    .title{font-weight:700;margin:2px 0} .body{font-size:13px;color:#444;white-space:pre-wrap}
    .outcome{margin-top:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:6px 8px;font-size:13px}
    table{width:100%;border-collapse:collapse;font-size:13px} th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
    ul{font-size:14px} @media print{body{margin:0}}
  </style></head><body>
    <h1>${esc(loop.title)}</h1>
    <div class="sub">${STATUS_META[loop.status].label}${area ? ` · Area: ${esc(area.name)}` : ''} · Aggiornato ${fmtDateTime(loop.lastActivityAt)}</div>
    ${loop.goal ? `<p class="goal">${esc(loop.goal)}</p>` : ''}
    ${pending.length ? `<h2>Da fare</h2><ul>${pending.map(i => `<li>${esc(i.title)}${i.scheduledAt ? ` — entro ${fmtDateTime(i.scheduledAt)}` : ''}</li>`).join('')}</ul>` : ''}
    <h2>Timeline</h2>${rows || '<p>Nessun nodo storico.</p>'}
    ${budgetHtml}
    <p style="color:#999;font-size:11px;margin-top:24px">Esportato da Loop — PWA local-first</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),200)</script>
  </body></html>`
  const w = window.open('', '_blank')
  if (!w) throw new Error('Il browser ha bloccato la finestra di stampa')
  w.document.write(html); w.document.close()
}