import { describe, expect, it } from 'vitest'
import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import type { GitBranch, GitCommit } from '../source'
import { COMMIT_COLUMN_GAP } from './types'
import { TimelineLayout } from './TimelineLayout'

describe('TimelineLayout', () => {
  it('uses equal x gaps and UTC month groups', () => {
    const januaryFirst = commitNodeFixture('january-first', [], '2026-01-01T00:00:00Z')
    const januaryLast = commitNodeFixture('january-last', [januaryFirst], '2026-01-31T23:59:59Z')
    const februaryFirst = commitNodeFixture('february-first', [januaryLast], '2026-02-01T00:00:00Z')
    const graph = graphFixture([branchNodeFixture('main', februaryFirst, true)])

    const result = new TimelineLayout({ grouping: 'month' }).layout(graph)

    expect(result.nodes.map((node) => node.x)).toEqual([0, COMMIT_COLUMN_GAP, COMMIT_COLUMN_GAP * 2])
    expect(result.groups).toEqual([
      { id: '2026-01', label: '2026-01', startX: 0, endX: COMMIT_COLUMN_GAP },
      { id: '2026-02', label: '2026-02', startX: COMMIT_COLUMN_GAP * 2, endX: COMMIT_COLUMN_GAP * 2 },
    ])
  })

  it('groups a timestamp at a UTC month boundary by its UTC month', () => {
    const januaryLast = commitNodeFixture('january-last', [], '2026-01-31T22:59:59-01:00')
    const februaryFirst = commitNodeFixture('february-first', [januaryLast], '2026-02-01T00:00:00Z')
    const boundaryGraph = graphFixture([branchNodeFixture('main', februaryFirst, true)])

    const result = new TimelineLayout({ grouping: 'month' }).layout(boundaryGraph)

    expect(result.groups.map((group) => group.label)).toEqual(['2026-01', '2026-02'])
  })

  it('returns Unknown date when both timestamps are invalid', () => {
    const invalid = commitNodeFixture('invalid', [], 'not-a-date', 'also-not-a-date')
    const graph = graphFixture([branchNodeFixture('main', invalid, true)])

    const result = new TimelineLayout({ grouping: 'day' }).layout(graph)

    expect(result.groups).toEqual([{ id: 'unknown-date', label: 'Unknown date', startX: 0, endX: 0 }])
  })

  it('uses a valid authoredAt timestamp when committedAt is invalid', () => {
    const january = commitNodeFixture('january', [], '2026-01-15T00:00:00Z')
    const february = commitNodeFixture('february', [january], 'not-a-date', '2026-02-15T00:00:00Z')
    const graph = graphFixture([branchNodeFixture('main', february, true)])

    const result = new TimelineLayout({ grouping: 'month' }).layout(graph)

    expect(result.nodes.map((node) => node.id)).toEqual(['january', 'february'])
    expect(result.groups.map((group) => group.label)).toEqual(['2026-01', '2026-02'])
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
