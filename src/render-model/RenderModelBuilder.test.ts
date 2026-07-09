import { describe, expect, it } from 'vitest'
import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'
import type { BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import type { GitBranch, GitCommit } from '../source'
import { RenderModelBuilder } from './RenderModelBuilder'

describe('RenderModelBuilder', () => {
  it('returns an empty render model for an empty layout', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = { nodes: [], edges: [] }
    const graph: BranchGraph = { branches: new Map() }

    expect(builder.build(layout, graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })

  it('maps layout nodes to commit render nodes', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'abcdef1234567890', x: 120, y: 100 }],
      edges: [],
    }
    const graph = graphFixture([commitNodeFixture('abcdef1234567890')])

    expect(builder.build(layout, graph).nodes).toEqual([
      {
        id: 'abcdef1234567890',
        x: 120,
        y: 100,
        label: 'abcdef1',
        kind: 'commit',
        styleToken: 'commit',
        avatarUrl: null,
      },
    ])
  })

  it('maps commit author avatars to render nodes', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'avatar1234567890', x: 120, y: 100 }],
      edges: [],
    }
    const graph = graphFixture([
      commitNodeFixture('avatar1234567890', 'https://avatars.githubusercontent.com/u/1'),
    ])

    expect(builder.build(layout, graph).nodes[0]?.avatarUrl).toBe(
      'https://avatars.githubusercontent.com/u/1',
    )
  })

  it('normalizes an empty commit author avatar to null', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'empty-avatar', x: 120, y: 100 }],
      edges: [],
    }
    const graph = graphFixture([commitNodeFixture('empty-avatar', '')])

    expect(builder.build(layout, graph).nodes[0]?.avatarUrl).toBeNull()
  })

  it('maps layout edges to commit-edge render edges', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [],
      edges: [{ from: 'parent', to: 'child' }],
    }
    const graph: BranchGraph = { branches: new Map() }

    expect(builder.build(layout, graph).edges).toEqual([
      {
        from: 'parent',
        to: 'child',
        styleToken: 'commit-edge',
      },
    ])
  })

  it('falls back to a short id label when a layout node is not in the branch graph', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'unknown123456', x: 0, y: 0 }],
      edges: [],
    }
    const graph: BranchGraph = { branches: new Map() }

    const renderNode = builder.build(layout, graph).nodes[0]

    expect(renderNode?.label).toBe('unknown')
    expect(renderNode?.avatarUrl).toBeNull()
  })

  it('returns JSON serializable plain data', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'abcdef1234567890', x: 120, y: 100 }],
      edges: [{ from: 'parent', to: 'abcdef1234567890' }],
    }
    const graph = graphFixture([commitNodeFixture('abcdef1234567890')])

    const renderModel = builder.build(layout, graph)

    expect(JSON.parse(JSON.stringify(renderModel))).toEqual(renderModel)
  })

  it('returns the same render model for the same layout and branch graph', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [
        { id: 'abcdef1234567890', x: 120, y: 100 },
        { id: '1234567890abcdef', x: 240, y: 100 },
      ],
      edges: [{ from: 'abcdef1234567890', to: '1234567890abcdef' }],
    }
    const graph = graphFixture([
      commitNodeFixture('abcdef1234567890'),
      commitNodeFixture('1234567890abcdef'),
    ])

    expect(builder.build(layout, graph)).toEqual(builder.build(layout, graph))
  })

  it('does not expose renderer-specific data on render nodes or edges', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = {
      nodes: [{ id: 'abcdef1234567890', x: 120, y: 100 }],
      edges: [{ from: 'parent', to: 'abcdef1234567890' }],
    }
    const graph = graphFixture([commitNodeFixture('abcdef1234567890')])

    const renderModel = builder.build(layout, graph)

    expect(Object.keys(renderModel.nodes[0] ?? {}).sort()).toEqual([
      'avatarUrl',
      'id',
      'kind',
      'label',
      'styleToken',
      'x',
      'y',
    ])
    expect(Object.keys(renderModel.edges[0] ?? {}).sort()).toEqual(['from', 'styleToken', 'to'])
  })

  it('does not mutate layout or branch graph inputs', () => {
    const builder = new RenderModelBuilder()
    const commit = commitNodeFixture('abcdef1234567890')
    const graph = graphFixture([commit])
    const layout: LayoutResult = {
      nodes: [{ id: commit.commit.sha, x: 120, y: 100 }],
      edges: [],
    }
    const beforeLayout = structuredClone(layout)
    const beforeGraph = snapshotBranchGraph(graph)

    builder.build(layout, graph)

    expect(layout).toEqual(beforeLayout)
    expect(snapshotBranchGraph(graph)).toEqual(beforeGraph)
  })
})

function graphFixture(commits: CommitNode[]): BranchGraph {
  return {
    branches: new Map(
      commits.map((commit, index) => [
        `branch-${index}`,
        branchNodeFixture(`branch-${index}`, commit, index === 0),
      ]),
    ),
  }
}

function branchNodeFixture(name: string, head: CommitNode, isDefault = false): BranchNode {
  return {
    branch: branchFixture(name, head.commit.sha, isDefault),
    head,
    reachableCommits: new Set([head.commit.sha]),
  }
}

function commitNodeFixture(sha: string, avatarUrl: string | null = null): CommitNode {
  return {
    commit: commitFixture(sha, avatarUrl),
    parents: [],
    children: [],
  }
}

function commitFixture(sha: string, avatarUrl: string | null): GitCommit {
  return {
    sha,
    parents: [],
    message: `commit ${sha}`,
    author: {
      name: 'Mona',
      email: 'mona@example.com',
      login: 'mona',
      avatarUrl,
      profileUrl: null,
    },
    committer: {
      name: 'Hubot',
      email: 'hubot@example.com',
      login: 'hubot',
      avatarUrl: null,
      profileUrl: null,
    },
    authoredAt: '2026-01-01T00:00:00Z',
    committedAt: '2026-01-01T00:01:00Z',
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
    commits: [...graph.branches.values()].map((branchNode) => ({
      sha: branchNode.head.commit.sha,
      parents: branchNode.head.parents.map((parent) => parent.commit.sha),
      children: branchNode.head.children.map((child) => child.commit.sha),
    })),
  }
}
