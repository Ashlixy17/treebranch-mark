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

export interface LayoutGroup {
  id: string
  label: string
  startX: number
  endX: number
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  groups: LayoutGroup[]
}

export interface Layout {
  layout(branchGraph: BranchGraph): LayoutResult
}

export type TimelineGrouping = 'year' | 'month' | 'day'

export interface TimelineLayoutOptions {
  grouping?: TimelineGrouping
}

export type TreeLayout = Layout
