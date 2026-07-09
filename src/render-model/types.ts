import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'

export type RenderNodeKind = 'commit'
export type RenderNodeStyleToken = 'commit'
export type RenderEdgeStyleToken = 'commit-edge'

export interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
}

export interface RenderNode {
  id: string
  x: number
  y: number
  label: string
  kind: RenderNodeKind
  styleToken: RenderNodeStyleToken
  avatarUrl: string | null
}

export interface RenderEdge {
  from: string
  to: string
  styleToken: RenderEdgeStyleToken
}

export interface RenderModelBuilder {
  build(layout: LayoutResult, graph: BranchGraph): RenderModel
}
