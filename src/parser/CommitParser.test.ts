import { describe, expect, it } from 'vitest'
import { CommitParser } from './CommitParser'
import type { GitCommit, GitSourceSnapshot } from '../source'

describe('CommitParser', () => {
  it('parses an empty repository without throwing', () => {
    const snapshot = snapshotFixture([])
    const parser = new CommitParser()

    const result = parser.parse(snapshot)

    expect(result.graph.nodes.size).toBe(0)
    expect(result.graph.roots).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it('parses linear history into parent and child links', () => {
    const snapshot = snapshotFixture([
      commitFixture('c3', ['c2']),
      commitFixture('c2', ['c1']),
      commitFixture('c1'),
    ])
    const parser = new CommitParser()

    const result = parser.parse(snapshot)

    expect(result.warnings).toEqual([])
    expect([...result.graph.nodes.keys()]).toEqual(['c3', 'c2', 'c1'])
    expect(result.graph.roots.map((node) => node.commit.sha)).toEqual(['c1'])
    expect(result.graph.nodes.get('c3')?.parents.map((node) => node.commit.sha)).toEqual(['c2'])
    expect(result.graph.nodes.get('c2')?.children.map((node) => node.commit.sha)).toEqual(['c3'])
  })

  it('parses merge commits with multiple parents', () => {
    const snapshot = snapshotFixture([
      commitFixture('merge', ['main-parent', 'feature-parent']),
      commitFixture('main-parent'),
      commitFixture('feature-parent'),
    ])
    const parser = new CommitParser()

    const result = parser.parse(snapshot)
    const mergeCommit = result.graph.nodes.get('merge')

    expect(mergeCommit?.parents).toHaveLength(2)
    expect(mergeCommit?.parents.map((node) => node.commit.sha)).toEqual([
      'main-parent',
      'feature-parent',
    ])
    expect(result.graph.nodes.get('main-parent')?.children.map((node) => node.commit.sha)).toEqual([
      'merge',
    ])
    expect(result.graph.nodes.get('feature-parent')?.children.map((node) => node.commit.sha)).toEqual([
      'merge',
    ])
    expect(result.graph.roots.map((node) => node.commit.sha)).toEqual([
      'main-parent',
      'feature-parent',
    ])
  })

  it('warns about missing parents without throwing', () => {
    const snapshot = snapshotFixture([commitFixture('child', ['missing-parent'])])
    const parser = new CommitParser()

    const result = parser.parse(snapshot)

    expect(result.graph.nodes.get('child')?.parents).toEqual([])
    expect(result.graph.roots.map((node) => node.commit.sha)).toEqual(['child'])
    expect(result.warnings).toEqual([
      {
        type: 'missing-parent',
        commitSha: 'child',
        parentSha: 'missing-parent',
        message: 'Commit child references missing parent missing-parent.',
      },
    ])
  })

  it('warns about duplicate SHAs and keeps the first commit', () => {
    const first = commitFixture('same', [], 'first commit')
    const duplicate = commitFixture('same', [], 'duplicate commit')
    const snapshot = snapshotFixture([first, duplicate])
    const parser = new CommitParser()

    const result = parser.parse(snapshot)

    expect(result.graph.nodes.size).toBe(1)
    expect(result.graph.nodes.get('same')?.commit.message).toBe('first commit')
    expect(result.warnings).toEqual([
      {
        type: 'duplicate-sha',
        commitSha: 'same',
        message: 'Duplicate commit same was ignored.',
      },
    ])
  })

  it('does not mutate the source snapshot', () => {
    const snapshot = snapshotFixture([
      commitFixture('child', ['parent']),
      commitFixture('parent'),
    ])
    const snapshotJson = JSON.stringify(snapshot)
    const parser = new CommitParser()

    parser.parse(snapshot)

    expect(JSON.stringify(snapshot)).toBe(snapshotJson)
    expect(snapshot.commits[0].parents).toEqual(['parent'])
  })
})

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
    branches: [
      {
        name: 'main',
        headSha: commits[0]?.sha ?? '',
        isDefault: true,
        url: 'https://github.com/octo/repo/tree/main',
      },
    ],
    commits,
    contributors: [],
    pullRequests: [],
    fetchedAt: '2026-01-01T00:00:00Z',
  }
}

function commitFixture(sha: string, parents: string[] = [], message = `commit ${sha}`): GitCommit {
  return {
    sha,
    parents,
    message,
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
