import { describe, expect, it } from 'vitest'
import type { GitCommit } from '../source'
import type { ForkTimelineGraph } from '../graph'
import { ForkTimelineLayout } from './ForkTimelineLayout'

describe('ForkTimelineLayout', () => {
  it('assigns one equal x gap across main and PR events', () => {
    const result = new ForkTimelineLayout({ grouping: 'day' }).layout(graphFixture())
    const positions = result.nodes.map((node) => [node.id, node.x])

    expect(positions).toEqual([
      ['main-a', 0],
      ['pr-7-p1', 120],
      ['pr-8-o1', 240],
      ['main-b', 360],
      ['pr-7-p2', 480],
    ])
    expect(result.groups).toEqual([
      { id: '2026-01-01', label: '2026-01-01', startX: 0, endX: 240 },
      { id: '2026-01-02', label: '2026-01-02', startX: 360, endX: 480 },
    ])
  })

  it('reuses non-overlapping completed lanes and keeps open lanes outermost', () => {
    const graph = graphFixture()
    graph.lanes[1] = {
      ...graph.lanes[1],
      commits: [commitFixture('o1', ['a'], '2026-01-01T06:00:00Z')],
    }
    const result = new ForkTimelineLayout().layout(graph)
    const labels = new Map(result.laneLabels.map((label) => [label.id, label]))

    expect(labels.get('pr-7')?.y).toBe(-122)
    expect(labels.get('pr-8')?.y).toBe(178)
    expect(labels.get('pr-8')?.badge).toBe('open')
  })

  it('marks inferred connector edges as dashed and uses deterministic PR colors', () => {
    const graph = graphFixture()
    graph.lanes[0].forkAnchor.inferred = true
    graph.lanes[0].mergeAnchor!.inferred = true
    const first = new ForkTimelineLayout().layout(graph)
    const second = new ForkTimelineLayout().layout(graph)

    expect(first.edges.filter((edge) => edge.kind === 'fork' || edge.kind === 'merge')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ inferred: true, path: expect.stringContaining('C') }),
      ]),
    )
    expect(first.nodes.filter((node) => node.laneId === 'pr-7').map((node) => node.color)).toEqual(
      second.nodes.filter((node) => node.laneId === 'pr-7').map((node) => node.color),
    )
  })
})

function graphFixture(): ForkTimelineGraph {
  const a = commitFixture('a', [], '2026-01-01T00:00:00Z')
  const b = commitFixture('b', ['a'], '2026-01-02T00:00:00Z')
  const p1 = commitFixture('p1', ['a'], '2026-01-01T03:00:00Z')
  const o1 = commitFixture('o1', ['a'], '2026-01-01T06:00:00Z')
  const p2 = commitFixture('p2', ['p1'], '2026-01-02T03:00:00Z')

  return {
    repositoryFullName: 'octo/repo',
    mainEvents: [
      { id: 'main-a', commit: a, visibleKind: 'commit', labels: [], junction: true },
      { id: 'main-b', commit: b, visibleKind: 'commit', labels: [], junction: true },
    ],
    lanes: [
      {
        id: 'pr-7',
        pullRequest: {
          number: 7,
          title: 'Merged',
          state: 'merged',
          url: 'https://github.com/octo/repo/pull/7',
          authorLogin: 'ada',
          authorAvatarUrl: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T04:00:00Z',
          mergedAt: '2026-01-02T04:00:00Z',
          baseBranch: 'main',
          headBranch: 'feature',
          headRepositoryFullName: 'ada/repo',
          headSha: 'p2',
          mergeCommitSha: 'b',
          commits: [p1, p2],
          loadState: 'complete',
          truncated: false,
        },
        commits: [p1, p2],
        forkAnchor: { commitSha: 'a', inferred: false },
        mergeAnchor: { commitSha: 'b', inferred: false },
      },
      {
        id: 'pr-8',
        pullRequest: {
          number: 8,
          title: 'Open',
          state: 'open',
          url: 'https://github.com/octo/repo/pull/8',
          authorLogin: 'lin',
          authorAvatarUrl: null,
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T06:00:00Z',
          mergedAt: null,
          baseBranch: 'main',
          headBranch: 'open',
          headRepositoryFullName: 'lin/repo',
          headSha: 'o1',
          mergeCommitSha: null,
          commits: [o1],
          loadState: 'complete',
          truncated: false,
        },
        commits: [o1],
        forkAnchor: { commitSha: 'a', inferred: false },
        mergeAnchor: null,
      },
    ],
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
      avatarUrl: null,
      profileUrl: null,
    },
    committer: {
      name: 'Ada',
      email: 'ada@example.com',
      login: 'ada',
      avatarUrl: null,
      profileUrl: null,
    },
    authoredAt: committedAt,
    committedAt,
    url: null,
  }
}
