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
      groups: [],
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

  it('falls back to authoredAt when committedAt is null', () => {
    const earlier = commitNodeFixture('earlier', [], '2026-01-01T00:01:00Z')
    const later = commitNodeFixture('later', [], null, '2026-01-01T00:02:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', earlier, true),
      branchNodeFixture('feature/login', later),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'earlier')?.x).toBe(0)
    expect(nodeById(result, 'later')?.x).toBe(COMMIT_COLUMN_GAP)
  })

  it('keeps the first sorted branch owning a shared head y lane', () => {
    const sharedHead = commitNodeFixture('shared-head', [], '2026-01-01T00:01:00Z')
    const graph = graphFixture([
      branchNodeFixture('beta', sharedHead),
      branchNodeFixture('alpha', sharedHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'shared-head')?.y).toBe(0)
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

  it('emits one edge for each parent of a merge commit', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const left = commitNodeFixture('left', [root], '2026-01-01T00:02:00Z')
    const right = commitNodeFixture('right', [root], '2026-01-01T00:03:00Z')
    const merge = commitNodeFixture('merge', [left, right], '2026-01-01T00:04:00Z')
    const graph = graphFixture([branchNodeFixture('main', merge, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.edges).toContainEqual({ from: 'left', to: 'merge' })
    expect(result.edges).toContainEqual({ from: 'right', to: 'merge' })
    expect(result.edges).toContainEqual({ from: 'root', to: 'left' })
    expect(result.edges).toContainEqual({ from: 'root', to: 'right' })
  })

  it('returns the same layout for the same input across repeated runs', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const featureHead = commitNodeFixture('feature-head', [root], '2026-01-01T00:02:00Z')
    const mainHead = commitNodeFixture('main-head', [featureHead], '2026-01-01T00:03:00Z')
    const graph = graphFixture([
      branchNodeFixture('feature/login', featureHead),
      branchNodeFixture('main', mainHead, true),
    ])
    const layout = new TreeLayout()

    expect(layout.layout(graph)).toEqual(layout.layout(graph))
  })

  it('keeps layout nodes and edges renderer-neutral', () => {
    const root = commitNodeFixture('root')
    const shared = commitNodeFixture('shared', [root], '2026-01-01T00:01:00Z')
    const mainHead = commitNodeFixture('main-head', [shared], '2026-01-01T00:02:00Z')
    const featureHead = commitNodeFixture('feature-head', [shared], '2026-01-01T00:03:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', mainHead, true),
      branchNodeFixture('feature/login', featureHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.edges.length).toBeGreaterThan(0)
    for (const node of result.nodes) {
      expect(Object.keys(node).sort()).toEqual(['id', 'x', 'y'])
    }
    for (const edge of result.edges) {
      expect(Object.keys(edge).sort()).toEqual(['from', 'to'])
    }
  })

  it('does not mutate the branch graph or commit nodes', () => {
    const root = commitNodeFixture('root')
    const shared = commitNodeFixture('shared', [root], '2026-01-01T00:01:00Z')
    const mainHead = commitNodeFixture('main-head', [shared], '2026-01-01T00:02:00Z')
    const featureHead = commitNodeFixture('feature-head', [shared], '2026-01-01T00:03:00Z')
    const mainBranch = branchNodeFixture('main', mainHead, true)
    const featureBranch = branchNodeFixture('feature/login', featureHead)
    const graph = graphFixture([mainBranch, featureBranch])
    const before = snapshotBranchGraph(graph)
    const layout = new TreeLayout()

    layout.layout(graph)

    expect(snapshotBranchGraph(graph)).toEqual(before)
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
  committedAt: string | null = '2026-01-01T00:00:00Z',
  authoredAt: string | null = committedAt,
): CommitNode {
  const node: CommitNode = {
    commit: commitFixture(sha, parents.map((parent) => parent.commit.sha), committedAt, authoredAt),
    parents,
    children: [],
  }

  for (const parent of parents) {
    parent.children.push(node)
  }

  return node
}

function commitFixture(
  sha: string,
  parents: string[],
  committedAt: string | null,
  authoredAt: string | null,
): GitCommit {
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
    authoredAt,
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

function snapshotBranchGraph(graph: BranchGraph) {
  return {
    branches: [...graph.branches.entries()].map(([name, branchNode]) => ({
      name,
      branch: { ...branchNode.branch },
      reachableCommits: [...branchNode.reachableCommits],
      headSha: branchNode.head.commit.sha,
    })),
    commits: snapshotCommitNodes(graph),
  }
}

function snapshotCommitNodes(graph: BranchGraph) {
  const nodes = collectCommitNodes(graph)

  return [...nodes.values()]
    .sort((left, right) => left.commit.sha.localeCompare(right.commit.sha))
    .map((node) => ({
      sha: node.commit.sha,
      commit: {
        ...node.commit,
        author: { ...node.commit.author },
        committer: { ...node.commit.committer },
        parents: [...node.commit.parents],
      },
      parents: node.parents.map((parent) => parent.commit.sha),
      children: node.children.map((child) => child.commit.sha),
    }))
}

function collectCommitNodes(graph: BranchGraph) {
  const nodes = new Map<string, CommitNode>()
  const stack = [...graph.branches.values()].map((branch) => branch.head)

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || nodes.has(node.commit.sha)) {
      continue
    }

    nodes.set(node.commit.sha, node)
    stack.push(...node.parents)
    stack.push(...node.children)
  }

  return nodes
}
