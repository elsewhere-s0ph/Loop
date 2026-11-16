import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Link2, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { db, type Budget, type BudgetEntry, type Loop } from '../db/schema'
import { useBudgetEntries, useBudgets, useItems } from '../hooks/useDb'
import { addAttachment, addBudgetEntry, closeBudget, createBudget, deleteBudgetEntry, updateBudget } from '../db/services'
import { C, fmtDate, fmtMoney } from '../lib/meta'
import { AttachmentList, AttachmentManager, type AttRef } from './Attachments'
import { Badge, Btn, Field, IconBtn, Modal, Select, TextInput, useToast } from './ui'

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY']

export function BudgetModal({ loop, onClose }: { loop: Loop | null; onClose: () => void }) {
  const budgets = useBudgets(loop?.id)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('EUR')
  const [ceiling, setCeiling] = useState('')
  if (!loop) return null
  const create = async () => {
    if (!name.trim()) return
    await createBudget({ loopId: loop.id, name: name.trim(), currency, ceiling: ceiling ? parseFloat(ceiling.replace(',', '.')) : undefined })
    setCreating(false); setName(''); setCeiling('')
  }
  return (
    <Modal open onClose={onClose} title={`Budget · ${loop.title}`} wide>
      <div className="space-y-4">
        {budgets.length === 0 && !creating && (
          <Btn variant="soft" className="w-full" onClick={() => { setCreating(true); setName(`Budget ${loop.title}`) }}>
            <span className="flex items-center justify-center gap-2"><Wallet size={16} /> Crea il primo budget</span>
          </Btn>
        )}
        {creating && (
          <div className="rounded-2xl border border-line bg-surface2 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome"><TextInput value={name} onChange={e => setName(e.target.value)} autoFocus /></Field>
              <Field label="Valuta"><Select value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</Select></Field>
            </div>
            <Field label="Tetto massimo (opzionale)"><TextInput value={ceiling} onChange={e => setCeiling(e.target.value)} inputMode="decimal" placeholder="Es. 8000" /></Field>
            <div className="mt-3 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setCreating(false)}>Annulla</Btn><Btn onClick={create}>Crea</Btn></div>
          </div>
        )}
        {budgets.map(b => <BudgetCard key={b.id} budget={b} loop={loop} />)}
        {budgets.length > 0 && !creating && <Btn variant="ghost" className="w-full" onClick={() => { setCreating(true); setName('') }}><span className="flex items-center justify-center gap-1"><Plus size={14} /> Altro budget</span></Btn>}
      </div>
    </Modal>
  )
}

