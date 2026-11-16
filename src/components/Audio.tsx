import { useEffect, useMemo, useRef, useState } from 'react'
import { Mic, Pause, Play, Square, X } from 'lucide-react'
import { formatDuration, pickAudioMime } from '../lib/media'
import { Btn, Modal } from './ui'

export function AudioRecorder({ open, onClose, onRecorded }: { open: boolean; onClose: () => void; onRecorded: (blob: Blob, duration: number, mime: string) => void }) {
  const [rec, setRec] = useState(false)
  const [secs, setSecs] = useState(0)
  const [error, setError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const ctxRef = useRef<AudioContext | null>(null)
  const rafRef = useRef(0)
  const timerRef = useRef(0)
  const secsRef = useRef(0)
  const mimeRef = useRef('audio/webm')

  const cleanup = () => {
    cancelAnimationFrame(rafRef.current)
    clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    analyserRef.current = null
    if (ctxRef.current) { void ctxRef.current.close().catch(() => {}); ctxRef.current = null }
  }
  useEffect(() => () => cleanup(), [])
  useEffect(() => { if (!open) { cleanup(); setRec(false); setSecs(0); secsRef.current = 0; setError('') } }, [open])

  const drawWave = () => {
    const an = analyserRef.current; const canvas = canvasRef.current
    if (!an || !canvas) return
    const ctx = canvas.getContext('2d')!
    const data = new Uint8Array(an.frequencyBinCount)
    an.getByteTimeDomainData(data)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#14b8a6'
    const bars = 48; const step = Math.floor(data.length / bars)
    for (let i = 0; i < bars; i++) {
      const v = Math.abs(data[i * step] - 128) / 128
      const h = Math.max(2, v * canvas.height)
      ctx.fillRect(i * (canvas.width / bars), (canvas.height - h) / 2, canvas.width / bars - 2, h)
    }
  }

  const start = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mime = pickAudioMime()
      mimeRef.current = mime || 'audio/webm'
      const media = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 })
      mediaRef.current = media
      chunksRef.current = []
      media.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data) }
      media.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeRef.current })
        const d = secsRef.current
        cleanup(); setRec(false)
        onRecorded(blob, d, mimeRef.current)
        onClose()
      }
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new AC()
      ctxRef.current = ctx
      const an = ctx.createAnalyser(); an.fftSize = 256
      ctx.createMediaStreamSource(stream).connect(an)
      analyserRef.current = an
      const loop = () => { drawWave(); rafRef.current = requestAnimationFrame(loop) }
      loop()
      media.start(250)
      setRec(true)
      secsRef.current = 0; setSecs(0)
      timerRef.current = window.setInterval(() => {
        secsRef.current += 1; setSecs(secsRef.current)
        if (secsRef.current >= 120) mediaRef.current?.stop()
      }, 1000)
    } catch {
      setError('Microfono non disponibile o permesso negato.')
    }
  }
  const cancel = () => {
    if (mediaRef.current) { mediaRef.current.onstop = null; if (rec) mediaRef.current.stop() }
    cleanup(); setRec(false); onClose()
  }

  return (
    <Modal open={open} onClose={cancel} title="Nota audio">
      <div className="space-y-4">
        <canvas ref={canvasRef} width={480} height={80} className="h-20 w-full rounded-xl bg-surface2" />
        <p className="text-center text-2xl font-bold tabular-nums">{formatDuration(secs)} <span className="text-sm text-muted">/ 2:00</span></p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-center gap-2">
          {!rec
            ? <Btn onClick={start}><span className="flex items-center gap-2"><Mic size={16} /> Registra</span></Btn>
            : <Btn variant="danger" onClick={() => mediaRef.current?.stop()}><span className="flex items-center gap-2"><Square size={16} /> Stop e salva</span></Btn>}
          <Btn variant="ghost" onClick={cancel}><span className="flex items-center gap-2"><X size={16} /> Annulla</span></Btn>
        </div>
        <p className="text-center text-xs text-muted">Il microfono viene rilasciato automaticamente al termine.</p>
      </div>
    </Modal>
  )
}

export function AudioPlayer({ blob, duration }: { blob: Blob; duration?: number }) {
  const url = useMemo(() => URL.createObjectURL(blob), [blob])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [t, setT] = useState(0)
  const [dur, setDur] = useState(duration ?? 0)
  const toggle = () => {
    const a = ref.current; if (!a) return
    if (playing) { a.pause(); setPlaying(false) } else { void a.play(); setPlaying(true) }
  }
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface2 px-3 py-2">
      <button onClick={toggle} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-meet text-bg">
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </button>
      <input type="range" min={0} max={dur || 0} step={0.1} value={t}
        onChange={e => { const v = parseFloat(e.target.value); if (ref.current) ref.current.currentTime = v; setT(v) }}
        className="min-w-0 flex-1 accent-[var(--color-meet)]" />
      <span className="shrink-0 text-xs tabular-nums text-muted">{formatDuration(t)} / {formatDuration(dur)}</span>
      <audio ref={ref} src={url} className="hidden"
        onTimeUpdate={e => setT(e.currentTarget.currentTime)}
        onLoadedMetadata={e => { const d = e.currentTarget.duration; setDur(isFinite(d) ? d : (duration ?? 0)) }}
        onEnded={() => { setPlaying(false); setT(0) }} />
    </div>
  )
}