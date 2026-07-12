import type {
  GitBranch,
  GitCommit,
  GitContributor,
  GitIdentity,
  GitPullRequest,
  GitRepository,
  GitSource,
  GitSourceInput,
  GitSourceSnapshot,
} from '../types'
import { MemoryCache, createGitHubSnapshotCacheKey } from '../cache'
import type { SourceCache } from '../cache'
import type {
  GitHubBranchResponse,
  GitHubCommitResponse,
  GitHubContributorResponse,
  GitHubPullRequestResponse,
  GitHubRateLimitStatus,
  GitHubRepositoryResponse,
} from './githubRestClient'
import { GitHubRestClient } from './githubRestClient'

const DEFAULT_MAX_COMMITS_PER_BRANCH = 100
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1_000

export interface GitHubApiSourceOptions {
  client?: GitHubRestClient
  cache?: SourceCache<GitSourceSnapshot>
  cacheTtlMs?: number
}

export class GitHubApiSource implements GitSource {
  readonly kind = 'github-api' as const

  private readonly client: GitHubRestClient
  private readonly cache: SourceCache<GitSourceSnapshot>
  private readonly cacheTtlMs: number

  constructor(options: GitHubApiSourceOptions = {}) {
    this.client = options.client ?? new GitHubRestClient()
    this.cache = options.cache ?? new MemoryCache<GitSourceSnapshot>()
    this.cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS
  }

  getRateLimitStatus(): GitHubRateLimitStatus | null {
    return this.client.getRateLimitStatus()
  }

  async loadRepository(input: GitSourceInput): Promise<GitSourceSnapshot> {
    const cacheKey = createGitHubSnapshotCacheKey(input)
    const cachedSnapshot = this.cache.get(cacheKey)

    if (cachedSnapshot) {
      return cachedSnapshot
    }

    const maxCommitsPerBranch =
      input.options?.maxCommitsPerBranch ?? DEFAULT_MAX_COMMITS_PER_BRANCH
    const repository = await this.client.getRepository(input.owner, input.repo)
    const branches = await this.client.listBranches(input.owner, input.repo)
    const selectedBranches = input.branch
      ? branches.filter((branch) => branch.name === input.branch)
      : branches

    const commitGroups = await Promise.all(
      selectedBranches.map((branch) =>
        this.client.listCommits(input.owner, input.repo, branch.name, maxCommitsPerBranch),
      ),
    )
    const contributors = input.options?.includeContributors === false
      ? []
      : await this.client.listContributors(input.owner, input.repo)
    const pullRequests = input.options?.includePullRequests === false
      ? []
      : await this.client.listClosedPullRequests(input.owner, input.repo)

    const snapshot: GitSourceSnapshot = {
      source: this.kind,
      repository: normalizeRepository(repository),
      branches: selectedBranches.map((branch) =>
        normalizeBranch(branch, repository.default_branch, repository.html_url),
      ),
      commits: dedupeCommits(commitGroups.flat().map(normalizeCommit)),
      contributors: contributors.map(normalizeContributor),
      pullRequests: pullRequests
        .filter((pullRequest) => pullRequest.merged_at !== null)
        .map(normalizePullRequest),
      fetchedAt: new Date().toISOString(),
    }

    this.cache.set(cacheKey, snapshot, this.cacheTtlMs)

    return snapshot
  }
}

function normalizeRepository(repository: GitHubRepositoryResponse): GitRepository {
  return {
    id: String(repository.id),
    owner: repository.owner.login,
    name: repository.name,
    fullName: repository.full_name,
    defaultBranch: repository.default_branch,
    url: repository.html_url,
    description: repository.description,
    stars: repository.stargazers_count,
  }
}

function normalizeBranch(
  branch: GitHubBranchResponse,
  defaultBranch: string,
  repositoryUrl: string,
): GitBranch {
  return {
    name: branch.name,
    headSha: branch.commit.sha,
    isDefault: branch.name === defaultBranch,
    url: `${repositoryUrl}/tree/${encodeURIComponent(branch.name)}`,
  }
}

function normalizeCommit(commit: GitHubCommitResponse): GitCommit {
  return {
    sha: commit.sha,
    parents: commit.parents.map((parent) => parent.sha),
    message: commit.commit.message,
    author: normalizeIdentity(commit.commit.author, commit.author),
    committer: normalizeIdentity(commit.commit.committer, commit.committer),
    authoredAt: commit.commit.author?.date ?? null,
    committedAt: commit.commit.committer?.date ?? null,
    url: commit.html_url,
  }
}

function normalizeIdentity(
  gitIdentity: {
    name: string | null
    email: string | null
  } | null,
  user: {
    login: string
    avatar_url: string | null
    html_url: string | null
  } | null,
): GitIdentity {
  return {
    name: gitIdentity?.name ?? null,
    email: gitIdentity?.email ?? null,
    login: user?.login ?? null,
    avatarUrl: user?.avatar_url ?? null,
    profileUrl: user?.html_url ?? null,
  }
}

function dedupeCommits(commits: GitCommit[]): GitCommit[] {
  return [...new Map(commits.map((commit) => [commit.sha, commit])).values()]
}

function normalizeContributor(contributor: GitHubContributorResponse): GitContributor {
  return {
    login: contributor.login,
    avatarUrl: contributor.avatar_url,
    profileUrl: contributor.html_url,
    contributions: contributor.contributions,
  }
}

function normalizePullRequest(pullRequest: GitHubPullRequestResponse): GitPullRequest {
  return {
    number: pullRequest.number,
    title: pullRequest.title,
    state: 'closed',
    url: pullRequest.html_url,
    authorLogin: pullRequest.user?.login ?? null,
    createdAt: pullRequest.created_at,
    mergedAt: pullRequest.merged_at ?? '',
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    mergeCommitSha: pullRequest.merge_commit_sha,
  }
}
