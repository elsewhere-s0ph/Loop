import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Plus, Star, Trash2 } from 'lucide-react'
import { db, type Area, type ChecklistEntry, type ItemType, type Loop, type LoopItem, type LoopStatus, type Note, type Priority, type Recurrence } from '../db/schema'
import { useAreas, useItems, useLoops } from '../hooks/useDb'
import { addAttachment, cancelReminder, completeOccurrence, completeWithOutcome, createArea, createItem, createLoop, deleteNote, moveAttachmentsToItem, removeAttachment, scheduleReminder, toggleFocus, updateArea, updateItem, updateLoop, uid } from '../db/services'
import { AREA_COLORS, AREA_ICONS, AreaIcon, TYPE_META, fromLocalInput, toLocalInput, toDateInput } from '../lib/meta'
import { htmlToText } from '../lib/media'
import { AttachmentManager, type AttRef } from './Attachments'
import { RichTextEditor } from './RichText'
import { Badge, Btn, Field, IconBtn, Modal, Select, TextArea, TextInput } from './ui'

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
const DAYIDX = [1, 2, 3, 4, 5, 6, 0]

export function ItemForm({ open, onClose, loopId, item, defaultType, fromNote }: {
  open: boolean; onClose: () => void; loopId?: string; item?: LoopItem | null; defaultType?: ItemType; fromNote?: Note | null
}) {
  const loops = useLoops()
  const targetItems = useItems(item?.loopId ?? loopId ?? target0())
  const [type, setType] = useState<ItemType>('fact')
  const [target, setTarget] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [priority, setPriority] = useState<Priority>('later')
  const [scheduled, setScheduled] = useState('')
  const [end, setEnd] = useState('')
  const [location, setLocation] = useState('')
  const [linked, setLinked] = useState('')
  const [isFocus, setIsFocus] = useState(false)
  const [checklist, setChecklist] = useState<ChecklistEntry[]>([])
  const [newTask, setNewTask] = useState('')
  const [atts, setAtts] = useState<AttRef[]>([])
  const [freq, setFreq] = useState<Recurrence['frequency']>('none')
  const [interval, setInterval] = useState(1)
  const [days, setDays] = useState<number[]>([])
  const [endDate, setEndDate] = useState('')
  const [error, setError] = useState('')

  function target0() { return '' }

  useEffect(() => {
    if (!open) return
    const t = item?.type ?? defaultType ?? 'fact'
    setType(t)
    setTarget(item?.loopId ?? loopId ?? '')
    setTitle(item?.title ?? (fromNote ? htmlToText(fromNote.content).slice(0, 80) : ''))
    setContent(item?.content ?? fromNote?.content ?? '')
    setPriority(item?.priority ?? 'later')
    setScheduled(item?.scheduledAt ? toLocalInput(item.scheduledAt) : t === 'meet' ? toLocalInput(Date.now() + 3600000) : '')
    setEnd(item?.endAt ? toLocalInput(item.endAt) : '')
    setLocation(item?.locationOrLink ?? '')
    setLinked(item?.linkedActionId ?? '')
    setIsFocus(item?.isFocus ?? false)
    setChecklist(item?.checklist ?? [])
    setFreq(item?.recurrence?.frequency ?? 'none')
    setInterval(item?.recurrence?.interval ?? 1)
    setDays(item?.recurrence?.daysOfWeek ?? [])
    setEndDate(item?.recurrence?.endDate ? toDateInput(item.recurrence.endDate) : '')
    setNewTask(''); setError('')
    const ids = item?.attachmentIds ?? fromNote?.attachmentIds ?? []
    void Promise.all(ids.map(id => db.attachments.get(id))).then(list => {
      setAtts(list.filter(Boolean).map(a => ({ id: a!.id, kind: a!.kind, mimeType: a!.mimeType, blob: a!.blob, durationSec: a!.durationSec })))
    })
  }, [open, item, defaultType, loopId, fromNote])

  const persistAttachments = async (parentId: string, refs: AttRef[], originalIds: string[], moveExisting: boolean) => {
    const keep = refs.filter(r => r.id).map(r => r.id!)
    for (const oid of originalIds) if (!keep.includes(oid)) await removeAttachment(oid)
    if (moveExisting && keep.length) await moveAttachmentsToItem(keep, parentId)
    for (const r of refs.filter(r => !r.id)) await addAttachment({ parentType: 'item', parentId, kind: r.kind, mimeType: r.mimeType, blob: r.blob, durationSec: r.durationSec })
  }

  const save = async () => {
    if (!title.trim()) return setError('Il titolo è obbligatorio.')
    const lid = item?.loopId ?? target
    if (!lid) return setError('Scegli un Loop di destinazione.')
    if ((type === 'meet' || type === 'event') && !scheduled) return setError('Indica data e ora.')
    const recurrence: Recurrence | undefined = (type === 'meet' || type === 'event') && freq !== 'none'
      ? { frequency: freq, interval: Math.max(1, interval), daysOfWeek: freq === 'weekly' ? days : undefined, endDate: endDate ? new Date(endDate + 'T23:59:59').getTime() : undefined }
      : undefined
    const scheduledAt = scheduled ? fromLocalInput(scheduled) : undefined
    const data = {
      loopId: lid, type, title: title.trim(), content, isFocus,
      priority: type === 'action' ? priority : undefined,
      scheduledAt,
      endAt: type === 'meet' && end ? fromLocalInput(end) : undefined,
      locationOrLink: type === 'meet' ? location : undefined,
      linkedActionId: type === 'meet' ? linked || undefined : undefined,
      checklist: type === 'action' ? checklist : undefined,
      recurrence,
    }
    const originalIds = item?.attachmentIds ?? fromNote?.attachmentIds ?? []
    let savedItemId: string | undefined
    if (item) {
      await updateItem(item.id, data)
      await persistAttachments(item.id, atts, originalIds, false)
      savedItemId = item.id
    } else {
      savedItemId = await createItem(data)
      await persistAttachments(savedItemId, atts, originalIds, !!fromNote)
      if (fromNote) await deleteNote(fromNote.id)
    }

    // Gestione reminder
    if (savedItemId && scheduledAt && (type === 'action' || type === 'meet')) {
      await scheduleReminder(savedItemId, lid, title.trim(), '', scheduledAt)
    } else if (savedItemId) {
      await cancelReminder(savedItemId)
    }

    onClose()
  }

  const addTask = () => {
    if (!newTask.trim()) return
    setChecklist(c => [...c, { id: uid(), text: newTask.trim(), done: false }])
    setNewTask('')
  }

  const linkable = targetItems.filter(i => i.type === 'action')

  return (
    <Modal open={open} onClose={onClose} title={item ? 'Modifica elemento' : fromNote ? 'Smista nota' : 'Nuovo elemento'} wide>
      <div className="space-y-4">
        {!item && (
          <div className="grid grid-cols-4 gap-2">
            {(Object.keys(TYPE_META) as ItemType[]).map(t => {
              const M = TYPE_META[t]; const I = M.icon
              return (
                <button key={t} onClick={() => setType(t)}
                  className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-semibold transition ${type === t ? 'border-transparent' : 'border-line bg-surface2 text-muted'}`}
                  style={type === t ? { background: M.color + '22', color: M.color } : undefined}>
                  <I size={18} />{M.label}
                </button>
              )
            })}
          </div>
        )}
        {item && <Badge color={TYPE_META[item.type].color}>{TYPE_META[item.type].label}</Badge>}
        {!loopId && !item && (
          <Field label="Loop">
            <Select value={target} onChange={e => setTarget(e.target.value)}>
              <option value="">Scegli…</option>
              {loops.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </Select>
          </Field>
        )}
        <Field label="Titolo"><TextInput value={title} onChange={e => setTitle(e.target.value)} placeholder="Es. Chiamare idraulico per preventivo" autoFocus /></Field>
        <Field label="Note (rich text)"><RichTextEditor value={content} onChange={setContent} placeholder="Dettagli, contesto, numeri…" /></Field>

        {type === 'action' && (
          <>
            <Field label="Priorità">
              <Select value={priority} onChange={e => setPriority(e.target.value as Priority)}>
                <option value="now">Da fare ora (Adesso)</option>
                <option value="later">Prossimi passi</option>
              </Select>
            </Field>
            <div>
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Checklist</span>
              <div className="space-y-1">
                {checklist.map(c => (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
                    <button onClick={() => setChecklist(x => x.map(y => y.id === c.id ? { ...y, done: !y.done } : y))}
                      className={`grid h-5 w-5 place-items-center rounded-md border ${c.done ? 'border-outcome bg-outcome text-bg' : 'border-line'}`}>
                      {c.done && <Check size={12} />}
                    </button>
                    <span className={`flex-1 text-sm ${c.done ? 'text-muted line-through' : ''}`}>{c.text}</span>
                    <IconBtn onClick={() => setChecklist(x => x.filter(y => y.id !== c.id))}><Trash2 size={14} /></IconBtn>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <TextInput value={newTask} onChange={e => setNewTask(e.target.value)} placeholder="Aggiungi sotto-task…"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask() } }} />
                <Btn variant="soft" onClick={addTask}><Plus size={16} /></Btn>
              </div>
            </div>
          </>
        )}

        {(type === 'action' || type === 'meet' || type === 'event') && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={type === 'action' ? 'Scadenza' : 'Inizio'}>
              <TextInput type="datetime-local" value={scheduled} onChange={e => setScheduled(e.target.value)} />
            </Field>
            {type === 'meet' && (
              <Field label="Fine"><TextInput type="datetime-local" value={end} onChange={e => setEnd(e.target.value)} /></Field>
            )}
          </div>
        )}
        {type === 'meet' && (
          <>
            <Field label="Luogo o link"><TextInput value={location} onChange={e => setLocation(e.target.value)} placeholder="Via Roma 12 / meet.google.com…" /></Field>
            <Field label="Collega a un'azione (opz.)">
              <Select value={linked} onChange={e => setLinked(e.target.value)}>
                <option value="">Nessuna</option>
                {linkable.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
              </Select>
            </Field>
          </>
        )}

        {(type === 'meet' || type === 'event') && (
          <div className="rounded-xl border border-line bg-surface2 p-3">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">Ricorrenza</span>
            <div className="grid grid-cols-2 gap-2">
              <Select value={freq} onChange={e => setFreq(e.target.value as Recurrence['frequency'])}>
                <option value="none">Non si ripete</option>
                <option value="daily">Giornaliera</option>
                <option value="weekly">Settimanale</option>
                <option value="monthly">Mensile</option>
                <option value="yearly">Annuale</option>
              </Select>
              <TextInput type="number" min={1} value={interval}
                onChange={e => setInterval(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            {freq === 'weekly' && (
              <div className="mt-2 flex gap-1">
                {WEEKDAYS.map((w, i) => (
                  <button key={i} onClick={() => setDays(d => d.includes(DAYIDX[i]) ? d.filter(x => x !== DAYIDX[i]) : [...d, DAYIDX[i]])}
                    className={`grid h-8 w-8 place-items-center rounded-lg text-xs font-bold ${days.includes(DAYIDX[i]) ? 'bg-meet text-bg' : 'bg-surface text-muted'}`}>{w}</button>
                ))}
              </div>
            )}
            {freq !== 'none' && (
              <Field label="Fine serie (opz.)">
                <TextInput type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </Field>
            )}
          </div>
        )}

        <AttachmentManager value={atts} onChange={setAtts} />

        <button onClick={() => setIsFocus(f => !f)}
          className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${isFocus ? 'border-focus bg-focus/15 text-focus' : 'border-line bg-surface2 text-muted'}`}>
          <Star size={16} fill={isFocus ? 'currentColor' : 'none'} /> Punto Chiave (evidenzia nella Timeline)
        </button>

        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Annulla</Btn>
          <Btn onClick={save}>{item ? 'Salva modifiche' : 'Crea'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function OutcomeModal({ item, occurrenceStart, onClose }: { item: LoopItem | null; occurrenceStart?: number; onClose: () => void }) {
  const [text, setText] = useState('')
  const [focus, setFocus] = useState(false)
  useEffect(() => { if (item) { setText(item.outcome ?? ''); setFocus(item.isFocus) } }, [item])
  const done = async (withOutcome: boolean) => {
    if (!item) return
    if (occurrenceStart !== undefined) await completeOccurrence(item.id, occurrenceStart, withOutcome ? text : undefined)
    else await completeWithOutcome(item.id, withOutcome ? text : undefined)
    if (focus !== item.isFocus) await toggleFocus(item.id)
    onClose()
  }
  return (
    <Modal open={!!item} onClose={onClose} title={occurrenceStart !== undefined ? 'Completa occorrenza' : 'Completa con Esito'}>
      {item && (
        <div className="space-y-4">
          <p className="text-sm text-muted">Stai completando: <span className="font-semibold text-ink">{item.title}</span>{occurrenceStart !== undefined && item.recurrence && item.recurrence.frequency !== 'none' ? ' (questa occorrenza; la serie avanzerà)' : ''}</p>
          <Field label="Come è andata? Cosa hai scoperto?">
            <TextArea value={text} onChange={e => setText(e.target.value)} autoFocus
              placeholder="Es. Preventivo ricevuto: 1.200€, esclusa certificazione finale" />
          </Field>
          <button onClick={() => setFocus(f => !f)}
            className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${focus ? 'border-focus bg-focus/15 text-focus' : 'border-line bg-surface2 text-muted'}`}>
            <Star size={16} fill={focus ? 'currentColor' : 'none'} /> Segna come Punto Chiave
          </button>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => done(false)}>Completa senza esito</Btn>
            <Btn className="!bg-outcome" onClick={() => done(true)}>Registra Esito</Btn>
          </div>
        </div>
      )}
    </Modal>
  )
}

export function LoopForm({ open, onClose, loop, onCreated }: { open: boolean; onClose: () => void; loop?: Loop | null; onCreated?: (id: string) => void }) {
  const areas = useAreas()
  const [title, setTitle] = useState('')
  const [goal, setGoal] = useState('')
  const [areaId, setAreaId] = useState('')
  const [status, setStatus] = useState<LoopStatus>('active')
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setTitle(loop?.title ?? '')
    setGoal(loop?.goal ?? '')
    setAreaId(loop?.areaId ?? '')
    setStatus(loop?.status ?? 'active')
    setError('')
  }, [open, loop])
  const save = async () => {
    if (!title.trim()) return setError('Il titolo è obbligatorio.')
    if (loop) { await updateLoop(loop.id, { title: title.trim(), goal, areaId: areaId || null, status }); onClose() }
    else {
      const id = await createLoop({ title: title.trim(), goal, areaId: areaId || null, status })
      onClose(); onCreated?.(id)
    }
  }
  return (
    <Modal open={open} onClose={onClose} title={loop ? 'Modifica Loop' : 'Nuovo Loop'}>
      <div className="space-y-4">
        <Field label="Titolo"><TextInput value={title} onChange={e => setTitle(e.target.value)} autoFocus placeholder="Es. Ristrutturazione Bagno" /></Field>
        <Field label="Obiettivo"><TextArea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Cosa vuoi ottenere entro quando?" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Area">
            <Select value={areaId} onChange={e => setAreaId(e.target.value)}>
              <option value="">Nessuna</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Stato">
            <Select value={status} onChange={e => setStatus(e.target.value as LoopStatus)}>
              <option value="active">Attivo</option>
              <option value="paused">In pausa</option>
              <option value="completed">Concluso</option>
            </Select>
          </Field>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Annulla</Btn>
          <Btn onClick={save}>{loop ? 'Salva' : 'Crea Loop'}</Btn>
        </div>
      </div>
    </Modal>
  )
}

export function AreaForm({ open, onClose, area }: { open: boolean; onClose: () => void; area?: Area | null }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(AREA_COLORS[0])
  const [icon, setIcon] = useState(AREA_ICONS[0])
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    setName(area?.name ?? '')
    setColor(area?.color ?? AREA_COLORS[0])
    setIcon(area?.icon ?? AREA_ICONS[0])
    setError('')
  }, [open, area])
  const save = async () => {
    if (!name.trim()) return setError('Il nome è obbligatorio.')
    if (area) await updateArea(area.id, { name: name.trim(), color, icon })
    else await createArea({ name: name.trim(), color, icon })
    onClose()
  }
  return (
    <Modal open={open} onClose={onClose} title={area ? 'Modifica Area' : 'Nuova Area'}>
      <div className="space-y-4">
        <Field label="Nome"><TextInput value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="Es. Casa, Lavoro, Salute" /></Field>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Colore (12)</span>
          <div className="flex flex-wrap gap-2">
            {AREA_COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full transition ${color === c ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Icona (45)</span>
          <div className="loop-scroll grid max-h-44 grid-cols-6 gap-2 overflow-y-auto pr-1">
            {AREA_ICONS.map(i => (
              <button key={i} onClick={() => setIcon(i)}
                className={`grid h-10 place-items-center rounded-xl border ${icon === i ? 'border-transparent' : 'border-line bg-surface2 text-muted'}`}
                style={icon === i ? { background: color + '22', color } : undefined}>
                <AreaIcon name={i} size={18} />
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Btn variant="ghost" onClick={onClose}>Annulla</Btn>
          <Btn onClick={save}>{area ? 'Salva' : 'Crea Area'}</Btn>
        </div>
      </div>
    </Modal>
  )
}