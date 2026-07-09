import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'
import type { CommitNode } from '../parser'
import type { RenderModel, RenderModelBuilder as RenderModelBuilderContract } from './types'

export class RenderModelBuilder implements RenderModelBuilderContract {
  build(layout: LayoutResult, graph: BranchGraph): RenderModel {
    const commitsBySha = collectCommits(graph)

    return {
      nodes: layout.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        label: node.id.slice(0, 7),
        kind: 'commit',
        styleToken: 'commit',
        avatarUrl: commitsBySha.get(node.id)?.commit.author.avatarUrl ?? null,
      })),
      edges: layout.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        styleToken: 'commit-edge',
      })),
    }
  }
}

function collectCommits(graph: BranchGraph) {
  const commitsBySha = new Map<string, CommitNode>()
  const stack = [...graph.branches.values()].map((branch) => branch.head)

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || commitsBySha.has(node.commit.sha)) {
      continue
    }

    commitsBySha.set(node.commit.sha, node)
    stack.push(...node.parents)
  }

  return commitsBySha
}
