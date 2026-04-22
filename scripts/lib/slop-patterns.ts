export type FindingKind = 'side-stripe' | 'gradient-text' | 'reflex-font'

export interface Finding {
  kind: FindingKind
  file: string
  line: number
  snippet: string
  note?: string
}

export const REFLEX_FONTS = [
  'Inter',
  'DM Sans',
  'DM Serif Display',
  'DM Serif Text',
  'Fraunces',
  'Newsreader',
  'Lora',
  'Crimson',
  'Crimson Pro',
  'Crimson Text',
  'Playfair Display',
  'Cormorant',
  'Cormorant Garamond',
  'Syne',
  'IBM Plex Mono',
  'IBM Plex Sans',
  'IBM Plex Serif',
  'Space Mono',
  'Space Grotesk',
  'Outfit',
  'Plus Jakarta Sans',
  'Instrument Sans',
  'Instrument Serif',
]

export const ALLOWED_FONTS = new Set(['Geist', 'Geist_Mono', 'Geist Mono', 'GeistMono'])

export const SCANNED_EXTENSIONS = new Set([
  '.tsx',
  '.ts',
  '.jsx',
  '.js',
  '.css',
  '.scss',
  '.mdx',
])

export function scanSideStripe(text: string, file: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  const sidePattern = /border-(left|right)\s*:\s*([^;}\n]+)/gi
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const re = new RegExp(sidePattern.source, sidePattern.flags)
    let match: RegExpExecArray | null
    while (true) {
      match = re.exec(line)
      if (match === null) break
      const value = (match[2] ?? '').trim()
      const widthMatch = value.match(/(\d+(?:\.\d+)?)\s*(px|rem|em)/i)
      if (!widthMatch) continue
      const raw = widthMatch[1]
      if (raw === undefined) continue
      const unit = (widthMatch[2] ?? 'px').toLowerCase()
      const width = Number.parseFloat(raw)
      const widthPx = unit === 'px' ? width : width * 16
      if (widthPx <= 1) continue
      if (/transparent|currentcolor|inherit|initial|unset|none/i.test(value)) continue
      findings.push({
        kind: 'side-stripe',
        file,
        line: i + 1,
        snippet: line.trim(),
        note: `border-${match[1]} ${widthPx}px — impeccable absolute ban`,
      })
    }
  }
  return findings
}

export function scanGradientText(text: string, file: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  const clipPattern = /(?:-webkit-)?background-clip\s*:\s*text/i
  const gradientPattern = /(linear|radial|conic)-gradient\s*\(/i
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    if (!clipPattern.test(line)) continue
    const windowStart = Math.max(0, i - 8)
    const windowEnd = Math.min(lines.length, i + 9)
    const nearby = lines.slice(windowStart, windowEnd).join('\n')
    if (!gradientPattern.test(nearby)) continue
    findings.push({
      kind: 'gradient-text',
      file,
      line: i + 1,
      snippet: line.trim(),
      note: 'background-clip:text + gradient — impeccable absolute ban',
    })
  }
  return findings
}

export function scanReflexFont(text: string, file: string): Finding[] {
  const findings: Finding[] = []
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? ''
    const isFontImport =
      /from\s+['"]next\/font\/google['"]/i.test(line) ||
      /@import\s+(url\()?['"][^'"]*fonts\.(googleapis|bunny)\.net/i.test(line) ||
      /family=[^&'"]+/i.test(line)
    const isFontDeclaration =
      /\b(font-family|fontFamily)\b\s*[:=]\s*['"]/i.test(line) ||
      /\bGeist\s*\(/.test(line)
    if (!isFontImport && !isFontDeclaration) continue
    for (const font of REFLEX_FONTS) {
      const escaped = font.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const fontRe = new RegExp(`\\b${escaped}\\b`, 'i')
      if (!fontRe.test(line)) continue
      let allowed = false
      for (const allow of ALLOWED_FONTS) {
        if (line.includes(allow)) {
          allowed = true
          break
        }
      }
      if (allowed) continue
      findings.push({
        kind: 'reflex-font',
        file,
        line: i + 1,
        snippet: line.trim(),
        note: `${font} is on impeccable's reflex-font reject list — pick something less common`,
      })
      break
    }
  }
  return findings
}

export function scanText(text: string, file: string): Finding[] {
  return [...scanSideStripe(text, file), ...scanGradientText(text, file), ...scanReflexFont(text, file)]
}

export function fileExtension(path: string): string {
  const idx = path.lastIndexOf('.')
  if (idx < 0) return ''
  return path.slice(idx).toLowerCase()
}
