import { useEffect, useState } from 'react'
export type Theme = 'dark' | 'light' | 'system'
export const getTheme = (): Theme => (localStorage.getItem('loop.theme') as Theme) || 'dark'
export const resolveTheme = (t: Theme) => t === 'system' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t
export const applyTheme = (t: Theme = getTheme()) => { document.documentElement.dataset.theme = resolveTheme(t) }
export const setTheme = (t: Theme) => { localStorage.setItem('loop.theme', t); applyTheme(t); window.dispatchEvent(new Event('loop-theme')) }
export function useTheme() {
  const [theme, setT] = useState<Theme>(getTheme())
  const [resolved, setR] = useState(resolveTheme(getTheme()))
  useEffect(() => {
    const h = () => { setT(getTheme()); setR(resolveTheme(getTheme())) }
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const mh = () => { if (getTheme() === 'system') { applyTheme(); h() } }
    window.addEventListener('loop-theme', h); mq.addEventListener('change', mh)
    return () => { window.removeEventListener('loop-theme', h); mq.removeEventListener('change', mh) }
  }, [])
  return { theme, resolved, set: setTheme }
}
export const readableOnLight = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 255) * 0.68), g = Math.round(((n >> 8) & 255) * 0.68), b = Math.round((n & 255) * 0.68)
  return `rgb(${r},${g},${b})`
}