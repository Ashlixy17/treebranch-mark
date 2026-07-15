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
    expect(cssText).toMatch(/\.branch-field\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/s)
    expect(cssText).toMatch(
      /\.repo-form button\s*{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3;[^}]*justify-self:\s*center;/s,
    )
    expect(cssText).toMatch(/\.graph-settings-grid\s*{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\);/s)
  })

  it('keeps the interactive SVG transform inside a draggable viewport', () => {
    expect(cssText).toMatch(
      /\.svg-preview\s*{[^}]*overflow:\s*hidden;[^}]*position:\s*relative;[^}]*cursor:\s*grab;[^}]*touch-action:\s*none;/s,
    )
    expect(cssText).toMatch(/\.svg-preview\.is-dragging\s*{[^}]*cursor:\s*grabbing;/s)
    expect(cssText).toMatch(
      /\.svg-preview-content\s*{[^}]*width:\s*100%;[^}]*transform-origin:\s*0 0;/s,
    )
    expect(cssText).toMatch(
      /\.svg-preview\.is-wheel-zooming \.svg-preview-content\s*{[^}]*transition:\s*transform 140ms ease-out;/s,
    )
    expect(cssText).toMatch(/\.svg-panel \.panel-heading\s*{[^}]*flex-wrap:\s*wrap;/s)
  })

  it('gives the SVG preview a larger responsive height', () => {
    expect(cssText).toMatch(
      /\.svg-preview,\s*\.svg-empty\s*{[^}]*height:\s*clamp\(420px, 62vh, 720px\);/s,
    )
    expect(cssText).toMatch(
      /@media \(max-width: 560px\)[\s\S]*?\.svg-preview,\s*\.svg-empty\s*{[^}]*height:\s*clamp\(320px, 55vh, 480px\);/s,
    )
  })
})
