import type { ForkTimelineLayoutResult } from '../layout'
import type {
  RenderEdge,
  RenderLabel,
  RenderModel,
  RenderNodeKind,
  RenderNodeStyleToken,
} from './types'

export class ForkTimelineRenderModelBuilder {
  build(layout: ForkTimelineLayoutResult): RenderModel {
    return {
      nodes: layout.nodes
        .filter((node) => node.kind !== null)
        .map((node) => {
          const kind = node.kind as RenderNodeKind
          const labels = node.labels.map<RenderLabel>((label) => ({ ...label }))
          return {
            id: node.id,
            x: node.x,
            y: node.y,
            label: labels[0]?.text ?? node.id.slice(-7),
            kind,
            styleToken: kind as RenderNodeStyleToken,
            avatarUrl: kind === 'commit' ? normalizeAvatarUrl(node.commit.author.avatarUrl) : null,
            color: node.color,
            labels,
          }
        }),
      edges: layout.edges.map<RenderEdge>((edge) => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        styleToken: `${edge.kind}-edge` as RenderEdge['styleToken'],
        color: edge.color,
        path: edge.path,
        inferred: edge.inferred,
      })),
      groups: layout.groups.map((group) => ({ ...group })),
      laneLabels: layout.laneLabels.map((label) => ({ ...label })),
    }
  }
}

function normalizeAvatarUrl(avatarUrl: string | null): string | null {
  const normalized = avatarUrl?.trim()
  return normalized ? normalized : null
}
