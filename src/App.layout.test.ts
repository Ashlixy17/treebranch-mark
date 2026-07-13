import appStyles from './App.css?raw'
// @ts-expect-error -- test-only Node fallback; production tsconfig intentionally omits Node types
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const cssText = appStyles || readFileSync(new URL('./App.css', import.meta.url), 'utf8')

describe('App control panel layout', () => {
  it('aligns settings in two columns and centers Generate below them', () => {
    expect(cssText).toMatch(
      /\.repo-form\s*{[^}]*grid-template-columns:\s*minmax\(280px, 1fr\) minmax\(120px, 180px\);/s,
    )
    expect(cssText).toMatch(/\.grouping-field\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s)
    expect(cssText).toMatch(/\.branch-field\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/s)
    expect(cssText).toMatch(
      /\.repo-form button\s*{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3;[^}]*justify-self:\s*center;/s,
    )
  })
})
