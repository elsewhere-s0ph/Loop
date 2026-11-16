export const htmlToText = (html: string) => new DOMParser().parseFromString(html, 'text/html').body.textContent ?? ''
export const extractLinks = (text: string) => text.match(/https?:\/\/[^\s<>"']+/g) ?? []
export const formatBytes = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`
export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export function pickAudioMime(): string {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg']
  for (const c of candidates) if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c
  return ''
}

export function sanitizeHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const allowed = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'MARK', 'UL', 'OL', 'LI', 'A', 'BR', 'P', 'DIV', 'SPAN'])
  const kill = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'LINK', 'META'])
  const strip = (el: Element) => {
    for (const attr of Array.from(el.attributes)) {
      if (el.tagName === 'A' && attr.name === 'href') {
        if (!/^(https?:|mailto:)/i.test(attr.value)) el.removeAttribute('href')
      } else if (el.tagName === 'A' && (attr.name === 'target' || attr.name === 'rel')) {
        // keep
      } else el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer') }
  }
  const clean = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (kill.has(child.tagName)) { child.remove(); continue }
      if (!allowed.has(child.tagName)) {
        const frag = document.createDocumentFragment()
        while (child.firstChild) frag.appendChild(child.firstChild)
        el.replaceChild(frag, child)
      } else strip(child)
    }
    for (const child of Array.from(el.children)) clean(child)
  }
  clean(doc.body)
  return doc.body.innerHTML
}

export async function compressImage(file: File): Promise<{ blob: Blob; mime: string }> {
  let source: CanvasImageSource; let w: number; let h: number
  try {
    const bmp = await createImageBitmap(file)
    source = bmp; w = bmp.width; h = bmp.height
  } catch {
    const url = URL.createObjectURL(file)
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url
    })
    URL.revokeObjectURL(url)
    source = img; w = img.naturalWidth; h = img.naturalHeight
  }
  const scale = Math.min(1, 1600 / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * scale)); canvas.height = Math.max(1, Math.round(h * scale))
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const webp = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/webp', 0.75))
  if (webp) return { blob: webp, mime: 'image/webp' }
  const jpg = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.8))
  return { blob: jpg ?? file, mime: jpg ? 'image/jpeg' : file.type }
}