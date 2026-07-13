import type { RenderGroup, RenderModel, RenderNode } from '../../render-model'
import { SvgBuilder } from './SvgBuilder'
import type { SvgRenderer as SvgRendererContract, SvgRendererOptions } from './types'

const DEFAULT_PADDING = 36
const DEFAULT_NODE_RADIUS = 6
const DEFAULT_EDGE_STROKE_WIDTH = 2
const DEFAULT_FONT_SIZE = 12
const LABEL_OFFSET = 20
const EMPTY_VIEW_BOX_SIZE = 48
const AVATAR_SIZE = 32
const AVATAR_OFFSET = AVATAR_SIZE / 2
const AVATAR_RING_RADIUS = 18
const AVATAR_RING_STROKE_WIDTH = 3
const AVATAR_LABEL_OFFSET = 32
const AVATAR_CLIP_ID = 'commit-avatar-clip'
const FONT_FAMILY = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const GROUP_HEADER_OFFSET = DEFAULT_PADDING

export class SvgRenderer implements SvgRendererContract {
  render(model: RenderModel, options: SvgRendererOptions = {}): string {
    const renderOptions = resolveOptions(options)
    const nodesById = new Map(model.nodes.map((node) => [node.id, node]))
    const svg = new SvgBuilder('svg', {
      xmlns: 'http://www.w3.org/2000/svg',
      viewBox: getViewBox(model.nodes, model.groups, renderOptions.padding, renderOptions.fontSize),
      role: 'img',
      'aria-label': 'Git history graph',
    })

    if (model.nodes.some((node) => getAvatarUrl(node) !== null)) {
      const clipPath = new SvgBuilder('clipPath', {
        id: AVATAR_CLIP_ID,
        clipPathUnits: 'objectBoundingBox',
      }).child('circle', {
        cx: 0.5,
        cy: 0.5,
        r: 0.5,
      })

      svg.childElement(new SvgBuilder('defs').childElement(clipPath))
    }

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

    renderGroups(svg, model.nodes, model.groups, renderOptions)

    for (const node of model.nodes) {
      const avatarUrl = getAvatarUrl(node)

      if (avatarUrl) {
        svg.child('circle', {
          cx: node.x,
          cy: node.y,
          r: AVATAR_RING_RADIUS,
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': AVATAR_RING_STROKE_WIDTH,
        })
        svg.child('image', {
          href: avatarUrl,
          x: node.x - AVATAR_OFFSET,
          y: node.y - AVATAR_OFFSET,
          width: AVATAR_SIZE,
          height: AVATAR_SIZE,
          'clip-path': `url(#${AVATAR_CLIP_ID})`,
          preserveAspectRatio: 'xMidYMid slice',
        })
      } else {
        svg.child('circle', {
          cx: node.x,
          cy: node.y,
          r: renderOptions.nodeRadius,
          fill: 'currentColor',
        })
      }

      svg.child(
        'text',
        {
          x: node.x,
          y: node.y + (avatarUrl ? AVATAR_LABEL_OFFSET : LABEL_OFFSET),
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

function getAvatarUrl(node: RenderNode): string | null {
  if (node.kind !== 'commit') {
    return null
  }

  const avatarUrl = node.avatarUrl?.trim()
  return avatarUrl ? avatarUrl : null
}

function resolveOptions(options: SvgRendererOptions): Required<SvgRendererOptions> {
  return {
    padding: options.padding ?? DEFAULT_PADDING,
    nodeRadius: options.nodeRadius ?? DEFAULT_NODE_RADIUS,
    edgeStrokeWidth: options.edgeStrokeWidth ?? DEFAULT_EDGE_STROKE_WIDTH,
    fontSize: options.fontSize ?? DEFAULT_FONT_SIZE,
  }
}

function renderGroups(
  svg: SvgBuilder,
  nodes: RenderNode[],
  groups: RenderGroup[],
  renderOptions: Required<SvgRendererOptions>,
): void {
  if (groups.length === 0) {
    return
  }

  const headerY = getGroupHeaderY(nodes)
  const separatorStartY = headerY + renderOptions.fontSize
  const separatorEndY = getGroupSeparatorEndY(nodes, separatorStartY)

  groups.forEach((group, index) => {
    if (index > 0) {
      const previousGroup = groups[index - 1]
      const separatorX = (previousGroup.endX + group.startX) / 2

      svg.child('line', {
        x1: separatorX,
        y1: separatorStartY,
        x2: separatorX,
        y2: separatorEndY,
        stroke: 'currentColor',
        'stroke-width': renderOptions.edgeStrokeWidth,
        opacity: '0.3',
      })
    }

    svg.child(
      'text',
      {
        x: group.startX,
        y: headerY,
        'font-family': FONT_FAMILY,
        'font-size': renderOptions.fontSize,
        fill: 'currentColor',
      },
      group.label,
    )
  })
}

function getViewBox(
  nodes: RenderNode[],
  groups: RenderGroup[],
  padding: number,
  fontSize: number,
): string {
  if (nodes.length === 0 && groups.length === 0) {
    return `0 0 ${EMPTY_VIEW_BOX_SIZE} ${EMPTY_VIEW_BOX_SIZE}`
  }

  const headerY = getGroupHeaderY(nodes)
  const separatorStartY = headerY + fontSize
  const separatorEndY = getGroupSeparatorEndY(nodes, separatorStartY)
  const separatorXs = groups.slice(1).map((group, index) => (groups[index].endX + group.startX) / 2)
  const xs = [
    ...nodes.map((node) => node.x),
    ...groups.flatMap((group) => [group.startX, group.endX]),
    ...groups.map((group) => group.startX + group.label.length * fontSize),
    ...separatorXs,
  ]
  const ys = [
    ...nodes.map((node) => node.y),
    ...(groups.length > 0 ? [headerY - fontSize, separatorEndY] : []),
  ]
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const maxX = Math.max(...xs) + padding
  const maxY = Math.max(...ys) + padding

  return `${minX} ${minY} ${maxX - minX} ${maxY - minY}`
}

function getGroupHeaderY(nodes: RenderNode[]): number {
  return (nodes.length > 0 ? Math.min(...nodes.map((node) => node.y)) : 0) - GROUP_HEADER_OFFSET
}

function getGroupSeparatorEndY(nodes: RenderNode[], separatorStartY: number): number {
  return nodes.length > 0 ? Math.max(...nodes.map((node) => node.y)) : separatorStartY
}
