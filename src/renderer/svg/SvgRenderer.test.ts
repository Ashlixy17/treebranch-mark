import { describe, expect, it } from 'vitest'
import type { RenderModel } from '../../render-model'
import goldenSvg from './__fixtures__/mvp-golden.svg?raw'
import { SvgRenderer } from './SvgRenderer'

describe('SvgRenderer', () => {
  it('renders an empty render model as a standalone SVG document', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [],
      edges: [],
    }

    const svg = renderer.render(model)

    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('viewBox="0 0 48 48"')
    expect(svg).toContain('</svg>')
    expect(svg).not.toContain('<circle')
    expect(svg).not.toContain('<line')
    expect(svg).not.toContain('<text')
  })

  it('renders a single node as a circle and text label', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [
        {
          id: 'abcdef1234567890',
          x: 120,
          y: 80,
          label: 'abcdef1',
          kind: 'commit',
          styleToken: 'commit',
        },
      ],
      edges: [],
    }

    const svg = renderer.render(model)

    expect(svg).toContain('<circle cx="120" cy="80" r="6" fill="currentColor" />')
    expect(svg).toContain(
      '<text x="120" y="100" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" font-size="12" fill="currentColor">abcdef1</text>',
    )
  })

  it('renders a single edge as a line between node coordinates', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [
        nodeFixture('parent', 0, 0),
        nodeFixture('child', 120, 0),
      ],
      edges: [{ from: 'parent', to: 'child', styleToken: 'commit-edge' }],
    }

    const svg = renderer.render(model)

    expect(svg).toContain(
      '<line x1="0" y1="0" x2="120" y2="0" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6" />',
    )
  })

  it('renders multiple nodes and edges deterministically', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [
        nodeFixture('root', 0, 0, 'root'),
        nodeFixture('middle', 120, 0, 'middle'),
        nodeFixture('feature', 240, 100, 'feature'),
      ],
      edges: [
        { from: 'root', to: 'middle', styleToken: 'commit-edge' },
        { from: 'middle', to: 'feature', styleToken: 'commit-edge' },
      ],
    }

    expect(renderer.render(model)).toEqual(renderer.render(model))
    expect(renderer.render(model).match(/<circle/g)).toHaveLength(3)
    expect(renderer.render(model).match(/<line/g)).toHaveLength(2)
    expect(renderer.render(model).match(/<text/g)).toHaveLength(3)
  })

  it('produces basic valid SVG structure', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [nodeFixture('commit', 0, 0)],
      edges: [],
    }

    const svg = renderer.render(model)

    expect(svg.startsWith('<svg ')).toBe(true)
    expect(svg.endsWith('</svg>')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(svg).toContain('role="img"')
    expect(svg).toContain('aria-label="Git history graph"')
  })

  it('matches the MVP golden SVG output', () => {
    const renderer = new SvgRenderer()
    const model: RenderModel = {
      nodes: [
        nodeFixture('abcdef1234567890', 0, 0, 'abcdef1'),
        nodeFixture('1234567890abcdef', 120, 0, '1234567'),
      ],
      edges: [{ from: 'abcdef1234567890', to: '1234567890abcdef', styleToken: 'commit-edge' }],
    }

    expect(renderer.render(model)).toBe(normalizeSvg(goldenSvg))
  })
})

function nodeFixture(id: string, x: number, y: number, label = id) {
  return {
    id,
    x,
    y,
    label,
    kind: 'commit' as const,
    styleToken: 'commit' as const,
  }
}

function normalizeSvg(svg: string): string {
  return svg.trim().replaceAll('\r\n', '\n')
}
