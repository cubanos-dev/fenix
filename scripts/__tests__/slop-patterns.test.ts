import { describe, expect, test } from 'bun:test'
import { scanGradientText, scanReflexFont, scanSideStripe, scanText } from '../lib/slop-patterns.ts'

describe('scanSideStripe', () => {
  test('flags border-left wider than 1px', () => {
    const css = '.alert { border-left: 4px solid #f00; padding: 1rem; }'
    const findings = scanSideStripe(css, 'alert.css')
    expect(findings).toHaveLength(1)
    expect(findings[0]?.kind).toBe('side-stripe')
    expect(findings[0]?.line).toBe(1)
  })

  test('flags border-right with rem width above 1px-equivalent', () => {
    const css = '.callout { border-right: 0.25rem solid var(--accent); }'
    const findings = scanSideStripe(css, 'callout.css')
    expect(findings).toHaveLength(1)
  })

  test('ignores 1px or thinner hairlines', () => {
    const css = '.divider { border-left: 1px solid #e5e5e5; }'
    expect(scanSideStripe(css, 'divider.css')).toHaveLength(0)
  })

  test('ignores transparent placeholders', () => {
    const css = '.slot { border-left: 4px solid transparent; }'
    expect(scanSideStripe(css, 'slot.css')).toHaveLength(0)
  })

  test('ignores full border shorthand', () => {
    const css = '.box { border: 4px solid #000; }'
    expect(scanSideStripe(css, 'box.css')).toHaveLength(0)
  })
})

describe('scanGradientText', () => {
  test('flags gradient + background-clip:text within proximity', () => {
    const css = `.h1 {
      background: linear-gradient(90deg, #9333ea, #3b82f6);
      background-clip: text;
      color: transparent;
    }`
    const findings = scanGradientText(css, 'h1.css')
    expect(findings).toHaveLength(1)
    expect(findings[0]?.kind).toBe('gradient-text')
  })

  test('flags -webkit-background-clip:text variant', () => {
    const css = `.title {
      background-image: radial-gradient(circle, red, blue);
      -webkit-background-clip: text;
    }`
    expect(scanGradientText(css, 'title.css')).toHaveLength(1)
  })

  test('ignores background-clip:text without a nearby gradient', () => {
    const css = `.title {
      background: #000;
      background-clip: text;
    }`
    expect(scanGradientText(css, 'title.css')).toHaveLength(0)
  })
})

describe('scanReflexFont', () => {
  test('flags Inter via next/font/google import', () => {
    const tsx = "import { Inter } from 'next/font/google'"
    const findings = scanReflexFont(tsx, 'layout.tsx')
    expect(findings).toHaveLength(1)
    expect(findings[0]?.kind).toBe('reflex-font')
    expect(findings[0]?.note).toContain('Inter')
  })

  test('allows Geist alongside reflex fonts in same line', () => {
    const tsx = "import { Geist } from 'next/font/google'"
    expect(scanReflexFont(tsx, 'layout.tsx')).toHaveLength(0)
  })

  test('ignores font declaration lines that do not reference reject list', () => {
    const css = "body { font-family: 'Helvetica Neue', system-ui; }"
    expect(scanReflexFont(css, 'globals.css')).toHaveLength(0)
  })

  test('flags font-family declaration referencing a reject-list font', () => {
    const css = "body { font-family: 'Space Grotesk', sans-serif; }"
    const findings = scanReflexFont(css, 'globals.css')
    expect(findings).toHaveLength(1)
    expect(findings[0]?.note).toContain('Space Grotesk')
  })

  test('skips reject-list font when Geist is also on the line (allowlist escape)', () => {
    const tsx = "import { Geist, Inter } from 'next/font/google'"
    expect(scanReflexFont(tsx, 'layout.tsx')).toHaveLength(0)
  })
})

describe('scanText (aggregate)', () => {
  test('returns combined findings from all scanners', () => {
    const mixed = `import { Inter } from 'next/font/google'

.stripe { border-left: 4px solid red; }
.title {
  background: linear-gradient(90deg, red, blue);
  background-clip: text;
}
`
    const findings = scanText(mixed, 'mixed.tsx')
    const kinds = new Set(findings.map((f) => f.kind))
    expect(kinds.has('reflex-font')).toBe(true)
    expect(kinds.has('side-stripe')).toBe(true)
    expect(kinds.has('gradient-text')).toBe(true)
  })
})
