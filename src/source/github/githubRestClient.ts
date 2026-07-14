import { GitSourceError } from '../types'

const GITHUB_API_BASE_URL = 'https://api.github.com'

export interface GitHubRepositoryResponse {
  id: number
  name: string
  full_name: string
  html_url: string
  description: string | null
  stargazers_count: number
  default_branch: string
  owner: {
    login: string
  }
}

export interface GitHubBranchResponse {
  name: string
  commit: {
    sha: string
    url: string
  }
}

export interface GitHubCommitResponse {
  sha: string
  html_url: string
  commit: {
    message: string
    author: {
      name: string | null
      email: string | null
      date: string | null
    } | null
    committer: {
      name: string | null
      email: string | null
      date: string | null
    } | null
  }
  author: GitHubUserResponse | null
  committer: GitHubUserResponse | null
  parents: Array<{
    sha: string
  }>
}

export interface GitHubContributorResponse {
  login: string
  avatar_url: string | null
  html_url: string | null
  contributions: number
}

export interface GitHubPullRequestResponse {
  number: number
  title: string
  state: 'closed' | 'open'
  html_url: string
  user: GitHubUserResponse | null
  created_at: string
  updated_at: string
  merged_at: string | null
  base: {
    ref: string
  }
  head: {
    ref: string
    sha: string
    repo: {
      full_name: string
      fork: boolean
    } | null
  }
  merge_commit_sha: string | null
}

export interface GitHubReleaseResponse {
  id: number
  tag_name: string
  name: string | null
  html_url: string
  published_at: string | null
  prerelease: boolean
  target_commitish: string
  draft: boolean
}

export interface GitHubTagResponse {
  name: string
  zipball_url: string
  tarball_url: string
  commit: {
    sha: string
    url: string
  }
}

interface GitHubUserResponse {
  login: string
  avatar_url: string | null
  html_url: string | null
}

export interface GitHubRestClientOptions {
  fetcher?: typeof fetch
  token?: string
}

export interface GitHubRateLimitStatus {
  authentication: 'anonymous' | 'authenticated'
  limit: number | null
  remaining: number | null
  resetAt: string | null
}

export class GitHubRestClient {
  private readonly fetcher: typeof fetch
  private readonly token: string | null
  private rateLimitStatus: GitHubRateLimitStatus | null = null

  constructor(options: GitHubRestClientOptions = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
    this.token = normalizeToken(options.token)
  }

  getRepository(owner: string, repo: string): Promise<GitHubRepositoryResponse> {
    return this.get(`/repos/${owner}/${repo}`)
  }

  listBranches(owner: string, repo: string): Promise<GitHubBranchResponse[]> {
    return this.get(`/repos/${owner}/${repo}/branches?per_page=100`)
  }

  listCommits(
    owner: string,
    repo: string,
    branch: string,
    perPage: number,
  ): Promise<GitHubCommitResponse[]> {
    const query = new URLSearchParams({
      sha: branch,
      per_page: String(perPage),
    })

    return this.get(`/repos/${owner}/${repo}/commits?${query.toString()}`)
  }

  listContributors(owner: string, repo: string): Promise<GitHubContributorResponse[]> {
    return this.get(`/repos/${owner}/${repo}/contributors?per_page=100`)
  }

  listClosedPullRequests(owner: string, repo: string): Promise<GitHubPullRequestResponse[]> {
    return this.get(`/repos/${owner}/${repo}/pulls?state=closed&per_page=100`)
  }

  listPullRequests(owner: string, repo: string): Promise<GitHubPullRequestResponse[]> {
    return this.get(
      `/repos/${owner}/${repo}/pulls?state=all&sort=updated&direction=desc&per_page=100`,
    )
  }

  listPullRequestCommits(
    owner: string,
    repo: string,
    pullRequestNumber: number,
  ): Promise<GitHubCommitResponse[]> {
    return this.get(`/repos/${owner}/${repo}/pulls/${pullRequestNumber}/commits?per_page=100`)
  }

  listReleases(owner: string, repo: string): Promise<GitHubReleaseResponse[]> {
    return this.get(`/repos/${owner}/${repo}/releases?per_page=100`)
  }

  listTags(owner: string, repo: string): Promise<GitHubTagResponse[]> {
    return this.get(`/repos/${owner}/${repo}/tags?per_page=100`)
  }

  getRateLimitStatus(): GitHubRateLimitStatus | null {
    return this.rateLimitStatus
  }

  private async get<T>(path: string): Promise<T> {
    let response: Response
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      response = await this.fetcher(`${GITHUB_API_BASE_URL}${path}`, {
        headers,
      })
    } catch (error) {
      throw new GitSourceError(
        'network-error',
        error instanceof Error ? error.message : 'Network request failed.',
      )
    }

    this.rateLimitStatus = readRateLimitStatus(response.headers, this.token !== null)

    if (!response.ok) {
      throw mapGitHubResponseError(response)
    }

    return response.json() as Promise<T>
  }
}

function mapGitHubResponseError(response: Response): GitSourceError {
  if (response.status === 401) {
    return new GitSourceError(
      'bad-credentials',
      'GitHub authentication failed. Please verify your Personal Access Token.',
      401,
    )
  }

  if (response.status === 404) {
    return new GitSourceError('not-found', 'Repository was not found or is not public.', 404)
  }

  if (response.status === 403) {
    return new GitSourceError('rate-limited', 'GitHub API rate limit exceeded.', 403)
  }

  return new GitSourceError('unknown', `GitHub API request failed with ${response.status}.`, response.status)
}

function normalizeToken(token: string | undefined): string | null {
  const trimmed = token?.trim()
  return trimmed ? trimmed : null
}

function readRateLimitStatus(headers: Headers, authenticated: boolean): GitHubRateLimitStatus {
  const reset = parseHeaderNumber(headers.get('x-ratelimit-reset'))

  return {
    authentication: authenticated ? 'authenticated' : 'anonymous',
    limit: parseHeaderNumber(headers.get('x-ratelimit-limit')),
    remaining: parseHeaderNumber(headers.get('x-ratelimit-remaining')),
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
  }
}

function parseHeaderNumber(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
