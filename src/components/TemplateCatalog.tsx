import { useState } from 'react'
import { Copy, Layers } from 'lucide-react'
import { TEMPLATES, cloneTemplate, type Template } from '../lib/templates'
import { AreaIcon } from '../lib/meta'
import { Badge, Btn, useToast } from './ui'

export function TemplateCatalog({ onCloned }: { onCloned?: (loopId: string) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const clone = async (t: Template) => {
    setBusy(t.id)
    try { const id = await cloneTemplate(t); toast(`«${t.title}» clonato: struttura pronta, personalizzala`); onCloned?.(id) }
    catch (e) { toast(`Errore: ${(e as Error).message}`) }
    setBusy(null)
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {TEMPLATES.map(t => (
        <div key={t.id} className="rounded-2xl border border-line bg-surface2 p-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: t.color + '22', color: t.color }}><AreaIcon name={t.icon} size={18} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-tight">{t.title}</p>
              <p className="mt-1 text-xs text-muted">{t.desc}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1">
            <Badge color={t.color}>{t.areaName}</Badge>
            <Badge color="var(--color-action)">{t.steps.length} azioni</Badge>
            <Badge color="var(--color-meet)">{t.meets.length} incontri</Badge>
            {t.budget && <Badge color="var(--color-budget)">Budget</Badge>}
          </div>
          <Btn variant="soft" className="mt-3 w-full" disabled={busy === t.id} onClick={() => clone(t)}>
            <span className="flex items-center justify-center gap-2">{busy === t.id ? <Layers size={15} className="animate-pulse" /> : <Copy size={15} />}{busy === t.id ? 'Clono…' : 'Clona struttura'}</span>
          </Btn>
        </div>
      ))}
      <p className="text-xs text-muted md:col-span-2">I template sono strutture read-only: clonandoli crei un nuovo Loop indipendente, senza toccare i tuoi dati.</p>
    </div>
  )
}