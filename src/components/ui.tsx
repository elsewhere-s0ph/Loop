import { createContext, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Inbox, Undo2, X } from 'lucide-react'
import { readableOnLight, useTheme } from '../lib/theme'

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`loop-scroll max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-line bg-surface p-5 pb-safe md:rounded-3xl ${wide ? 'md:max-w-2xl' : 'md:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface2 hover:text-ink"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Confirm({ open, title, message, onConfirm, onClose }: { open: boolean; title: string; message: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-muted">{message}</p>
      <div className="mt-5 flex justify-end gap-2">
        <Btn variant="ghost" onClick={onClose}>Annulla</Btn>
        <Btn variant="danger" onClick={() => { onConfirm(); onClose() }}>Elimina</Btn>
      </div>
    </Modal>
  )
}

type Toast = { id: number; msg: string; action?: { label: string; fn: () => void } }
const ToastCtx = createContext<(msg: string, action?: Toast['action']) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = (msg: string, action?: Toast['action']) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, msg, action }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6">
        {toasts.map(t => (
          <div key={t.id} className="toast-in pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-surface2 px-4 py-3 text-sm shadow-xl">
            <span>{t.msg}</span>
            {t.action && (
              <button className="flex items-center gap-1 font-semibold text-meet"
                onClick={() => { t.action!.fn(); setToasts(x => x.filter(y => y.id !== t.id)) }}>
                <Undo2 size={14} />{t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export const Badge = ({ color, children }: { color: string; children: ReactNode }) => {
  const { resolved } = useTheme()
  const fg = resolved === 'light' && color.startsWith('#') ? readableOnLight(color) : color
  const bg = color.startsWith('#') ? color + (resolved === 'light' ? '1f' : '22') : `color-mix(in srgb, ${color} 14%, transparent)`
  return <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold" style={{ background: bg, color: fg }}>{children}</span>
}

export function Btn({ variant = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' }) {
  const styles = {
    primary: 'bg-meet text-bg font-semibold hover:brightness-110',
    soft: 'bg-surface2 text-ink hover:bg-line',
    ghost: 'text-muted hover:bg-surface2 hover:text-ink',
    danger: 'bg-danger/15 text-danger hover:bg-danger/25',
  }[variant]
  return <button className={`rounded-xl px-4 py-2 text-sm transition disabled:opacity-40 ${styles} ${className}`} {...p} />
}
export const IconBtn = ({ className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button className={`rounded-lg p-2 text-muted transition hover:bg-surface2 hover:text-ink ${className}`} {...p} />
)

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
    {children}
  </label>
)
const inputCls = 'w-full rounded-xl border border-line bg-surface2 px-3 py-2 text-sm outline-none transition focus:border-meet'
export const TextInput = (p: InputHTMLAttributes<HTMLInputElement>) => <input className={inputCls} {...p} />
export const TextArea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className={`${inputCls} min-h-20 resize-y`} {...p} />
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className={inputCls} {...p} />

export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface2 p-1">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${value === o.value ? 'bg-ink text-bg' : 'text-muted hover:text-ink'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
export const Chip = ({ active, onClick, children, color }: { active: boolean; onClick: () => void; children: ReactNode; color?: string }) => (
  <button onClick={onClick}
    className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active ? 'border-transparent bg-ink text-bg' : 'border-line bg-surface text-muted hover:text-ink'}`}
    style={active && color ? { background: color, color: '#fff' } : undefined}>
    {children}
  </button>
)

export const Empty = ({ title, hint, icon }: { title: string; hint?: string; icon?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line py-10 text-center">
    <span className="text-muted">{icon ?? <Inbox size={28} />}</span>
    <p className="text-sm font-semibold">{title}</p>
    {hint && <p className="max-w-60 text-xs text-muted">{hint}</p>}
  </div>
)
export const SectionTitle = ({ children }: { children: ReactNode }) => (
  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">{children}</h2>
)