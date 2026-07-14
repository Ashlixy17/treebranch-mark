import type { BranchGraph } from '../graph'
import type {
  ForkTimelineLabel,
  ForkTimelineNodeKind,
} from '../graph'
import type { GitCommit } from '../source'

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
export type TimelineSpacing = 'equal' | 'time'

export interface TimelineLayoutOptions {
  grouping?: TimelineGrouping
  spacing?: TimelineSpacing
}

export interface ForkTimelineLayoutOptions {
  grouping?: TimelineGrouping
  spacing?: TimelineSpacing
}

export interface ForkTimelineLayoutNode extends LayoutNode {
  laneId: string
  laneIndex: number
  kind: ForkTimelineNodeKind | null
  commit: GitCommit
  labels: ForkTimelineLabel[]
  junction: boolean
  color: string
}

export interface ForkTimelineLayoutEdge {
  id: string
  from: string
  to: string
  kind: 'main' | 'branch' | 'fork' | 'merge'
  color: string
  inferred: boolean
  path: string | null
}

export interface ForkTimelineLaneLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  url: string
  badge: 'open' | null
}

export interface ForkTimelineLayoutResult {
  nodes: ForkTimelineLayoutNode[]
  edges: ForkTimelineLayoutEdge[]
  groups: LayoutGroup[]
  laneLabels: ForkTimelineLaneLabel[]
}

export type TreeLayout = Layout
