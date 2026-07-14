import { describe, expect, it } from 'vitest'
import type { GitCommit } from '../source'
import type { ForkTimelineLayoutResult } from '../layout'
import { ForkTimelineRenderModelBuilder } from './ForkTimelineRenderModelBuilder'

describe('ForkTimelineRenderModelBuilder', () => {
  it('maps rich timeline nodes, colored edges, labels, and lane badges', () => {
    const model = new ForkTimelineRenderModelBuilder().build(layoutFixture())

    expect(model.nodes).toEqual([
      expect.objectContaining({
        id: 'main-a',
        kind: 'release',
        styleToken: 'release',
        labels: [expect.objectContaining({ text: 'v1.0.0', kind: 'release' })],
      }),
      expect.objectContaining({
        id: 'pr-7-p',
        kind: 'commit',
        avatarUrl: 'https://avatars.githubusercontent.com/u/2',
        color: '#db2777',
      }),
      expect.objectContaining({ id: 'main-b', kind: 'junction', styleToken: 'junction' }),
    ])
    expect(model.edges).toEqual([
      expect.objectContaining({
        id: 'pr-7-fork',
        styleToken: 'fork-edge',
        color: '#db2777',
        path: expect.stringContaining('C'),
        inferred: true,
      }),
    ])
    expect(model.laneLabels).toEqual([
      expect.objectContaining({ text: 'ada:feature · #7', badge: 'open' }),
    ])
  })
})

function layoutFixture(): ForkTimelineLayoutResult {
  const main = commitFixture('a')
  const pr = commitFixture('p')
  const merge = commitFixture('b')

  return {
    nodes: [
      {
        id: 'main-a',
        x: 0,
        y: 0,
        laneId: 'main',
        laneIndex: 0,
        kind: 'release',
        commit: main,
        labels: [{ text: 'v1.0.0', kind: 'release', url: null, prerelease: false, inferred: false }],
        junction: false,
        color: '#2563eb',
      },
      {
        id: 'pr-7-p',
        x: 120,
        y: -100,
        laneId: 'pr-7',
        laneIndex: -1,
        kind: 'commit',
        commit: pr,
        labels: [],
        junction: false,
        color: '#db2777',
      },
      {
        id: 'main-b',
        x: 240,
        y: 0,
        laneId: 'main',
        laneIndex: 0,
        kind: 'junction',
        commit: merge,
        labels: [],
        junction: true,
        color: '#2563eb',
      },
    ],
    edges: [
      {
        id: 'pr-7-fork',
        from: 'main-a',
        to: 'pr-7-p',
        kind: 'fork',
        color: '#db2777',
        inferred: true,
        path: 'M 0 0 C 60 0, 60 -100, 120 -100',
      },
    ],
    groups: [{ id: '2026-01', label: '2026-01', startX: 0, endX: 240 }],
    laneLabels: [
      {
        id: 'pr-7',
        x: 120,
        y: -122,
        text: 'ada:feature · #7',
        color: '#db2777',
        url: 'https://github.com/octo/repo/pull/7',
        badge: 'open',
      },
    ],
  }
}

function commitFixture(sha: string): GitCommit {
  return {
    sha,
    parents: [],
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
    authoredAt: '2026-01-01T00:00:00Z',
    committedAt: '2026-01-01T00:00:00Z',
    url: null,
  }
}
