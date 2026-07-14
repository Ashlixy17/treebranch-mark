import type {
  GitCommit,
  GitPullRequest,
  GitSourceSnapshot,
} from '../source'
import type {
  ForkTimelineAnchor,
  ForkTimelineGraphBuilderContract,
  ForkTimelineGraphBuilderResult,
  ForkTimelineLabel,
  ForkTimelineMainEvent,
  ForkTimelineOptions,
} from './forkTimelineTypes'

export class ForkTimelineGraphBuilder implements ForkTimelineGraphBuilderContract {
  build(snapshot: GitSourceSnapshot, options: ForkTimelineOptions): ForkTimelineGraphBuilderResult {
    const commitsBySha = new Map(snapshot.commits.map((commit) => [commit.sha, commit]))
    const mainCommits = collectMainCommits(snapshot, commitsBySha)
    const mainShaSet = new Set(mainCommits.map((commit) => commit.sha))
    const mainEvents = mainCommits.map((commit) => createMainEvent(snapshot, commit, options))
    const candidates = selectPullRequests(snapshot, options)
    const warnings: ForkTimelineGraphBuilderResult['warnings'] = []
    const lanes = candidates.flatMap((pullRequest) => {
      const commits = sortCommits(pullRequest.commits)
      if (commits.length === 0) {
        return []
      }

      const forkAnchor = resolveForkAnchor(commits, mainCommits, mainShaSet)
      const mergeAnchor = pullRequest.state === 'merged'
        ? resolveMergeAnchor(pullRequest, mainCommits, mainShaSet)
        : null

      if (forkAnchor.inferred) {
        warnings.push({
          type: 'inferred-fork',
          pullRequestNumber: pullRequest.number,
          message: `Pull request #${pullRequest.number} fork point was inferred from time.`,
        })
      }
      if (mergeAnchor?.inferred) {
        warnings.push({
          type: 'inferred-merge',
          pullRequestNumber: pullRequest.number,
          message: `Pull request #${pullRequest.number} merge point was inferred from time.`,
        })
      }

      return [{
        id: `pr-${pullRequest.number}`,
        pullRequest,
        commits,
        forkAnchor,
        mergeAnchor,
      }]
    })
    const anchoredShas = new Set(
      lanes.flatMap((lane) => [lane.forkAnchor.commitSha, lane.mergeAnchor?.commitSha ?? null])
        .filter((sha): sha is string => sha !== null),
    )

    return {
      graph: {
        repositoryFullName: snapshot.repository.fullName,
        mainEvents: mainEvents.map((event) => ({
          ...event,
          junction: anchoredShas.has(event.commit.sha),
        })),
        lanes,
      },
      warnings,
    }
  }
}

function collectMainCommits(
  snapshot: GitSourceSnapshot,
  commitsBySha: Map<string, GitCommit>,
): GitCommit[] {
  const branch = snapshot.branches.find(
    (candidate) => candidate.name === snapshot.repository.defaultBranch || candidate.isDefault,
  )
  const reachable = new Set<string>()
  const stack = branch ? [branch.headSha] : snapshot.commits.map((commit) => commit.sha)

  while (stack.length > 0) {
    const sha = stack.pop()
    if (!sha || reachable.has(sha)) {
      continue
    }

    const commit = commitsBySha.get(sha)
    if (!commit) {
      continue
    }

    reachable.add(sha)
    stack.push(...commit.parents)
  }

  const commits = [...reachable].map((sha) => commitsBySha.get(sha)).filter(isCommit)
  return sortCommits(commits)
}

