import type {
  GitBranch,
  GitCommit,
  GitContributor,
  GitIdentity,
  GitPullRequest,
  GitPullRequestBranchLimit,
  GitRelease,
  GitRepository,
  GitSource,
  GitSourceInput,
  GitSourceSnapshot,
  GitSourceWarning,
  GitTag,
} from '../types'
import { MemoryCache, createGitHubSnapshotCacheKey } from '../cache'
import type { SourceCache } from '../cache'
import type {
  GitHubBranchResponse,
  GitHubCommitResponse,
  GitHubContributorResponse,
  GitHubPullRequestResponse,
  GitHubRateLimitStatus,
  GitHubReleaseResponse,
  GitHubRepositoryResponse,
  GitHubTagResponse,
} from './githubRestClient'
import { GitHubRestClient } from './githubRestClient'
import { selectEligiblePullRequests } from './pullRequestSelection'

const DEFAULT_MAX_COMMITS_PER_BRANCH = 100
const DEFAULT_PULL_REQUEST_BRANCH_LIMIT: GitPullRequestBranchLimit = 20
const MAX_PULL_REQUEST_COMMITS = 250
const MAX_ENRICHMENT_CONCURRENCY = 4
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
    const requested = input.options?.pullRequestBranchLimit ?? DEFAULT_PULL_REQUEST_BRANCH_LIMIT
    const cachedSnapshot = this.cache.get(cacheKey)

    const needsPullRequestCommits = input.options?.includePullRequestCommits !== false
    const cachedPullRequestCommitsLoaded = cachedSnapshot?.pullRequests.every(
      (pullRequest) => pullRequest.loadState !== 'metadata',
    )
    if (
      cachedSnapshot &&
      cachedSnapshot.pullRequestCapacity.requested >= requested &&
      (!needsPullRequestCommits || cachedPullRequestCommitsLoaded)
    ) {
      return cachedSnapshot
    }

    const baseSnapshot = cachedSnapshot ?? (await this.loadBaseSnapshot(input, requested))
    const snapshot = await this.enrichPullRequestCapacity(baseSnapshot, input, requested)

    this.cache.set(cacheKey, snapshot, this.cacheTtlMs)
    return snapshot
  }

  private async loadBaseSnapshot(
    input: GitSourceInput,
    requested: GitPullRequestBranchLimit,
  ): Promise<GitSourceSnapshot> {
    const maxCommitsPerBranch =
      input.options?.maxCommitsPerBranch ?? DEFAULT_MAX_COMMITS_PER_BRANCH
    const repository = await this.client.getRepository(input.owner, input.repo)
    const branches = await this.client.listBranches(input.owner, input.repo)
    const requestedBranch = input.branch?.trim()
    const requestedBranchMatch = requestedBranch
      ? branches.find((branch) => branch.name === requestedBranch)
      : undefined
    const fallbackBranch = branches.find((branch) => branch.name === repository.default_branch)
    const selectedBranches = !requestedBranch
      ? branches
      : requestedBranchMatch
        ? [requestedBranchMatch]
        : fallbackBranch
          ? [fallbackBranch]
          : branches
    const commitGroups = await Promise.all(
      selectedBranches.map((branch) =>
        this.client.listCommits(input.owner, input.repo, branch.name, maxCommitsPerBranch),
      ),
    )
    const [contributors, pullRequestResponses, releaseResponses, tagResponses] = await Promise.all([
      input.options?.includeContributors === false
        ? Promise.resolve([])
        : this.client.listContributors(input.owner, input.repo),
      input.options?.includePullRequests === false
        ? Promise.resolve([])
        : this.client.listPullRequests(input.owner, input.repo),
      input.options?.includeReleases
        ? this.client.listReleases(input.owner, input.repo)
        : Promise.resolve([]),
      input.options?.includeTags
        ? this.client.listTags(input.owner, input.repo)
        : Promise.resolve([]),
    ])

    const normalizedCommitGroups = commitGroups.map((group) => group.map(normalizeCommit))
    const capacityWarnings: GitSourceWarning[] = normalizedCommitGroups.flatMap((group) =>
      group.length >= maxCommitsPerBranch
        ? [{
            code: 'capacity-partial' as const,
            message: 'The selected branch reached the commit page limit; older commits may be truncated.',
          }]
        : [],
    )
    if (pullRequestResponses.length >= 100) {
      capacityWarnings.push({
        code: 'capacity-partial',
        message: 'The repository reached the pull-request page limit; some pull requests may be omitted.',
      })
    }
    const mainBranchName = requestedBranchMatch?.name ?? repository.default_branch
    const mainBranchIndex = selectedBranches.findIndex((branch) => branch.name === mainBranchName)
    const mainCommits = normalizedCommitGroups[mainBranchIndex] ?? normalizedCommitGroups.flat()
    const mainDates = timelineBounds(mainCommits)
    const eligiblePullRequests = input.options?.includePullRequests === false
      ? []
      : selectEligiblePullRequests(pullRequestResponses, {
          repositoryFullName: repository.full_name,
          baseBranch: mainBranchName,
          timelineStart: mainDates.start,
          timelineEnd: mainDates.end,
        })
    const pullRequests = eligiblePullRequests.map((pullRequest) => normalizePullRequest(pullRequest))
    const tags = input.options?.includeTags ? tagResponses.map(normalizeTag) : []
    const releaseResult = input.options?.includeReleases
      ? normalizeReleases(releaseResponses, tags, mainCommits)
      : { releases: [], warnings: [] }

    const branchWarnings: GitSourceWarning[] = requestedBranch && !requestedBranchMatch
      ? [{
          code: 'branch-not-found-fallback',
          message: 'Branch ' + requestedBranch + ' was not found; using the repository default branch ' +
            repository.default_branch + '.',
        }]
      : []

    return {
      source: this.kind,
      repository: normalizeRepository(repository),
      branches: selectedBranches.map((branch) =>
        normalizeBranch(branch, repository.default_branch, repository.html_url),
      ),
      commits: dedupeCommits(normalizedCommitGroups.flat()),
      contributors: contributors.map(normalizeContributor),
      pullRequests,
      releases: releaseResult.releases,
      tags,
      warnings: [...branchWarnings, ...capacityWarnings, ...releaseResult.warnings],
      pullRequestCapacity: {
        requested,
        mergedLoaded: 0,
        openLoaded: 0,
      },
      fetchedAt: new Date().toISOString(),
    }
  }

  private async enrichPullRequestCapacity(
    snapshot: GitSourceSnapshot,
    input: GitSourceInput,
    requested: GitPullRequestBranchLimit,
  ): Promise<GitSourceSnapshot> {
    if (
      input.options?.includePullRequests === false ||
      input.options?.includePullRequestCommits === false ||
      snapshot.pullRequests.length === 0
    ) {
      return {
        ...snapshot,
        pullRequestCapacity: {
          requested,
          mergedLoaded: 0,
          openLoaded: 0,
        },
      }
    }

    const mergedCandidates = snapshot.pullRequests
      .filter((pullRequest) => pullRequest.state === 'merged')
      .slice(0, requested)
    const openCandidates = snapshot.pullRequests
      .filter((pullRequest) => pullRequest.state === 'open')
      .slice(0, requested)
    const candidates = [...mergedCandidates, ...openCandidates].filter(
      (pullRequest) => pullRequest.loadState === 'metadata',
    )
    const warningByKey = new Map(
      snapshot.warnings.map((warning) => [warningKey(warning), warning]),
    )
    const enriched = await mapWithConcurrency(candidates, MAX_ENRICHMENT_CONCURRENCY, async (pullRequest) => {
      try {
        const responses = await this.client.listPullRequestCommits(
          input.owner,
          input.repo,
          pullRequest.number,
        )
        const commits = responses.map(normalizeCommit)
        const truncated = responses.length >= MAX_PULL_REQUEST_COMMITS

        if (truncated) {
          const warning: GitSourceWarning = {
            code: 'pr-commits-truncated',
            pullRequestNumber: pullRequest.number,
            message: `Pull request #${pullRequest.number} contains at least ${MAX_PULL_REQUEST_COMMITS} commits; the branch was truncated.`,
          }
          warningByKey.set(warningKey(warning), warning)
        }

        return {
          ...pullRequest,
          commits,
          loadState: truncated ? ('partial' as const) : ('complete' as const),
          truncated,
        }
      } catch {
        const warning: GitSourceWarning = {
          code: 'pr-commits-unavailable',
          pullRequestNumber: pullRequest.number,
          message: `Pull request #${pullRequest.number} commits could not be loaded.`,
        }
        warningByKey.set(warningKey(warning), warning)

        return {
          ...pullRequest,
          commits: [],
          loadState: 'partial' as const,
          truncated: false,
        }
      }
    })
    const enrichedByNumber = new Map(enriched.map((pullRequest) => [pullRequest.number, pullRequest]))
    const pullRequests = snapshot.pullRequests.map(
      (pullRequest) => enrichedByNumber.get(pullRequest.number) ?? pullRequest,
    )

    return {
      ...snapshot,
      pullRequests,
      warnings: [...warningByKey.values()],
      pullRequestCapacity: {
        requested,
        mergedLoaded: countLoaded(
          pullRequests.filter((pullRequest) => pullRequest.state === 'merged').slice(0, requested),
        ),
        openLoaded: countLoaded(
          pullRequests.filter((pullRequest) => pullRequest.state === 'open').slice(0, requested),
        ),
      },
    }
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
  gitIdentity: { name: string | null; email: string | null } | null,
  user: { login: string; avatar_url: string | null; html_url: string | null } | null,
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
    state: pullRequest.merged_at === null ? 'open' : 'merged',
    url: pullRequest.html_url,
    authorLogin: pullRequest.user?.login ?? null,
    authorAvatarUrl: pullRequest.user?.avatar_url ?? null,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    mergedAt: pullRequest.merged_at,
    baseBranch: pullRequest.base.ref,
    headBranch: pullRequest.head.ref,
    headRepositoryFullName: pullRequest.head.repo?.full_name ?? '',
    headSha: pullRequest.head.sha,
    mergeCommitSha: pullRequest.merge_commit_sha,
    commits: [],
    loadState: 'metadata',
    truncated: false,
  }
}

