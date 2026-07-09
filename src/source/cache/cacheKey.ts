import type { GitSourceInput } from '../types'

const DEFAULT_MAX_COMMITS_PER_BRANCH = 100

export function createGitHubSnapshotCacheKey(input: GitSourceInput): string {
  const maxCommits = input.options?.maxCommitsPerBranch ?? DEFAULT_MAX_COMMITS_PER_BRANCH
  const includePullRequests = input.options?.includePullRequests ?? true
  const includeContributors = input.options?.includeContributors ?? true
  const includeTags = input.options?.includeTags ?? false

  return [
    'github',
    `${input.owner.toLowerCase()}/${input.repo.toLowerCase()}`,
    encodeURIComponent(input.branch ?? '*'),
    maxCommits,
    includePullRequests,
    includeContributors,
    includeTags,
  ].join(':')
}
