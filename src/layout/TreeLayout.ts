import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import { BRANCH_LANE_GAP, type LayoutResult, type TreeLayout as TreeLayoutContract } from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(branchGraph: BranchGraph): LayoutResult {
    const branches = sortBranches([...branchGraph.branches.values()])
    const nodes = collectCommitNodes(branches)
    const yBySha = assignYCoordinates(branches, nodes)

    return {
      nodes: [...nodes.values()].map((node) => ({
        id: node.commit.sha,
        x: 0,
        y: yBySha.get(node.commit.sha) ?? 0,
      })),
      edges: [],
    }
  }
}

function sortBranches(branches: BranchNode[]): BranchNode[] {
  return [...branches].sort((left, right) => {
    if (left.branch.isDefault !== right.branch.isDefault) {
      return left.branch.isDefault ? -1 : 1
    }

    if (left.branch.name < right.branch.name) {
      return -1
    }

    if (left.branch.name > right.branch.name) {
      return 1
    }

    return 0
  })
}

function collectCommitNodes(branches: BranchNode[]): Map<string, CommitNode> {
  const nodes = new Map<string, CommitNode>()

  for (const branch of branches) {
    const stack = [branch.head]

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node || nodes.has(node.commit.sha)) {
        continue
      }

      nodes.set(node.commit.sha, node)
      stack.push(...node.parents)
    }
  }

  return nodes
}

function assignYCoordinates(branches: BranchNode[], nodes: Map<string, CommitNode>): Map<string, number> {
  const yBySha = new Map<string, number>()

  branches.forEach((branch, branchIndex) => {
    const headSha = branch.head.commit.sha

    if (nodes.has(headSha) && !yBySha.has(headSha)) {
      yBySha.set(headSha, branchIndex * BRANCH_LANE_GAP)
    }
  })

  branches.forEach((branch, branchIndex) => {
    for (const sha of branch.reachableCommits) {
      if (nodes.has(sha) && !yBySha.has(sha)) {
        yBySha.set(sha, branchIndex * BRANCH_LANE_GAP)
      }
    }
  })

  return yBySha
}