function normalizeTag(tag: GitHubTagResponse): GitTag {
  return {
    name: tag.name,
    commitSha: tag.commit.sha,
    url: tag.commit.url,
  }
}

function normalizeReleases(
  releases: GitHubReleaseResponse[],
  tags: GitTag[],
  mainCommits: GitCommit[],
): { releases: GitRelease[]; warnings: GitSourceWarning[] } {
  const mainCommitsBySha = new Map(mainCommits.map((commit) => [commit.sha, commit]))
  const releasesResult: GitRelease[] = []
  const warnings: GitSourceWarning[] = []

  for (const release of releases) {
    if (release.draft || release.published_at === null) {
      continue
    }

    const tag = tags.find((candidate) => candidate.name === release.tag_name)
    const exactSha = tag?.commitSha ?? (mainCommitsBySha.has(release.target_commitish)
      ? release.target_commitish
      : null)
    const exactInWindow = exactSha !== null && mainCommitsBySha.has(exactSha) ? exactSha : null
    const targetSha = exactInWindow ?? nearestCommit(mainCommits, release.published_at)?.sha ?? null
    const inferred = exactInWindow === null

    if (inferred) {
      warnings.push({
        code: 'release-target-inferred',
        message: `Release ${release.tag_name} was attached to the nearest available main commit.`,
      })
    }

    releasesResult.push({
      id: release.id,
      tagName: release.tag_name,
      name: release.name,
      url: release.html_url,
      publishedAt: release.published_at,
      prerelease: release.prerelease,
      targetSha,
      inferred,
    })
  }

  return { releases: releasesResult, warnings }
}

