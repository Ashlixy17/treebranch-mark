import { describe, expect, it } from 'vitest'
import type { GitCommit, GitSourceSnapshot } from '../source'
import { ForkTimelineGraphBuilder } from './ForkTimelineGraphBuilder'

describe('ForkTimelineGraphBuilder', () => {
  it('builds a merged external PR with exact fork and merge anchors', () => {
    const result = new ForkTimelineGraphBuilder().build(snapshotFixture(), {
      mainNodeMode: 'commit',
      includeOpenPullRequests: false,
      pullRequestLimit: 20,
    })

    expect(result.graph.mainEvents.map((event) => event.commit.sha)).toEqual(['a', 'b', 'c'])
    expect(result.graph.lanes).toHaveLength(1)
    expect(result.graph.lanes[0]).toMatchObject({
      id: 'pr-7',
      forkAnchor: { commitSha: 'a', inferred: false },
      mergeAnchor: { commitSha: 'c', inferred: false },
    })
    expect(result.graph.mainEvents.find((event) => event.id === 'main-b')).toMatchObject({
      visibleKind: 'release',
      labels: [expect.objectContaining({ text: 'v1.0.0', kind: 'release' })],
    })
  })

  it('includes open PR lanes only when requested and keeps Release/Tag visibility isolated', () => {
    const builder = new ForkTimelineGraphBuilder()
    const releaseMode = builder.build(snapshotFixture(), {
      mainNodeMode: 'release',
      includeOpenPullRequests: true,
      pullRequestLimit: 20,
    })
    const tagMode = builder.build(snapshotFixture(), {
      mainNodeMode: 'tag',
      includeOpenPullRequests: false,
      pullRequestLimit: 20,
    })

    expect(releaseMode.graph.lanes.map((lane) => lane.id)).toEqual(['pr-8', 'pr-7'])
    expect(releaseMode.graph.mainEvents.map((event) => [event.id, event.visibleKind])).toEqual([
      ['main-a', null],
      ['main-b', 'release'],
      ['main-c', null],
    ])
    expect(tagMode.graph.mainEvents.map((event) => [event.id, event.visibleKind])).toEqual([
      ['main-a', null],
      ['main-b', null],
      ['main-c', 'tag'],
    ])
  })

  it('uses nearest timestamps and marks inferred anchors when exact SHAs are unavailable', () => {
    const snapshot = snapshotFixture({
      commits: [commitFixture('a', [], '2026-01-01T00:00:00Z'), commitFixture('c', ['a'], '2026-01-03T00:00:00Z')],
      pullRequests: [
        pullRequestFixture({
          number: 12,
          commits: [commitFixture('p', ['missing-parent'], '2026-01-02T00:00:00Z')],
          mergeCommitSha: 'missing-merge',
          mergedAt: '2026-01-02T12:00:00Z',
        }),
      ],
    })

    const result = new ForkTimelineGraphBuilder().build(snapshot, {
      mainNodeMode: 'commit',
      includeOpenPullRequests: false,
      pullRequestLimit: 20,
    })

    expect(result.graph.lanes[0]).toMatchObject({
      forkAnchor: { commitSha: 'a', inferred: true },
      mergeAnchor: { commitSha: 'c', inferred: true },
    })
  })
})

function snapshotFixture(overrides: Partial<GitSourceSnapshot> = {}): GitSourceSnapshot {
  return {
    source: 'github-api',
    repository: {
      id: '1',
      owner: 'octo',
      name: 'repo',
      fullName: 'octo/repo',
      defaultBranch: 'main',
      url: 'https://github.com/octo/repo',
      description: null,
      stars: 1,
    },
    branches: [{ name: 'main', headSha: 'c', isDefault: true, url: null }],
    commits: [
      commitFixture('a', [], '2026-01-01T00:00:00Z'),
      commitFixture('b', ['a'], '2026-01-02T00:00:00Z'),
      commitFixture('c', ['b'], '2026-01-03T00:00:00Z'),
    ],
    contributors: [],
    pullRequests: [
      pullRequestFixture({
        number: 7,
        state: 'merged',
        commits: [
          commitFixture('p1', ['a'], '2026-01-01T12:00:00Z'),
          commitFixture('p2', ['p1'], '2026-01-02T12:00:00Z'),
        ],
        mergeCommitSha: 'c',
        mergedAt: '2026-01-03T00:00:00Z',
      }),
      pullRequestFixture({
        number: 8,
        state: 'open',
        commits: [commitFixture('o1', ['a'], '2026-01-02T06:00:00Z')],
        mergeCommitSha: null,
        mergedAt: null,
      }),
    ],
    releases: [
      {
        id: 1,
        tagName: 'v1.0.0',
        name: 'v1.0.0',
        url: 'https://github.com/octo/repo/releases/tag/v1.0.0',
        publishedAt: '2026-01-02T00:00:00Z',
        prerelease: false,
        targetSha: 'b',
        inferred: false,
      },
    ],
    tags: [
      { name: 'v2.0.0', commitSha: 'c', url: null },
    ],
    warnings: [],
    pullRequestCapacity: { requested: 20, mergedLoaded: 2, openLoaded: 1 },
    fetchedAt: '2026-01-04T00:00:00Z',
    ...overrides,
  }
}

function pullRequestFixture(overrides: Partial<GitSourceSnapshot['pullRequests'][number]> = {}) {
  return {
    number: 1,
    title: 'Feature',
    state: 'merged' as const,
    url: 'https://github.com/octo/repo/pull/1',
    authorLogin: 'ada',
    authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-03T00:00:00Z',
    mergedAt: '2026-01-03T00:00:00Z',
    baseBranch: 'main',
    headBranch: 'feature',
    headRepositoryFullName: 'ada/repo',
    headSha: 'head',
    mergeCommitSha: 'c',
    commits: [],
    loadState: 'complete' as const,
    truncated: false,
    ...overrides,
  }
}

function commitFixture(sha: string, parents: string[], committedAt: string): GitCommit {
  return {
    sha,
    parents,
    message: sha,
    author: {
      name: 'Ada',
      email: 'ada@example.com',
      login: 'ada',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2',
      profileUrl: 'https://github.com/ada',
    },
    committer: {
      name: 'Ada',
      email: 'ada@example.com',
      login: 'ada',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2',
      profileUrl: 'https://github.com/ada',
    },
    authoredAt: committedAt,
    committedAt,
    url: `https://github.com/octo/repo/commit/${sha}`,
  }
}
