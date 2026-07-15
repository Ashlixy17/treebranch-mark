import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'

export type RenderNodeKind = 'commit' | 'release' | 'tag' | 'junction'
export type RenderNodeStyleToken = 'commit' | 'release' | 'tag' | 'junction'
export type RenderEdgeStyleToken = 'commit-edge' | 'main-edge' | 'branch-edge' | 'fork-edge' | 'merge-edge'

export interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
  groups: RenderGroup[]
  laneLabels?: RenderLaneLabel[]
}

export interface RenderGroup {
  id: string
  label: string
  startX: number
  endX: number
}

export interface RenderNode {
  id: string
  x: number
  y: number
  label: string
  kind: RenderNodeKind
  styleToken: RenderNodeStyleToken
  avatarUrl: string | null
  color?: string
  labels?: RenderLabel[]
}

export interface RenderEdge {
  id?: string
  from: string
  to: string
  styleToken: RenderEdgeStyleToken
  color?: string
  path?: string | null
  inferred?: boolean
}

export interface RenderLabel {
  text: string
  kind: 'release' | 'tag'
  url: string | null
  prerelease: boolean
  inferred: boolean
}

export interface RenderLaneLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  url: string
  badge: 'open' | null
}

export interface RenderModelBuilder {
  build(layout: LayoutResult, graph: BranchGraph): RenderModel
}