function timelineBounds(commits: GitCommit[]): { start: string | null; end: string | null } {
  const timestamps = commits
    .map(commitTimestamp)
    .filter((timestamp): timestamp is string => timestamp !== null)
    .sort()

  return {
    start: timestamps[0] ?? null,
    end: timestamps.at(-1) ?? null,
  }
}

function commitTimestamp(commit: GitCommit): string | null {
  return [commit.committedAt, commit.authoredAt].find((value) => value !== null) ?? null
}

function nearestCommit(commits: GitCommit[], timestamp: string): GitCommit | null {
  const target = Date.parse(timestamp)
  if (!Number.isFinite(target)) {
    return commits[0] ?? null
  }

  return commits.reduce<GitCommit | null>((nearest, commit) => {
    if (!nearest) {
      return commit
    }

    const distance = Math.abs(Date.parse(commitTimestamp(commit) ?? timestamp) - target)
    const nearestDistance = Math.abs(Date.parse(commitTimestamp(nearest) ?? timestamp) - target)
    return distance < nearestDistance ? commit : nearest
  }, null)
}

function countLoaded(pullRequests: GitPullRequest[]): number {
  return pullRequests.filter((pullRequest) => pullRequest.loadState !== 'metadata').length
}

function warningKey(warning: GitSourceWarning): string {
  return `${warning.code}:${warning.pullRequestNumber ?? 'global'}:${warning.message}`
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  let nextIndex = 0

  async function worker(): Promise<void> {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await mapper(values[index])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  )
  return results
}
