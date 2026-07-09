import { describe, expect, it, vi } from 'vitest'
import { MemoryCache } from '../cache'
import type { GitSourceSnapshot } from '../types'
import { GitSourceError } from '../types'
import { GitHubApiSource } from './GitHubApiSource'
import { GitHubRestClient } from './githubRestClient'
import type {
  GitHubBranchResponse,
  GitHubCommitResponse,
  GitHubContributorResponse,
  GitHubPullRequestResponse,
  GitHubRepositoryResponse,
} from './githubRestClient'

describe('GitHubApiSource', () => {
  it('maps GitHub responses into a source snapshot', async () => {
    const client = createClient()
    const source = createSource(client)

    const snapshot = await source.loadRepository({
      owner: 'octo',
      repo: 'repo',
      options: { maxCommitsPerBranch: 25 },
    })

    expect(snapshot.source).toBe('github-api')
    expect(snapshot.repository).toMatchObject({
      owner: 'octo',
      name: 'repo',
      fullName: 'octo/repo',
      defaultBranch: 'main',
      stars: 42,
    })
    expect(snapshot.branches).toEqual([
      {
        name: 'main',
        headSha: 'sha-main',
        isDefault: true,
        url: 'https://github.com/octo/repo/tree/main',
      },
      {
        name: 'feature',
        headSha: 'sha-feature',
        isDefault: false,
        url: 'https://github.com/octo/repo/tree/feature',
      },
    ])
    expect(snapshot.commits).toHaveLength(2)
    expect(snapshot.commits[0]).not.toHaveProperty('branchNames')
    expect(snapshot.commits[0]).toMatchObject({
      sha: 'sha-main',
      parents: ['sha-parent'],
      author: {
        name: 'Mona',
        email: 'mona@example.com',
        login: 'mona',
      },
    })
    expect(snapshot.contributors).toEqual([
      {
        login: 'mona',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1',
        profileUrl: 'https://github.com/mona',
        contributions: 12,
      },
    ])
    expect(snapshot.pullRequests).toEqual([
      {
        number: 7,
        title: 'Merge feature',
        state: 'closed',
        url: 'https://github.com/octo/repo/pull/7',
        authorLogin: 'mona',
        createdAt: '2026-01-01T00:00:00Z',
        mergedAt: '2026-01-02T00:00:00Z',
        baseBranch: 'main',
        headBranch: 'feature',
        mergeCommitSha: 'sha-main',
      },
    ])
    expect(client.lastPerPage).toBe(25)
  })

  it('uses the default max commit count when the option is omitted', async () => {
    const client = createClient()
    const source = createSource(client)

    await source.loadRepository({ owner: 'octo', repo: 'repo' })

    expect(client.lastPerPage).toBe(100)
  })

  it('can load a single requested branch', async () => {
    const client = createClient()
    const source = createSource(client)

    const snapshot = await source.loadRepository({
      owner: 'octo',
      repo: 'repo',
      branch: 'feature',
    })

    expect(snapshot.branches.map((branch) => branch.name)).toEqual(['feature'])
    expect(client.loadedBranches).toEqual(['feature'])
  })

  it('dedupes commits by sha without storing branch membership on commits', async () => {
    const client = createClient({
      commitsByBranch: {
        main: [commitFixture({ sha: 'shared' })],
        feature: [commitFixture({ sha: 'shared' })],
      },
    })
    const source = createSource(client)

    const snapshot = await source.loadRepository({ owner: 'octo', repo: 'repo' })

    expect(snapshot.commits).toHaveLength(1)
    expect(snapshot.commits[0]).toMatchObject({ sha: 'shared' })
    expect(snapshot.commits[0]).not.toHaveProperty('branchNames')
  })

  it('can skip contributors and pull requests through options', async () => {
    const client = createClient()
    const source = createSource(client)

    const snapshot = await source.loadRepository({
      owner: 'octo',
      repo: 'repo',
      options: {
        includeContributors: false,
        includePullRequests: false,
      },
    })

    expect(snapshot.contributors).toEqual([])
    expect(snapshot.pullRequests).toEqual([])
    expect(client.contributorsLoaded).toBe(false)
    expect(client.pullRequestsLoaded).toBe(false)
  })

  it('reuses a cached snapshot for the same query', async () => {
    const client = createClient()
    const source = createSource(client)
    const input = { owner: 'octo', repo: 'repo' }

    const first = await source.loadRepository(input)
    const second = await source.loadRepository(input)

    expect(second).toBe(first)
    expect(client.loadedBranches).toEqual(['main', 'feature'])
  })

  it('requests a fresh snapshot after the cache TTL expires', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-09T00:00:00Z'))
    const client = createClient()
    const source = new GitHubApiSource({
      client,
      cache: new MemoryCache<GitSourceSnapshot>(),
      cacheTtlMs: 10,
    })

    const first = await source.loadRepository({ owner: 'octo', repo: 'repo' })
    vi.advanceTimersByTime(10)
    const second = await source.loadRepository({ owner: 'octo', repo: 'repo' })

    expect(second).not.toBe(first)
    expect(client.loadedBranches).toEqual(['main', 'feature', 'main', 'feature'])
    vi.useRealTimers()
  })

  it('does not share snapshots between different query keys', async () => {
    const client = createClient()
    const source = createSource(client)

    await source.loadRepository({ owner: 'octo', repo: 'repo', branch: 'main' })
    await source.loadRepository({ owner: 'octo', repo: 'repo', branch: 'feature' })

    expect(client.loadedBranches).toEqual(['main', 'feature'])
  })

  it('shares cached snapshots across clients because authentication is not in the key', async () => {
    const cache = new MemoryCache<GitSourceSnapshot>()
    const firstClient = createClient()
    const secondClient = createClient()
    const firstSource = new GitHubApiSource({ client: firstClient, cache })
    const secondSource = new GitHubApiSource({ client: secondClient, cache })

    const first = await firstSource.loadRepository({ owner: 'octo', repo: 'repo' })
    const second = await secondSource.loadRepository({ owner: 'octo', repo: 'repo' })

    expect(second).toBe(first)
    expect(firstClient.loadedBranches).toEqual(['main', 'feature'])
    expect(secondClient.loadedBranches).toEqual([])
  })

  it('isolates the default memory cache between source instances', async () => {
    const firstClient = createClient()
    const secondClient = createClient()
    const firstSource = new GitHubApiSource({ client: firstClient })
    const secondSource = new GitHubApiSource({ client: secondClient })
    const input = {
      owner: 'default-cache-owner',
      repo: 'default-cache-repository',
    }

    const first = await firstSource.loadRepository(input)
    const second = await secondSource.loadRepository(input)

    expect(second).not.toBe(first)
    expect(firstClient.loadedBranches).toEqual(['main', 'feature'])
    expect(secondClient.loadedBranches).toEqual(['main', 'feature'])
  })

  it('does not cache failed repository loads', async () => {
    const client = new FlakyGitHubRestClient()
    const source = createSource(client)

    await expect(source.loadRepository({ owner: 'octo', repo: 'repo' })).rejects.toMatchObject({
      code: 'network-error',
    })
    await expect(
      source.loadRepository({ owner: 'octo', repo: 'repo' }),
    ).resolves.toMatchObject({
      repository: { fullName: 'octo/repo' },
    })

    expect(client.repositoryRequests).toBe(2)
  })
})

