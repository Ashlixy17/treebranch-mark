import type { GitHubPullRequestResponse } from './githubRestClient'

export interface PullRequestSelectionContext {
  repositoryFullName: string
  baseBranch: string
  timelineStart: string | null
  timelineEnd: string | null
}

export function selectEligiblePullRequests(
  pullRequests: GitHubPullRequestResponse[],
  context: PullRequestSelectionContext,
): GitHubPullRequestResponse[] {
  return pullRequests
    .filter((pullRequest) => pullRequest.base.ref === context.baseBranch)
    .filter((pullRequest) => pullRequest.head.repo?.fork === true)
    .filter((pullRequest) => pullRequest.head.repo?.full_name !== context.repositoryFullName)
    .filter((pullRequest) => pullRequest.state === 'open' || pullRequest.merged_at !== null)
    .filter((pullRequest) => overlapsTimeline(pullRequest, context.timelineStart, context.timelineEnd))
    .sort(
      (left, right) =>
        right.updated_at.localeCompare(left.updated_at) || right.number - left.number,
    )
}

function overlapsTimeline(
  pullRequest: GitHubPullRequestResponse,
  timelineStart: string | null,
  timelineEnd: string | null,
): boolean {
  if (!timelineStart || !timelineEnd) {
    return true
  }

  const start = Date.parse(pullRequest.created_at)
  const end = Date.parse(pullRequest.merged_at ?? timelineEnd)
  const windowStart = Date.parse(timelineStart)
  const windowEnd = Date.parse(timelineEnd)

  if (![start, end, windowStart, windowEnd].every(Number.isFinite)) {
    return true
  }

  return start <= windowEnd && end >= windowStart
}
