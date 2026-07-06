import type { CommitGraph, CommitNode } from '../parser'
import type { GitBranch } from '../source'

export interface BranchNode {
  branch: GitBranch
  head: CommitNode
  reachableCommits: Set<string>
}

export interface BranchGraph {
  branches: Map<string, BranchNode>
}

export interface BranchGraphBuilderResult {
  graph: BranchGraph
  warnings: BranchGraphWarning[]
}

export type BranchGraphWarning = MissingBranchHeadWarning

export interface MissingBranchHeadWarning {
  type: 'missing-branch-head'
  branchName: string
  headSha: string
  message: string
}

export interface BranchGraphBuilder {
  build(commitGraph: CommitGraph, branches: GitBranch[]): BranchGraphBuilderResult
}