function createMainEvent(
  snapshot: GitSourceSnapshot,
  commit: GitCommit,
  options: ForkTimelineOptions,
): ForkTimelineMainEvent {
  const releases = snapshot.releases
    .filter((release) => release.targetSha === commit.sha)
    .map<ForkTimelineLabel>((release) => ({
      text: release.tagName,
      kind: 'release',
      url: release.url,
      prerelease: release.prerelease,
      inferred: release.inferred,
    }))
  const tags = snapshot.tags
    .filter((tag) => tag.commitSha === commit.sha)
    .map<ForkTimelineLabel>((tag) => ({
      text: tag.name,
      kind: 'tag',
      url: tag.url,
      prerelease: false,
      inferred: false,
    }))
  const labels = [...releases, ...tags]
  const visibleKind = options.mainNodeMode === 'release'
    ? releases.length > 0 ? 'release' : null
    : options.mainNodeMode === 'tag'
      ? tags.length > 0 ? 'tag' : null
      : releases.length > 0 ? 'release' : 'commit'

  return {
    id: `main-${commit.sha}`,
    commit,
    visibleKind,
    labels,
    junction: false,
  }
}

function selectPullRequests(snapshot: GitSourceSnapshot, options: ForkTimelineOptions): GitPullRequest[] {
  const merged = snapshot.pullRequests.filter(
    (pullRequest) => pullRequest.state === 'merged' && pullRequest.loadState !== 'metadata',
  )
  const open = options.includeOpenPullRequests
    ? snapshot.pullRequests.filter(
        (pullRequest) => pullRequest.state === 'open' && pullRequest.loadState !== 'metadata',
      )
    : []

  return [...merged, ...open]
    .sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) || right.number - left.number,
    )
    .slice(0, options.pullRequestLimit)
}

function resolveForkAnchor(
  commits: GitCommit[],
  mainCommits: GitCommit[],
  mainShaSet: Set<string>,
): ForkTimelineAnchor {
  const first = commits[0]
  const parent = first?.parents.find((sha) => mainShaSet.has(sha))
  if (parent) {
    return { commitSha: parent, inferred: false }
  }

  return {
    commitSha: nearestEarlierCommit(mainCommits, first) ?.sha ?? mainCommits[0]?.sha ?? first?.sha ?? '',
    inferred: true,
  }
}

function resolveMergeAnchor(
  pullRequest: GitPullRequest,
  mainCommits: GitCommit[],
  mainShaSet: Set<string>,
): ForkTimelineAnchor | null {
  if (!pullRequest.mergedAt && !pullRequest.mergeCommitSha) {
    return null
  }
  if (pullRequest.mergeCommitSha && mainShaSet.has(pullRequest.mergeCommitSha)) {
    return { commitSha: pullRequest.mergeCommitSha, inferred: false }
  }

  return {
    commitSha: nearestByTime(mainCommits, pullRequest.mergedAt)?.sha ?? mainCommits.at(-1)?.sha ?? '',
    inferred: true,
  }
}

function nearestEarlierCommit(commits: GitCommit[], target: GitCommit | undefined): GitCommit | null {
  if (!target) {
    return commits[0] ?? null
  }
  const targetTime = timestamp(target)
  return commits.filter((commit) => timestamp(commit) <= targetTime).at(-1) ?? commits[0] ?? null
}

function nearestByTime(commits: GitCommit[], value: string | null): GitCommit | null {
  if (!value) {
    return commits.at(-1) ?? null
  }
  const target = Date.parse(value)
  return commits.reduce<GitCommit | null>((nearest, commit) => {
    if (!nearest) {
      return commit
    }
    return Math.abs(timestamp(commit) - target) < Math.abs(timestamp(nearest) - target)
      ? commit
      : nearest
  }, null)
}

function sortCommits(commits: GitCommit[]): GitCommit[] {
  return [...commits].sort((left, right) =>
    timestamp(left) - timestamp(right) || left.sha.localeCompare(right.sha),
  )
}

function timestamp(commit: GitCommit): number {
  const value = commit.committedAt ?? commit.authoredAt
  const parsed = value ? Date.parse(value) : Number.POSITIVE_INFINITY
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

function isCommit(commit: GitCommit | undefined): commit is GitCommit {
  return commit !== undefined
}
