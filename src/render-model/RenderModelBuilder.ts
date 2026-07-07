import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'
import type { RenderModel, RenderModelBuilder as RenderModelBuilderContract } from './types'

export class RenderModelBuilder implements RenderModelBuilderContract {
  build(layout: LayoutResult, _graph: BranchGraph): RenderModel {
    return {
      nodes: layout.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        label: node.id.slice(0, 7),
        kind: 'commit',
        styleToken: 'commit',
      })),
      edges: layout.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        styleToken: 'commit-edge',
      })),
    }
  }
}
