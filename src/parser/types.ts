import type { GitCommit, GitSourceSnapshot } from '../source'

export interface CommitNode {
  commit: GitCommit
  parents: CommitNode[]
  children: CommitNode[]
}

export interface CommitGraph {
  nodes: Map<string, CommitNode>
  roots: CommitNode[]
}

export interface ParserResult {
  graph: CommitGraph
  warnings: ParserWarning[]
}

export type ParserWarning = MissingParentWarning | DuplicateShaWarning

export interface MissingParentWarning {
  type: 'missing-parent'
  commitSha: string
  parentSha: string
  message: string
}

export interface DuplicateShaWarning {
  type: 'duplicate-sha'
  commitSha: string
  message: string
}

export interface CommitParser {
  parse(snapshot: GitSourceSnapshot): ParserResult
}