describe('GitHubRestClient errors', () => {
  it('sends an authorization header when token is provided', async () => {
    const capturedHeaders: Headers[] = []
    const client = new GitHubRestClient({
      token: 'ghp_test_token',
      fetcher: async (_input, init) => {
        capturedHeaders.push(new Headers(init?.headers))
        return new Response(JSON.stringify(repositoryFixture), { status: 200 })
      },
    })

    await client.getRepository('octo', 'repo')

    expect(capturedHeaders[0]?.get('authorization')).toBe('Bearer ghp_test_token')
  })

  it('does not send an authorization header when token is missing', async () => {
    const capturedHeaders: Headers[] = []
    const client = new GitHubRestClient({
      fetcher: async (_input, init) => {
        capturedHeaders.push(new Headers(init?.headers))
        return new Response(JSON.stringify(repositoryFixture), { status: 200 })
      },
    })

    await client.getRepository('octo', 'repo')

    expect(capturedHeaders[0]?.has('authorization')).toBe(false)
  })

  it('ignores empty or whitespace tokens', async () => {
    const capturedHeaders: Headers[] = []
    const client = new GitHubRestClient({
      token: '   ',
      fetcher: async (_input, init) => {
        capturedHeaders.push(new Headers(init?.headers))
        return new Response(JSON.stringify(repositoryFixture), { status: 200 })
      },
    })

    await client.getRepository('octo', 'repo')

    expect(capturedHeaders[0]?.has('authorization')).toBe(false)
  })

  it('calls the default browser fetch with its global binding', async () => {
    const originalFetch = globalThis.fetch
    let calledWithGlobalThis = false

    globalThis.fetch = function (
      this: unknown,
      _input: RequestInfo | URL,
      _init?: RequestInit,
    ): Promise<Response> {
      calledWithGlobalThis = this === globalThis
      return Promise.resolve(new Response(JSON.stringify(repositoryFixture), { status: 200 }))
    } as typeof fetch

    try {
      const client = new GitHubRestClient()

      await expect(client.getRepository('octo', 'repo')).resolves.toMatchObject({
        full_name: 'octo/repo',
      })
      expect(calledWithGlobalThis).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('maps 404 responses to not-found source errors', async () => {
    const client = new GitHubRestClient({
      fetcher: async () => new Response('{}', { status: 404 }),
    })

    await expect(client.getRepository('missing', 'repo')).rejects.toMatchObject({
      code: 'not-found',
      status: 404,
    })
  })

  it('maps rate limit responses to rate-limited source errors', async () => {
    const client = new GitHubRestClient({
      fetcher: async () =>
        new Response('{}', {
          status: 403,
          headers: { 'x-ratelimit-remaining': '0' },
        }),
    })

    await expect(client.getRepository('octo', 'repo')).rejects.toMatchObject({
      code: 'rate-limited',
      status: 403,
    })
  })

  it('maps 403 responses without rate limit headers to rate-limited source errors', async () => {
    const client = new GitHubRestClient({
      fetcher: async () => new Response('{}', { status: 403 }),
    })

    await expect(client.getRepository('octo', 'repo')).rejects.toMatchObject({
      code: 'rate-limited',
      status: 403,
    })
  })

  it('maps 401 responses to bad-credentials source errors', async () => {
    const client = new GitHubRestClient({
      fetcher: async () => new Response('{}', { status: 401 }),
    })

    await expect(client.getRepository('octo', 'repo')).rejects.toMatchObject({
      code: 'bad-credentials',
      status: 401,
    })
  })

  it('captures GitHub rate limit response headers for anonymous requests', async () => {
    const reset = 1783500000
    const client = new GitHubRestClient({
      fetcher: async () =>
        new Response(JSON.stringify(repositoryFixture), {
          status: 200,
          headers: {
            'x-ratelimit-limit': '60',
            'x-ratelimit-remaining': '12',
            'x-ratelimit-reset': String(reset),
          },
        }),
    })

    await client.getRepository('octo', 'repo')

    expect(client.getRateLimitStatus()).toEqual({
      authentication: 'anonymous',
      limit: 60,
      remaining: 12,
      resetAt: new Date(reset * 1000).toISOString(),
    })
  })

  it('marks rate limit status as authenticated when token exists', async () => {
    const client = new GitHubRestClient({
      token: 'ghp_test_token',
      fetcher: async () =>
        new Response(JSON.stringify(repositoryFixture), {
          status: 200,
          headers: {
            'x-ratelimit-limit': '5000',
            'x-ratelimit-remaining': '4978',
            'x-ratelimit-reset': '1783500000',
          },
        }),
    })

    await client.getRepository('octo', 'repo')

    expect(client.getRateLimitStatus()).toMatchObject({
      authentication: 'authenticated',
      limit: 5000,
      remaining: 4978,
    })
  })

  it('maps fetch failures to network source errors', async () => {
    const client = new GitHubRestClient({
      fetcher: async () => {
        throw new Error('offline')
      },
    })

    await expect(client.getRepository('octo', 'repo')).rejects.toBeInstanceOf(GitSourceError)
    await expect(client.getRepository('octo', 'repo')).rejects.toMatchObject({
      code: 'network-error',
    })
  })
})

interface FakeClientOptions {
  commitsByBranch?: Record<string, GitHubCommitResponse[]>
}

class FakeGitHubRestClient extends GitHubRestClient {
  lastPerPage: number | null = null
  loadedBranches: string[] = []
  contributorsLoaded = false
  pullRequestsLoaded = false

  private readonly commitsByBranch: Record<string, GitHubCommitResponse[]>

  constructor(options: FakeClientOptions = {}) {
    super()
    this.commitsByBranch = options.commitsByBranch ?? {
      main: [commitFixture({ sha: 'sha-main', parents: ['sha-parent'] })],
      feature: [commitFixture({ sha: 'sha-feature', parents: ['sha-main'] })],
    }
  }

  override getRepository(): Promise<GitHubRepositoryResponse> {
    return Promise.resolve(repositoryFixture)
  }

  override listBranches(): Promise<GitHubBranchResponse[]> {
    return Promise.resolve(branchesFixture)
  }

  override listCommits(
    _owner: string,
    _repo: string,
    branch: string,
    perPage: number,
  ): Promise<GitHubCommitResponse[]> {
    this.lastPerPage = perPage
    this.loadedBranches.push(branch)
    return Promise.resolve(this.commitsByBranch[branch] ?? [])
  }

  override listContributors(): Promise<GitHubContributorResponse[]> {
    this.contributorsLoaded = true
    return Promise.resolve(contributorsFixture)
  }

  override listClosedPullRequests(): Promise<GitHubPullRequestResponse[]> {
    this.pullRequestsLoaded = true
    return Promise.resolve(pullRequestsFixture)
  }
}

class FlakyGitHubRestClient extends FakeGitHubRestClient {
  repositoryRequests = 0

  override getRepository(): Promise<GitHubRepositoryResponse> {
    this.repositoryRequests += 1

    if (this.repositoryRequests === 1) {
      return Promise.reject(new GitSourceError('network-error', 'offline'))
    }

    return super.getRepository()
  }
}

function createClient(options?: FakeClientOptions): FakeGitHubRestClient {
  return new FakeGitHubRestClient(options)
}

function createSource(client: GitHubRestClient): GitHubApiSource {
  return new GitHubApiSource({
    client,
    cache: new MemoryCache<GitSourceSnapshot>(),
  })
}

const repositoryFixture: GitHubRepositoryResponse = {
  id: 1,
  name: 'repo',
  full_name: 'octo/repo',
  html_url: 'https://github.com/octo/repo',
  description: 'A test repository',
  stargazers_count: 42,
  default_branch: 'main',
  owner: {
    login: 'octo',
  },
}

const branchesFixture: GitHubBranchResponse[] = [
  {
    name: 'main',
    commit: {
      sha: 'sha-main',
      url: 'https://api.github.com/repos/octo/repo/commits/sha-main',
    },
  },
  {
    name: 'feature',
    commit: {
      sha: 'sha-feature',
      url: 'https://api.github.com/repos/octo/repo/commits/sha-feature',
    },
  },
]

const contributorsFixture: GitHubContributorResponse[] = [
  {
    login: 'mona',
    avatar_url: 'https://avatars.githubusercontent.com/u/1',
    html_url: 'https://github.com/mona',
    contributions: 12,
  },
]

const pullRequestsFixture: GitHubPullRequestResponse[] = [
  {
    number: 7,
    title: 'Merge feature',
    state: 'closed',
    html_url: 'https://github.com/octo/repo/pull/7',
    user: {
      login: 'mona',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      html_url: 'https://github.com/mona',
    },
    created_at: '2026-01-01T00:00:00Z',
    merged_at: '2026-01-02T00:00:00Z',
    base: {
      ref: 'main',
    },
    head: {
      ref: 'feature',
    },
    merge_commit_sha: 'sha-main',
  },
  {
    number: 8,
    title: 'Closed but not merged',
    state: 'closed',
    html_url: 'https://github.com/octo/repo/pull/8',
    user: null,
    created_at: '2026-01-03T00:00:00Z',
    merged_at: null,
    base: {
      ref: 'main',
    },
    head: {
      ref: 'other',
    },
    merge_commit_sha: null,
  },
]

function commitFixture(options: { sha: string; parents?: string[] }): GitHubCommitResponse {
  return {
    sha: options.sha,
    html_url: `https://github.com/octo/repo/commit/${options.sha}`,
    commit: {
      message: `Commit ${options.sha}`,
      author: {
        name: 'Mona',
        email: 'mona@example.com',
        date: '2026-01-01T00:00:00Z',
      },
      committer: {
        name: 'Hubot',
        email: 'hubot@example.com',
        date: '2026-01-01T00:01:00Z',
      },
    },
    author: {
      login: 'mona',
      avatar_url: 'https://avatars.githubusercontent.com/u/1',
      html_url: 'https://github.com/mona',
    },
    committer: {
      login: 'hubot',
      avatar_url: 'https://avatars.githubusercontent.com/u/2',
      html_url: 'https://github.com/hubot',
    },
    parents: (options.parents ?? []).map((sha) => ({ sha })),
  }
}
