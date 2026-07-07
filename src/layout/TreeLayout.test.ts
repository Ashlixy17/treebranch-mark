import { describe, expect, it } from 'vitest'
import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import type { GitBranch, GitCommit } from '../source'
import { BRANCH_LANE_GAP, COMMIT_COLUMN_GAP } from './types'
import { TreeLayout } from './TreeLayout'

describe('TreeLayout', () => {
  it('returns an empty layout for an empty branch graph', () => {
    const layout = new TreeLayout()
    const graph: BranchGraph = {
      branches: new Map(),
    }

    expect(layout.layout(graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })

  it('sorts the default branch first and assigns deterministic branch lanes', () => {
    const main = commitNodeFixture('main-head', [], '2026-01-01T00:03:00Z')
    const feature = commitNodeFixture('feature-head', [], '2026-01-01T00:02:00Z')
    const hotfix = commitNodeFixture('hotfix-head', [], '2026-01-01T00:01:00Z')
    const graph = graphFixture([
      branchNodeFixture('hotfix', hotfix),
      branchNodeFixture('main', main, true),
      branchNodeFixture('feature/login', feature),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.y).toBe(0)
    expect(nodeById(result, 'feature-head')?.y).toBe(BRANCH_LANE_GAP)
    expect(nodeById(result, 'hotfix-head')?.y).toBe(BRANCH_LANE_GAP * 2)
  })

  it('keeps later branch heads on their own lanes even when earlier branches reach them', () => {
    const shared = commitNodeFixture('shared', [], '2026-01-01T00:00:00Z')
    const feature = commitNodeFixture('feature-head', [shared], '2026-01-01T00:01:00Z')
    const main = commitNodeFixture('main-head', [feature], '2026-01-01T00:02:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', main, true),
      branchNodeFixture('feature/login', feature),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.y).toBe(0)
    expect(nodeById(result, 'feature-head')?.y).toBe(BRANCH_LANE_GAP)
    expect(nodeById(result, 'shared')?.y).toBe(0)
  })

  it('assigns increasing x coordinates by commit time', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const middle = commitNodeFixture('middle', [root], '2026-01-01T00:02:00Z')
    const head = commitNodeFixture('head', [middle], '2026-01-01T00:03:00Z')
    const graph = graphFixture([branchNodeFixture('main', head, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'root')?.x).toBe(0)
    expect(nodeById(result, 'middle')?.x).toBe(COMMIT_COLUMN_GAP)
    expect(nodeById(result, 'head')?.x).toBe(COMMIT_COLUMN_GAP * 2)
  })

  it('uses stable discovery order when commits have the same timestamp', () => {
    const main = commitNodeFixture('main-head', [], '2026-01-01T00:01:00Z')
    const feature = commitNodeFixture('feature-head', [], '2026-01-01T00:01:00Z')
    const graph = graphFixture([
      branchNodeFixture('feature/login', feature),
      branchNodeFixture('main', main, true),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.x).toBe(0)
    expect(nodeById(result, 'feature-head')?.x).toBe(COMMIT_COLUMN_GAP)
  })

  it('emits edges from parent commits to child commits', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const child = commitNodeFixture('child', [root], '2026-01-01T00:02:00Z')
    const graph = graphFixture([branchNodeFixture('main', child, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.edges).toEqual([
      {
        from: 'root',
        to: 'child',
      },
    ])
  })

  it('deduplicates edges reached through multiple branches', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const shared = commitNodeFixture('shared', [root], '2026-01-01T00:02:00Z')
    const mainHead = commitNodeFixture('main-head', [shared], '2026-01-01T00:03:00Z')
    const featureHead = commitNodeFixture('feature-head', [shared], '2026-01-01T00:04:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', mainHead, true),
      branchNodeFixture('feature/login', featureHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.edges).toEqual([
      { from: 'shared', to: 'main-head' },
      { from: 'root', to: 'shared' },
      { from: 'shared', to: 'feature-head' },
    ])
  })

  it('keeps layout nodes and edges renderer-neutral', () => {
    const root = commitNodeFixture('root')
    const child = commitNodeFixture('child', [root])
    const graph = graphFixture([branchNodeFixture('main', child, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(Object.keys(result.nodes[0]).sort()).toEqual(['id', 'x', 'y'])
    expect(Object.keys(result.edges[0]).sort()).toEqual(['from', 'to'])
  })

  it('does not mutate the branch graph or commit nodes', () => {
    const root = commitNodeFixture('root')
    const child = commitNodeFixture('child', [root])
    const branch = branchNodeFixture('main', child, true)
    const graph = graphFixture([branch])
    const before = {
      branchCount: graph.branches.size,
      reachable: [...branch.reachableCommits],
      childParentCount: child.parents.length,
      rootChildCount: root.children.length,
    }
    const layout = new TreeLayout()

    layout.layout(graph)

    expect(graph.branches.size).toBe(before.branchCount)
    expect([...branch.reachableCommits]).toEqual(before.reachable)
    expect(child.parents.length).toBe(before.childParentCount)
    expect(root.children.length).toBe(before.rootChildCount)
  })

  it('places branch head commits on their own branch lanes before shared ancestors', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const featureHead = commitNodeFixture('feature-head', [root], '2026-01-01T00:02:00Z')
    const mainHead = commitNodeFixture('main-head', [featureHead], '2026-01-01T00:03:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', mainHead, true),
      branchNodeFixture('feature/login', featureHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.y).toBe(0)
    expect(nodeById(result, 'feature-head')?.y).toBe(BRANCH_LANE_GAP)
    expect(nodeById(result, 'root')?.y).toBe(0)
  })
})

function graphFixture(branches: BranchNode[]): BranchGraph {
  return {
    branches: new Map(branches.map((branch) => [branch.branch.name, branch])),
  }
}

function branchNodeFixture(name: string, head: CommitNode, isDefault = false): BranchNode {
  return {
    branch: branchFixture(name, head.commit.sha, isDefault),
    head,
    reachableCommits: collectReachable(head),
  }
}

function collectReachable(head: CommitNode): Set<string> {
  const reachable = new Set<string>()
  const stack = [head]

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || reachable.has(node.commit.sha)) {
      continue
    }

    reachable.add(node.commit.sha)
    stack.push(...node.parents)
  }

  return reachable
}

function nodeById(result: { nodes: { id: string; x: number; y: number }[] }, id: string) {
  return result.nodes.find((node) => node.id === id)
}

function commitNodeFixture(
  sha: string,
  parents: CommitNode[] = [],
  committedAt = '2026-01-01T00:00:00Z',
): CommitNode {
  const node: CommitNode = {
    commit: commitFixture(sha, parents.map((parent) => parent.commit.sha), committedAt),
    parents,
    children: [],
  }

  for (const parent of parents) {
    parent.children.push(node)
  }

  return node
}

function commitFixture(sha: string, parents: string[], committedAt: string): GitCommit {
  return {
    sha,
    parents,
    message: `commit ${sha}`,
    author: {
      name: 'Mona',
      email: 'mona@example.com',
      login: 'mona',
      avatarUrl: null,
      profileUrl: null,
    },
    committer: {
      name: 'Hubot',
      email: 'hubot@example.com',
      login: 'hubot',
      avatarUrl: null,
      profileUrl: null,
    },
    authoredAt: committedAt,
    committedAt,
    url: `https://github.com/octo/repo/commit/${sha}`,
  }
}

function branchFixture(name: string, headSha: string, isDefault: boolean): GitBranch {
  return {
    name,
    headSha,
    isDefault,
    url: `https://github.com/octo/repo/tree/${name}`,
  }
}
