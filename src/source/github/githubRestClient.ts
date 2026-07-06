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
  merged_at: string | null
  base: {
    ref: string
  }
  head: {
    ref: string
  }
  merge_commit_sha: string | null
}

interface GitHubUserResponse {
  login: string
  avatar_url: string | null
  html_url: string | null
}

export interface GitHubRestClientOptions {
  fetcher?: typeof fetch
}

export class GitHubRestClient {
  private readonly fetcher: typeof fetch

  constructor(options: GitHubRestClientOptions = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
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

  private async get<T>(path: string): Promise<T> {
    let response: Response

    try {
      response = await this.fetcher(`${GITHUB_API_BASE_URL}${path}`, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      })
    } catch (error) {
      throw new GitSourceError(
        'network-error',
        error instanceof Error ? error.message : 'Network request failed.',
      )
    }

    if (!response.ok) {
      throw mapGitHubResponseError(response)
    }

    return response.json() as Promise<T>
  }
}

function mapGitHubResponseError(response: Response): GitSourceError {
  if (response.status === 404) {
    return new GitSourceError('not-found', 'Repository was not found or is not public.', 404)
  }

  if (response.status === 403) {
    const remaining = response.headers.get('x-ratelimit-remaining')
    const code = remaining === '0' ? 'rate-limited' : 'unknown'
    const message =
      code === 'rate-limited'
        ? 'GitHub API rate limit exceeded.'
        : 'GitHub API request was forbidden.'

    return new GitSourceError(code, message, 403)
  }

  return new GitSourceError('unknown', `GitHub API request failed with ${response.status}.`, response.status)
}
