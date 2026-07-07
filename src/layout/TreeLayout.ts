import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import {
  BRANCH_LANE_GAP,
  COMMIT_COLUMN_GAP,
  type LayoutResult,
  type TreeLayout as TreeLayoutContract,
} from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(branchGraph: BranchGraph): LayoutResult {
    const branches = sortBranches([...branchGraph.branches.values()])
    const discovered = collectCommitNodes(branches)
    const xBySha = assignXCoordinates(discovered.nodes, discovered.discoveryOrder)
    const yBySha = assignYCoordinates(branches, discovered.nodes)

    return {
      nodes: [...discovered.nodes.values()].map((node) => ({
        id: node.commit.sha,
        x: xBySha.get(node.commit.sha) ?? 0,
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

function collectCommitNodes(branches: BranchNode[]): {
  nodes: Map<string, CommitNode>
  discoveryOrder: Map<string, number>
} {
  const nodes = new Map<string, CommitNode>()
  const discoveryOrder = new Map<string, number>()
  let nextDiscoveryIndex = 0

  for (const branch of branches) {
    const stack = [branch.head]

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node || nodes.has(node.commit.sha)) {
        continue
      }

      nodes.set(node.commit.sha, node)
      discoveryOrder.set(node.commit.sha, nextDiscoveryIndex)
      nextDiscoveryIndex += 1
      stack.push(...node.parents)
    }
  }

  return { nodes, discoveryOrder }
}

function assignXCoordinates(
  nodes: Map<string, CommitNode>,
  discoveryOrder: Map<string, number>,
): Map<string, number> {
  const sorted = [...nodes.values()].sort((left, right) => {
    const leftTime = commitTimestamp(left)
    const rightTime = commitTimestamp(right)

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    const leftDiscovery = discoveryOrder.get(left.commit.sha) ?? 0
    const rightDiscovery = discoveryOrder.get(right.commit.sha) ?? 0

    if (leftDiscovery !== rightDiscovery) {
      return leftDiscovery - rightDiscovery
    }

    return left.commit.sha.localeCompare(right.commit.sha)
  })
  const xBySha = new Map<string, number>()

  sorted.forEach((node, index) => {
    xBySha.set(node.commit.sha, index * COMMIT_COLUMN_GAP)
  })

  return xBySha
}

function commitTimestamp(node: CommitNode): number {
  const timestamp = node.commit.committedAt ?? node.commit.authoredAt ?? ''
  return Date.parse(timestamp) || 0
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
