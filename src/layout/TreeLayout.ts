import type { BranchGraph } from '../graph'
import { BRANCH_LANE_GAP, type LayoutNode, type LayoutResult, type TreeLayout as TreeLayoutContract } from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(branchGraph: BranchGraph): LayoutResult {
    const branches = [...branchGraph.branches.values()].sort((left, right) => {
      if (left.branch.isDefault !== right.branch.isDefault) {
        return left.branch.isDefault ? -1 : 1
      }

      return left.branch.name.localeCompare(right.branch.name)
    })
    const nodes: LayoutNode[] = []
    const seen = new Set<string>()

    branches.forEach((branch, branchIndex) => {
      if (seen.has(branch.head.commit.sha)) {
        return
      }

      seen.add(branch.head.commit.sha)
      nodes.push({
        id: branch.head.commit.sha,
        x: 0,
        y: branchIndex * BRANCH_LANE_GAP,
      })
    })

    return {
      nodes,
      edges: [],
    }
  }
}
