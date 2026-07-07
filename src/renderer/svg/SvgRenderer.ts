import type { RenderModel, RenderNode } from '../../render-model'
import { SvgBuilder } from './SvgBuilder'
import type { SvgRenderer as SvgRendererContract, SvgRendererOptions } from './types'

const DEFAULT_PADDING = 24
const DEFAULT_NODE_RADIUS = 6
const DEFAULT_EDGE_STROKE_WIDTH = 2
const DEFAULT_FONT_SIZE = 12
const LABEL_OFFSET = 20
const EMPTY_VIEW_BOX_SIZE = 48
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'

export class SvgRenderer implements SvgRendererContract {
  render(model: RenderModel, options: SvgRendererOptions = {}): string {
    const renderOptions = resolveOptions(options)
    const nodesById = new Map(model.nodes.map((node) => [node.id, node]))
    const svg = new SvgBuilder('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: getViewBox(model.nodes, renderOptions.padding),
      role: 'img',
      'aria-label': 'Git history graph',
    })

    for (const edge of model.edges) {
      const from = nodesById.get(edge.from)
      const to = nodesById.get(edge.to)

      if (!from || !to) {
        continue
      }

      svg.child('line', {
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
        stroke: 'currentColor',
        'stroke-width': renderOptions.edgeStrokeWidth,
        'stroke-linecap': 'round',
        opacity: '0.6',
      })
    }

    for (const node of model.nodes) {
      svg
        .child('circle', {
          cx: node.x,
          cy: node.y,
          r: renderOptions.nodeRadius,
          fill: 'currentColor',
        })
        .child(
          'text',
          {
            x: node.x,
            y: node.y + LABEL_OFFSET,
            'text-anchor': 'middle',
            'font-family': FONT_FAMILY,
            'font-size': renderOptions.fontSize,
            fill: 'currentColor',
          },
          node.label,
        )
    }

    return svg.build()
  }
}

function resolveOptions(options: SvgRendererOptions): Required<SvgRendererOptions> {
  return {
    padding: options.padding ?? DEFAULT_PADDING,
    nodeRadius: options.nodeRadius ?? DEFAULT_NODE_RADIUS,
    edgeStrokeWidth: options.edgeStrokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH,
    fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
  }
}

function getViewBox(nodes: RenderNode[], padding: number): string {
  if (nodes.length === 0) {
    return `0 0 ${EMPTY_VIEW_BOX_SIZE} ${EMPTY_VIEW_BOX_SIZE}`
  }

  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding

  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}
