import { describe, expect, it } from 'vitest'
import type { GitHubPullRequestResponse } from './githubRestClient'
import { selectEligiblePullRequests } from './pullRequestSelection'

describe('selectEligiblePullRequests', () => {
  it('keeps external fork PRs targeting the selected branch and overlapping the timeline', () => {
    const selected = selectEligiblePullRequests(
      [
        pullRequestFixture({ number: 12, updatedAt: '2026-01-20T00:00:00Z', mergedAt: '2026-01-20T00:00:00Z' }),
        pullRequestFixture({ number: 7, state: 'open', updatedAt: '2026-01-19T00:00:00Z', mergedAt: null }),
        pullRequestFixture({ number: 9, baseBranch: 'dev' }),
        pullRequestFixture({ number: 10, headRepositoryFullName: 'octo/repo' }),
        pullRequestFixture({ number: 11, fork: false }),
        pullRequestFixture({
          number: 13,
          createdAt: '2025-12-01T00:00:00Z',
          updatedAt: '2025-12-02T00:00:00Z',
          mergedAt: '2025-12-03T00:00:00Z',
        }),
        pullRequestFixture({ number: 14, mergedAt: null, state: 'closed' }),
      ],
      {
        repositoryFullName: 'octo/repo',
        baseBranch: 'main',
        timelineStart: '2026-01-01T00:00:00Z',
        timelineEnd: '2026-01-31T00:00:00Z',
      },
    )

    expect(selected.map((pullRequest) => pullRequest.number)).toEqual([12, 7])
  })

  it('uses the PR number as a deterministic tie breaker for equal activity times', () => {
    const selected = selectEligiblePullRequests(
      [
        pullRequestFixture({ number: 7, updatedAt: '2026-01-20T00:00:00Z' }),
        pullRequestFixture({ number: 12, updatedAt: '2026-01-20T00:00:00Z' }),
      ],
      {
        repositoryFullName: 'octo/repo',
        baseBranch: 'main',
        timelineStart: '2026-01-01T00:00:00Z',
        timelineEnd: '2026-01-31T00:00:00Z',
      },
    )

    expect(selected.map((pullRequest) => pullRequest.number)).toEqual([12, 7])
  })
})

function pullRequestFixture(
  overrides: Partial<{
    number: number
    state: 'closed' | 'open'
    createdAt: string
    updatedAt: string
    mergedAt: string | null
    baseBranch: string
    headRepositoryFullName: string
    fork: boolean
  }> = {},
): GitHubPullRequestResponse {
  return {
    number: overrides.number ?? 1,
    title: `PR ${overrides.number ?? 1}`,
    state: overrides.state ?? 'closed',
    html_url: 'https://github.com/octo/repo/pull/1',
    user: null,
    created_at: overrides.createdAt ?? '2026-01-01T00:00:00Z',
    updated_at: overrides.updatedAt ?? '2026-01-10T00:00:00Z',
    merged_at: overrides.mergedAt === undefined ? '2026-01-10T00:00:00Z' : overrides.mergedAt,
    base: { ref: overrides.baseBranch ?? 'main' },
    head: {
      ref: 'feature',
      sha: 'head-sha',
      repo: {
        full_name: overrides.headRepositoryFullName ?? 'contributor/repo',
        fork: overrides.fork ?? true,
      },
    },
    merge_commit_sha: 'merge-sha',
  }
}
