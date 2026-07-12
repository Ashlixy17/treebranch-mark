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
}

export interface GitSourceSnapshot {
  source: GitSourceKind
  repository: GitRepository
  branches: GitBranch[]
  commits: GitCommit[]
  contributors: GitContributor[]
  pullRequests: GitPullRequest[]
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
  state: 'closed'
  url: string
  authorLogin: string | null
  createdAt: string
  mergedAt: string
  baseBranch: string
  headBranch: string
  mergeCommitSha: string | null
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
