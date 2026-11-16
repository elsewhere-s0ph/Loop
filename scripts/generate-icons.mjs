import sharp from 'sharp'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')
const publicDir = join(rootDir, 'public')

if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true })

const svgPath = join(publicDir, 'icon.svg')
if (!existsSync(svgPath)) {
  console.error('Errore: public/icon.svg non trovato')
  process.exit(1)
}

const svg = readFileSync(svgPath)
const out = (name) => join(publicDir, name)

await sharp(svg).resize(192, 192).png().toFile(out('pwa-192.png'))
await sharp(svg).resize(512, 512).png().toFile(out('pwa-512.png'))
await sharp(svg).resize(416, 416).extend({ top: 48, bottom: 48, left: 48, right: 48, background: '#0b0c0e' }).resize(512, 512).png().toFile(out('pwa-maskable-512.png'))
await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'))
await sharp(svg).resize(64, 64).png().toFile(out('favicon-64.png'))

console.log('✓ Icone generate in public/:')
console.log('  - pwa-192.png')
console.log('  - pwa-512.png')
console.log('  - pwa-maskable-512.png')
console.log('  - apple-touch-icon.png')
console.log('  - favicon-64.png')