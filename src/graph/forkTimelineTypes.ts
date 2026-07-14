import type {
  GitCommit,
  GitPullRequest,
  GitSourceSnapshot,
} from '../source'

export type MainNodeMode = 'commit' | 'release' | 'tag'
export type ForkTimelineNodeKind = 'commit' | 'release' | 'tag' | 'junction'

export interface ForkTimelineOptions {
  mainNodeMode: MainNodeMode
  includeOpenPullRequests: boolean
  pullRequestLimit: number
}

export interface ForkTimelineLabel {
  text: string
  kind: 'release' | 'tag'
  url: string | null
  prerelease: boolean
  inferred: boolean
}

export interface ForkTimelineMainEvent {
  id: string
  commit: GitCommit
  visibleKind: ForkTimelineNodeKind | null
  labels: ForkTimelineLabel[]
  junction: boolean
}

export interface ForkTimelineAnchor {
  commitSha: string
  inferred: boolean
}

export interface ForkTimelineLane {
  id: string
  pullRequest: GitPullRequest
  commits: GitCommit[]
  forkAnchor: ForkTimelineAnchor
  mergeAnchor: ForkTimelineAnchor | null
}

export interface ForkTimelineGraph {
  repositoryFullName: string
  mainEvents: ForkTimelineMainEvent[]
  lanes: ForkTimelineLane[]
}

export interface ForkTimelineGraphWarning {
  type: 'inferred-fork' | 'inferred-merge'
  pullRequestNumber: number
  message: string
}

export interface ForkTimelineGraphBuilderResult {
  graph: ForkTimelineGraph
  warnings: ForkTimelineGraphWarning[]
}

export interface ForkTimelineGraphBuilderContract {
  build(snapshot: GitSourceSnapshot, options: ForkTimelineOptions): ForkTimelineGraphBuilderResult
}