function BudgetCard({ budget, loop }: { budget: Budget; loop: Loop }) {
  const entries = useBudgetEntries(budget.id)
  const items = useItems(loop.id)
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(budget.name)
  const [currency, setCurrency] = useState(budget.currency)
  const [ceiling, setCeiling] = useState(budget.ceiling?.toString() ?? '')
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [kind, setKind] = useState<'estimate' | 'actual'>('actual')
  const [linked, setLinked] = useState('')
  const [date, setDate] = useState('')
  const [atts, setAtts] = useState<AttRef[]>([])

  const est = entries.filter(e => e.entryType === 'estimate').reduce((s, e) => s + e.amount, 0)
  const act = entries.filter(e => e.entryType === 'actual').reduce((s, e) => s + e.amount, 0)
  const pct = budget.ceiling ? Math.min(100, Math.round((act / budget.ceiling) * 100)) : 0
  const linkable = items.filter(i => i.type === 'action' || i.type === 'fact')

  const saveEdit = async () => {
    await updateBudget(budget.id, { name: name.trim() || budget.name, currency, ceiling: ceiling ? parseFloat(ceiling.replace(',', '.')) : undefined })
    setEdit(false)
  }
  const add = async () => {
    const n = parseFloat(amount.replace(',', '.'))
    if (!title.trim() || isNaN(n)) return
    const id = await addBudgetEntry({ budgetId: budget.id, loopId: loop.id, title: title.trim(), amount: n, entryType: kind, linkedActionId: linked || undefined, date: date ? new Date(date).getTime() : Date.now() })
    for (const a of atts) await addAttachment({ parentType: 'budget', parentId: id, kind: a.kind, mimeType: a.mimeType, blob: a.blob, durationSec: a.durationSec })
    setTitle(''); setAmount(''); setLinked(''); setDate(''); setAtts([])
    toast('Voce di budget aggiunta')
  }
  const removeEntry = async (e: BudgetEntry) => {
    for (const id of e.attachmentIds ?? []) await db.attachments.delete(id)
    await deleteBudgetEntry(e.id)
    toast('Voce eliminata', { label: 'Annulla', fn: () => { void db.budgetEntries.add(e) } })
  }

  return (
    <div className="rounded-2xl border border-line bg-surface2 p-4">
      <div className="flex items-center justify-between gap-2">
        {edit ? <TextInput value={name} onChange={e => setName(e.target.value)} /> : <p className="font-semibold">{budget.name}</p>}
        <div className="flex items-center gap-1">
          <Badge color={budget.status === 'open' ? C.outcome : C.event}>{budget.status === 'open' ? 'Aperto' : 'Chiuso'}</Badge>
          {budget.status === 'open' && <IconBtn onClick={() => setEdit(x => !x)}><Pencil size={14} /></IconBtn>}
        </div>
      </div>
      {edit && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Select value={currency} onChange={e => setCurrency(e.target.value)}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</Select>
          <TextInput value={ceiling} onChange={e => setCeiling(e.target.value)} placeholder="Tetto" inputMode="decimal" />
          <Btn variant="soft" className="col-span-2" onClick={saveEdit}>Salva impostazioni</Btn>
        </div>
      )}
      <p className="mt-2 text-2xl font-bold">{fmtMoney(act, budget.currency)}</p>
      {budget.ceiling && (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct > 90 ? C.danger : C.outcome }} /></div>
          <p className="mt-1 text-xs text-muted">{pct}% del tetto {fmtMoney(budget.ceiling, budget.currency)} · Stime {fmtMoney(est, budget.currency)} · Saldo stime {fmtMoney(est - act, budget.currency)}</p>
        </>
      )}
      <div className="mt-3 space-y-2">
        {entries.map(e => {
          const link = items.find(i => i.id === e.linkedActionId)
          return (
            <div key={e.id} className="rounded-xl bg-surface px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge color={e.entryType === 'actual' ? C.outcome : C.budget}>{e.entryType === 'actual' ? 'Pagamento' : 'Stima'}</Badge>
                <span className="flex-1 truncate">{e.title}</span>
                <span className="font-semibold">{fmtMoney(e.amount, budget.currency)}</span>
                {budget.status === 'open' && <IconBtn onClick={() => removeEntry(e)} className="hover:!text-danger"><Trash2 size={14} /></IconBtn>}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span>{fmtDate(e.date)}</span>
                {link && <span className="flex items-center gap-1 text-meet"><Link2 size={11} />{link.title}</span>}
              </div>
              <AttachmentList ids={e.attachmentIds ?? []} />
            </div>
          )
        })}
      </div>
      {budget.status === 'open' && (
        <div className="mt-3 space-y-2 rounded-xl border border-line bg-surface p-3">
          <div className="grid grid-cols-[1fr_90px] gap-2">
            <TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Voce (es. Fattura idraulico)" />
            <TextInput value={amount} onChange={e => setAmount(e.target.value)} placeholder="€" inputMode="decimal" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={kind} onChange={e => setKind(e.target.value as 'estimate' | 'actual')}><option value="actual">Pagamento</option><option value="estimate">Stima</option></Select>
            <TextInput type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <Select value={linked} onChange={e => setLinked(e.target.value)}>
            <option value="">Collega a Passo/Traccia (opz.)</option>
            {linkable.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
          </Select>
          <AttachmentManager value={atts} onChange={setAtts} />
          <Btn variant="soft" className="w-full" onClick={add}><span className="flex items-center justify-center gap-1"><Plus size={14} /> Aggiungi voce</span></Btn>
          <Btn variant="ghost" className="w-full" onClick={() => closeBudget(budget.id)}>Chiudi budget → nodo Timeline</Btn>
        </div>
      )}
    </div>
  )
}