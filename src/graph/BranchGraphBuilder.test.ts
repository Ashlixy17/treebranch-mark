import { describe, expect, it } from 'vitest'
import { CommitParser } from '../parser'
import type { CommitGraph } from '../parser'
import type { GitBranch, GitCommit, GitSourceSnapshot } from '../source'
import { BranchGraphBuilder } from './BranchGraphBuilder'

describe('BranchGraphBuilder', () => {
  it('computes reachable commits for a linear history', () => {
    const commitGraph = parseCommits([
      commitFixture('c3', ['c2']),
      commitFixture('c2', ['c1']),
      commitFixture('c1'),
    ])
    const branches = [branchFixture('main', 'c3', true)]
    const builder = new BranchGraphBuilder()

    const result = builder.build(commitGraph, branches)
    const main = result.graph.branches.get('main')

    expect(result.warnings).toEqual([])
    expect(main?.head.commit.sha).toBe('c3')
    expect(main?.reachableCommits).toEqual(new Set(['c3', 'c2', 'c1']))
  })

  it('computes reachable commits for multiple branches', () => {
    const commitGraph = parseCommits([
      commitFixture('main-head', ['shared']),
      commitFixture('feature-head', ['shared']),
      commitFixture('shared', ['root']),
      commitFixture('root'),
    ])
    const branches = [
      branchFixture('main', 'main-head', true),
      branchFixture('feature/login', 'feature-head'),
    ]
    const builder = new BranchGraphBuilder()

    const result = builder.build(commitGraph, branches)

    expect([...result.graph.branches.keys()]).toEqual(['main', 'feature/login'])
    expect(result.graph.branches.get('main')?.reachableCommits).toEqual(new Set([
      'main-head',
      'shared',
      'root',
    ]))
    expect(result.graph.branches.get('feature/login')?.reachableCommits).toEqual(new Set([
      'feature-head',
      'shared',
      'root',
    ]))
  })

  it('computes reachable commits through merge commits', () => {
    const commitGraph = parseCommits([
      commitFixture('merge', ['main-parent', 'feature-parent']),
      commitFixture('main-parent', ['root']),
      commitFixture('feature-parent', ['root']),
      commitFixture('root'),
    ])
    const branches = [branchFixture('main', 'merge', true)]
    const builder = new BranchGraphBuilder()

    const result = builder.build(commitGraph, branches)

    expect(result.graph.branches.get('main')?.reachableCommits).toEqual(new Set([
      'merge',
      'main-parent',
      'root',
      'feature-parent',
    ]))
  })

  it('warns about missing branch heads without throwing', () => {
    const commitGraph = parseCommits([commitFixture('root')])
    const branches = [branchFixture('missing-branch', 'missing-head')]
    const builder = new BranchGraphBuilder()

    const result = builder.build(commitGraph, branches)

    expect(result.graph.branches.size).toBe(0)
    expect(result.warnings).toEqual([
      {
        type: 'missing-branch-head',
        branchName: 'missing-branch',
        headSha: 'missing-head',
        message: 'Branch missing-branch points to missing head missing-head.',
      },
    ])
  })

  it('handles an empty repository', () => {
    const commitGraph = parseCommits([])
    const builder = new BranchGraphBuilder()

    const result = builder.build(commitGraph, [])

    expect(result.graph.branches.size).toBe(0)
    expect(result.warnings).toEqual([])
  })
})

function parseCommits(commits: GitCommit[]): CommitGraph {
  return new CommitParser().parse(snapshotFixture(commits)).graph
}

function snapshotFixture(commits: GitCommit[]): GitSourceSnapshot {
  return {
    source: 'github-api',
    repository: {
      id: 1,
      owner: 'octo',
      name: 'repo',
      fullName: 'octo/repo',
      defaultBranch: 'main',
      url: 'https://github.com/octo/repo',
      description: null,
      stars: 0,
    },
    branches: [],
    commits,
    contributors: [],
    pullRequests: [],
    fetchedAt: '2026-01-01T00:00:00Z',
  }
}

function commitFixture(sha: string, parents: string[] = []): GitCommit {
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
    authoredAt: '2026-01-01T00:00:00Z',
    committedAt: '2026-01-01T00:01:00Z',
    url: `https://github.com/octo/repo/commit/${sha}`,
  }
}

function branchFixture(name: string, headSha: string, isDefault = false): GitBranch {
  return {
    name,
    headSha,
    isDefault,
    url: `https://github.com/octo/repo/tree/${name}`,
  }
}
