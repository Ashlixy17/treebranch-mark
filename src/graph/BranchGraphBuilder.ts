import type { CommitGraph, CommitNode } from '../parser'
import type { GitBranch } from '../source'
import type {
  BranchGraph,
  BranchGraphBuilder as BranchGraphBuilderContract,
  BranchGraphBuilderResult,
} from './types'

export class BranchGraphBuilder implements BranchGraphBuilderContract {
  build(commitGraph: CommitGraph, branches: GitBranch[]): BranchGraphBuilderResult {
    const branchGraph: BranchGraph = {
      branches: new Map(),
    }
    const warnings: BranchGraphBuilderResult['warnings'] = []

    for (const branch of branches) {
      const head = commitGraph.nodes.get(branch.headSha)

      if (!head) {
        warnings.push({
          type: 'missing-branch-head',
          branchName: branch.name,
          headSha: branch.headSha,
          message: `Branch ${branch.name} points to missing head ${branch.headSha}.`,
        })
        continue
      }

      branchGraph.branches.set(branch.name, {
        branch,
        head,
        reachableCommits: collectReachableCommits(head),
      })
    }

    return {
      graph: branchGraph,
      warnings,
    }
  }
}

function collectReachableCommits(head: CommitNode): Set<string> {
  const reachableCommits = new Set<string>()
  const stack = [head]

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || reachableCommits.has(node.commit.sha)) {
      continue
    }

    reachableCommits.add(node.commit.sha)
    stack.push(...node.parents)
  }

  return reachableCommits
}
