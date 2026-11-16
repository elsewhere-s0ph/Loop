import { useEffect, useState } from 'react'
import {
  BarChart3, Baby, Bike, BookOpen, Briefcase, Building2, Bus, CalendarDays, Camera, Car,
  CheckCircle2, CheckSquare, Compass, CreditCard, Droplets, Dumbbell, FileText, Flag, Flame,
  Flower2, Gift, Globe, GraduationCap, Hammer, Heart, Home, Landmark, Leaf, Lightbulb,
  Map, Moon, Mountain, Music, Paintbrush, Pause, PiggyBank, Pill, Plane, Play, Puzzle,
  Rocket, Scissors, Ship, Shirt, ShoppingBag, Star, Stethoscope, Sun, Train, TreePine,
  TrendingUp, Trophy, Wallet, Wrench, Zap, type LucideIcon,
} from 'lucide-react'
import type { ItemType, LoopItem, LoopStatus } from '../db/schema'

export const C = {
  fact: '#3b82f6', action: '#f59e0b', meet: '#14b8a6', event: '#8b949e',
  outcome: '#22c55e', focus: '#a855f7', budget: '#eab308', danger: '#ef4444',
} as const

export const TYPE_META: Record<ItemType, { label: string; plural: string; icon: LucideIcon; color: string }> = {
  fact: { label: 'Fatto', plural: 'Fatti', icon: FileText, color: C.fact },
  action: { label: 'Azione', plural: 'Azioni', icon: CheckSquare, color: C.action },
  meet: { label: 'Incontro', plural: 'Incontri', icon: CalendarDays, color: C.meet },
  event: { label: 'Evento', plural: 'Eventi', icon: Flag, color: C.event },
}
export const STATUS_META: Record<LoopStatus, { label: string; icon: LucideIcon; color: string }> = {
  active: { label: 'Attivo', icon: Play, color: C.outcome },
  paused: { label: 'In pausa', icon: Pause, color: C.action },
  completed: { label: 'Concluso', icon: CheckCircle2, color: C.event },
}
export const AREA_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#14b8a6', '#ef4444', '#eab308', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316']
export const AREA_ICONS = ['Home', 'Building2', 'Briefcase', 'GraduationCap', 'BookOpen', 'FileText', 'Landmark', 'Wallet', 'CreditCard', 'PiggyBank', 'TrendingUp', 'BarChart3', 'Heart', 'Stethoscope', 'Pill', 'Baby', 'Dumbbell', 'Leaf', 'TreePine', 'Flower2', 'Sun', 'Moon', 'Star', 'Zap', 'Flame', 'Droplets', 'Mountain', 'Map', 'Compass', 'Globe', 'Plane', 'Car', 'Bike', 'Bus', 'Train', 'Ship', 'Rocket', 'Wrench', 'Hammer', 'Paintbrush', 'Scissors', 'Shirt', 'Gift', 'ShoppingBag', 'Camera']
const ICON_MAP: Record<string, LucideIcon> = { Home, Building2, Briefcase, GraduationCap, BookOpen, FileText, Landmark, Wallet, CreditCard, PiggyBank, TrendingUp, BarChart3, Heart, Stethoscope, Pill, Baby, Dumbbell, Leaf, TreePine, Flower2, Sun, Moon, Star, Zap, Flame, Droplets, Mountain, Map, Compass, Globe, Plane, Car, Bike, Bus, Train, Ship, Rocket, Wrench, Hammer, Paintbrush, Scissors, Shirt, Gift, ShoppingBag, Camera }
export const AreaIcon = ({ name, size = 16, color }: { name: string; size?: number; color?: string }) => {
  const I = ICON_MAP[name] ?? FileText
  return <I size={size} style={color ? { color } : undefined} />
}

export const fmtDate = (ts: number) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short' }).format(ts)
export const fmtTime = (ts: number) => new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(ts)
export const fmtDateTime = (ts: number) => `${fmtDate(ts)} · ${fmtTime(ts)}`
export const fmtMoney = (n: number, cur = 'EUR') => new Intl.NumberFormat('it-IT', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n)
export const startOfDay = (ts: number) => new Date(ts).setHours(0, 0, 0, 0)
export const relDay = (ts: number) => {
  const d = Math.round((startOfDay(ts) - startOfDay(Date.now())) / 86400000)
  if (d === 0) return 'Oggi'
  if (d === 1) return 'Domani'
  if (d === -1) return 'Ieri'
  return fmtDate(ts)
}
export const timeAgo = (ts: number) => {
  const d = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000)
  if (d <= 0) return 'oggi'
  if (d === 1) return 'ieri'
  if (d < 30) return `${d} giorni fa`
  return fmtDate(ts)
}
export const effDate = (i: LoopItem) => i.completedAt ?? i.scheduledAt ?? i.createdAt
export const toLocalInput = (ts: number) => { const d = new Date(ts); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }
export const fromLocalInput = (s: string) => new Date(s).getTime()
export const toDateInput = (ts: number) => toLocalInput(ts).slice(0, 10)
export const fromDateInput = (s: string) => new Date(s + 'T00:00:00').getTime()

export const prefs = {
  get name() { return localStorage.getItem('loop.name') ?? '' },
  set name(v: string) { localStorage.setItem('loop.name', v); window.dispatchEvent(new Event('loop-prefs')) },
}
export function usePrefs() {
  const [, force] = useState(0)
  useEffect(() => { const h = () => force(x => x + 1); window.addEventListener('loop-prefs', h); return () => window.removeEventListener('loop-prefs', h) }, [])
  return { name: prefs.name }
}