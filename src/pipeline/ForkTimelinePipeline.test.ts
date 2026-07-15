import { describe, expect, it } from 'vitest'
import type { GitSource, GitSourceInput, GitSourceSnapshot } from '../source'
import { ForkTimelinePipeline } from './ForkTimelinePipeline'
import type { ForkTimelineSettings } from './types'

describe('ForkTimelinePipeline', () => {
  it('renders a fork timeline and redraws a cached snapshot without loading the source', async () => {
    const source = new FakeSource(snapshotFixture())
    const pipeline = new ForkTimelinePipeline({ source })
    const settings = defaultSettings()

    const first = await pipeline.render({ owner: 'octo', repo: 'repo' }, settings)
    const redraw = pipeline.renderSnapshot(first.snapshot, {
      ...settings,
      mainNodeMode: 'release',
    })

    expect(source.loadCalls).toBe(1)
    expect(first.svg).toContain('stroke="#db2777"')
    expect(redraw.svg).not.toBe(first.svg)
    expect(redraw.warnings).toEqual([])
  })
})

function defaultSettings(): ForkTimelineSettings {
  return {
    grouping: 'month',
    mainNodeMode: 'commit',
    includeOpenPullRequests: false,
    pullRequestLimit: 20,
  }
}

class FakeSource implements GitSource {
  readonly kind = 'github-api' as const
  loadCalls = 0
  private readonly snapshot: GitSourceSnapshot

  constructor(snapshot: GitSourceSnapshot) {
    this.snapshot = snapshot
  }

  async loadRepository(_input: GitSourceInput): Promise<GitSourceSnapshot> {
    this.loadCalls += 1
    return this.snapshot
  }
}

function snapshotFixture(): GitSourceSnapshot {
  const commit = (sha: string, parents: string[], date: string) => ({
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
    authoredAt: date,
    committedAt: date,
    url: null,
  })
  const a = commit('a', [], '2026-01-01T00:00:00Z')
  const b = commit('b', ['a'], '2026-01-02T00:00:00Z')
  const p = commit('p', ['a'], '2026-01-01T12:00:00Z')

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
    branches: [{ name: 'main', headSha: 'b', isDefault: true, url: null }],
    commits: [a, b],
    contributors: [],
    pullRequests: [
      {
        number: 7,
        title: 'Feature',
        state: 'merged',
        url: 'https://github.com/octo/repo/pull/7',
        authorLogin: 'ada',
        authorAvatarUrl: 'https://avatars.githubusercontent.com/u/2',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        mergedAt: '2026-01-02T00:00:00Z',
        baseBranch: 'main',
        headBranch: 'feature',
        headRepositoryFullName: 'ada/repo',
        headSha: 'p',
        mergeCommitSha: 'b',
        commits: [p],
        loadState: 'complete',
        truncated: false,
      },
    ],
    releases: [],
    tags: [],
    warnings: [],
    pullRequestCapacity: { requested: 20, mergedLoaded: 1, openLoaded: 0 },
    fetchedAt: '2026-01-03T00:00:00Z',
  }
}
