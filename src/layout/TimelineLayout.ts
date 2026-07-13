import type { BranchGraph } from '../graph'
import type { CommitNode } from '../parser'
import { TreeLayout } from './TreeLayout'
import type { Layout, LayoutGroup, LayoutResult, TimelineGrouping, TimelineLayoutOptions } from './types'

export class TimelineLayout implements Layout {
  private readonly grouping: TimelineGrouping

  constructor(options: TimelineLayoutOptions = {}) {
    this.grouping = options.grouping ?? 'month'
  }

  layout(branchGraph: BranchGraph): LayoutResult {
    const treeLayout = new TreeLayout().layout(branchGraph)
    const commitNodes = collectCommitNodes(branchGraph)
    const nodes = [...treeLayout.nodes].sort((left, right) => left.x - right.x)

    return {
      ...treeLayout,
      nodes,
      groups: collectGroups(nodes, commitNodes, this.grouping),
    }
  }
}

function collectCommitNodes(branchGraph: BranchGraph): Map<string, CommitNode> {
  const nodes = new Map<string, CommitNode>()
  const stack = [...branchGraph.branches.values()].map((branch) => branch.head)

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || nodes.has(node.commit.sha)) {
      continue
    }

    nodes.set(node.commit.sha, node)
    stack.push(...node.parents)
  }

  return nodes
}

function collectGroups(
  nodes: LayoutResult['nodes'],
  commitNodes: Map<string, CommitNode>,
  grouping: TimelineGrouping,
): LayoutGroup[] {
  const groups = new Map<string, LayoutGroup>()

  for (const node of nodes) {
    const group = groupFor(commitNodes.get(node.id), grouping)
    const existing = groups.get(group.id)

    if (existing) {
      existing.endX = node.x
      continue
    }

    groups.set(group.id, {
      ...group,
      startX: node.x,
      endX: node.x,
    })
  }

  return [...groups.values()]
}

function groupFor(node: CommitNode | undefined, grouping: TimelineGrouping): Pick<LayoutGroup, 'id' | 'label'> {
  const date = commitDate(node)

  if (!date) {
    return { id: 'unknown-date', label: 'Unknown date' }
  }

  const year = String(date.getUTCFullYear()).padStart(4, '0')

  if (grouping === 'year') {
    return { id: year, label: year }
  }

  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const yearMonth = `${year}-${month}`

  if (grouping === 'month') {
    return { id: yearMonth, label: yearMonth }
  }

  const day = String(date.getUTCDate()).padStart(2, '0')
  const yearMonthDay = `${yearMonth}-${day}`

  return { id: yearMonthDay, label: yearMonthDay }
}

function commitDate(node: CommitNode | undefined): Date | null {
  if (!node) {
    return null
  }

  for (const timestamp of [node.commit.committedAt, node.commit.authoredAt]) {
    if (!timestamp) {
      continue
    }

    const date = new Date(timestamp)

    if (!Number.isNaN(date.getTime())) {
      return date
    }
  }

  return null
}
