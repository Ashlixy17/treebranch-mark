export type GitSourceKind = 'github-api' | 'local-git' | 'gitlab'

export interface GitSource<TInput = GitSourceInput> {
  kind: GitSourceKind
  loadRepository(input: TInput): Promise<GitSourceSnapshot>
}

export interface GitHubSourceInput {
  owner: string
  repo: string
  branch?: string
  options?: GitSourceOptions
}

export type GitSourceInput = GitHubSourceInput

export interface GitSourceOptions {
  maxCommitsPerBranch?: number
  includePullRequests?: boolean
  includeContributors?: boolean
  includeTags?: boolean
  includeReleases?: boolean
  pullRequestBranchLimit?: GitPullRequestBranchLimit
}

export interface GitSourceSnapshot {
  source: GitSourceKind
  repository: GitRepository
  branches: GitBranch[]
  commits: GitCommit[]
  contributors: GitContributor[]
  pullRequests: GitPullRequest[]
  releases: GitRelease[]
  tags: GitTag[]
  warnings: GitSourceWarning[]
  pullRequestCapacity: GitPullRequestCapacity
  fetchedAt: string
}

export interface GitRepository {
  id: string
  owner: string | null
  name: string
  fullName: string
  defaultBranch: string
  url: string | null
  description: string | null
  stars: number | null
}

export interface GitBranch {
  name: string
  headSha: string
  isDefault: boolean
  url: string | null
}

export interface GitCommit {
  sha: string
  parents: string[]
  message: string
  author: GitIdentity
  committer: GitIdentity
  authoredAt: string | null
  committedAt: string | null
  url: string | null
}

export interface GitIdentity {
  name: string | null
  email: string | null
  login: string | null
  avatarUrl: string | null
  profileUrl: string | null
}

export interface GitContributor {
  login: string
  avatarUrl: string | null
  profileUrl: string | null
  contributions: number
}

export interface GitPullRequest {
  number: number
  title: string
  state: GitPullRequestState
  url: string
  authorLogin: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  baseBranch: string
  headBranch: string
  headRepositoryFullName: string
  headSha: string
  mergeCommitSha: string | null
  commits: GitCommit[]
  loadState: GitPullRequestLoadState
  truncated: boolean
}

export type GitPullRequestState = 'merged' | 'open'
export type GitPullRequestLoadState = 'metadata' | 'complete' | 'partial'
export type GitPullRequestBranchLimit = 10 | 20 | 50

export interface GitRelease {
  id: number
  tagName: string
  name: string | null
  url: string
  publishedAt: string
  prerelease: boolean
  targetSha: string | null
  inferred: boolean
}

export interface GitTag {
  name: string
  commitSha: string
  url: string | null
}

export type GitSourceWarningCode =
  | 'pr-commits-unavailable'
  | 'pr-commits-truncated'
  | 'release-target-inferred'
  | 'capacity-partial'

export interface GitSourceWarning {
  code: GitSourceWarningCode
  message: string
  pullRequestNumber?: number
}

export interface GitPullRequestCapacity {
  requested: GitPullRequestBranchLimit
  mergedLoaded: number
  openLoaded: number
}

export type GitSourceErrorCode =
  | 'not-found'
  | 'rate-limited'
  | 'network-error'
  | 'unsupported-source'
  | 'bad-credentials'
  | 'git-not-installed'
  | 'not-a-repository'
  | 'permission-denied'
  | 'git-command-failed'
  | 'unknown'

export class GitSourceError extends Error {
  readonly code: GitSourceErrorCode
  readonly status?: number

  constructor(code: GitSourceErrorCode, message: string, status?: number) {
    super(message)
    this.name = 'GitSourceError'
    this.code = code
    this.status = status
  }
}

export function parseRepositoryInput(value: string): Pick<GitSourceInput, 'owner' | 'repo'> {
  const trimmed = value.trim()
  const githubUrl = trimmed.match(
    /^https?:\/\/(?:www\.)?github\.com\/([^/\s]+)\/([^/\s#?]+)(?:[/?#].*)?$/,
  )
  const shorthand = trimmed.match(/^([^/\s]+)\/([^/\s]+)$/)
  const match = githubUrl ?? shorthand

  if (!match) {
    throw new GitSourceError(
      'unknown',
      'Repository must be in owner/repo form or a GitHub repository URL.',
    )
  }

  return {
    owner: match[1],
    repo: match[2].replace(/\.git$/, ''),
  }
}
