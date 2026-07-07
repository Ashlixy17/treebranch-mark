import type { BranchGraph } from '../graph'

export const BRANCH_LANE_GAP = 100
export const COMMIT_COLUMN_GAP = 120

export interface LayoutNode {
  id: string
  x: number
  y: number
}

export interface LayoutEdge {
  from: string
  to: string
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

export interface TreeLayout {
  layout(branchGraph: BranchGraph): LayoutResult
}
