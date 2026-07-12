import { createHash } from 'node:crypto'
import { realpath, stat } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import type {
  GitCommit,
  GitIdentity,
  GitSource,
  GitSourceSnapshot,
} from '../types'
import { GitSourceError } from '../types'
import type { GitCommandResult, GitCommandRunner } from './GitCommandRunner'
import { SystemGitCommandRunner } from './GitCommandRunner'
import type { LocalGitSourceInput } from './types'

const DEFAULT_MAX_COMMITS_PER_BRANCH = 100
const COMMIT_FIELD_COUNT = 9
const COMMIT_FORMAT = '%H%x00%P%x00%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B'

export interface LocalGitSourceDependencies {
  runner?: GitCommandRunner
}

export class LocalGitSource implements GitSource<LocalGitSourceInput> {
  readonly kind = 'local-git' as const

  private readonly runner: GitCommandRunner

  constructor(dependencies: LocalGitSourceDependencies = {}) {
    this.runner = dependencies.runner ?? new SystemGitCommandRunner()
  }

  async loadRepository(input: LocalGitSourceInput): Promise<GitSourceSnapshot> {
    const requestedPath = await resolveRepositoryInputPath(input.repositoryPath)
    const repositoryCheck = await this.runner.run(['rev-parse', '--git-dir'], requestedPath)

    if (repositoryCheck.exitCode !== 0) {
      throw new GitSourceError('not-a-repository', 'The selected path is not a Git repository.')
    }

    const repositoryPath = await this.resolveRepositoryRoot(requestedPath)
    const allBranches = await this.loadBranches(repositoryPath)
    const currentBranch = await this.loadCurrentBranch(repositoryPath)
    const selectedBranches = selectBranches(allBranches, input.branch)
    const defaultBranch = selectDefaultBranch(allBranches, currentBranch, input.branch)
    const maxCommitsPerBranch = normalizeMaxCommits(input.options?.maxCommitsPerBranch)
    const commitGroups: GitCommit[][] = []

    for (const branch of selectedBranches) {
      commitGroups.push(
        await this.loadCommits(repositoryPath, branch[0], maxCommitsPerBranch),
      )
    }

    return {
      source: this.kind,
      repository: {
        id: createLocalRepositoryId(repositoryPath),
        owner: null,
        name: basename(repositoryPath),
        fullName: basename(repositoryPath),
        defaultBranch,
        url: null,
        description: null,
        stars: null,
      },
      branches: selectedBranches.map(([name, headSha]) => ({
        name,
        headSha,
        isDefault: name === defaultBranch,
        url: null,
      })),
      commits: dedupeCommits(commitGroups.flat()),
      contributors: [],
      pullRequests: [],
      fetchedAt: new Date().toISOString(),
    }
  }

  private async resolveRepositoryRoot(requestedPath: string): Promise<string> {
    const bareResult = await this.runRequired(
      ['rev-parse', '--is-bare-repository'],
      requestedPath,
    )

    if (bareResult.stdout.trim() === 'true') {
      return realpath(requestedPath)
    }

    const topLevelResult = await this.runRequired(
      ['rev-parse', '--show-toplevel'],
      requestedPath,
    )

    return realpath(topLevelResult.stdout.trim())
  }

  private async loadBranches(repositoryPath: string): Promise<Array<[string, string]>> {
    const result = await this.runRequired(
      [
        'for-each-ref',
        '--sort=refname',
        '--format=%(refname:short)%00%(objectname)',
        'refs/heads',
      ],
      repositoryPath,
    )

    return result.stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const separatorIndex = line.indexOf('\0')

        if (separatorIndex < 1) {
          throw new GitSourceError('git-command-failed', 'Git returned an invalid branch record.')
        }

        return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)]
      })
  }

  private async loadCurrentBranch(repositoryPath: string): Promise<string | null> {
    const result = await this.runner.run(
      ['symbolic-ref', '--quiet', '--short', 'HEAD'],
      repositoryPath,
    )

    return result.exitCode === 0 ? result.stdout.trim() || null : null
  }

  private async loadCommits(
    repositoryPath: string,
    branch: string,
    maxCommits: number,
  ): Promise<GitCommit[]> {
    const result = await this.runRequired(
      [
        'log',
        `--max-count=${maxCommits}`,
        '-z',
        `--format=${COMMIT_FORMAT}`,
        `refs/heads/${branch}`,
        '--',
      ],
      repositoryPath,
    )

    return parseCommitLog(result.stdout)
  }

  private async runRequired(args: string[], cwd: string): Promise<GitCommandResult> {
    const result = await this.runner.run(args, cwd)

    if (result.exitCode !== 0) {
      throw new GitSourceError('git-command-failed', 'A Git command failed while reading the repository.')
    }

    return result
  }
}

async function resolveRepositoryInputPath(repositoryPath: string): Promise<string> {
  const resolvedPath = resolve(repositoryPath || '.')

  try {
    const pathStat = await stat(resolvedPath)

    if (!pathStat.isDirectory()) {
      throw new GitSourceError('not-a-repository', 'The selected path is not a directory.')
    }

    return resolvedPath
  } catch (error) {
    if (error instanceof GitSourceError) {
      throw error
    }

    const code = getErrorCode(error)

    if (code === 'EACCES' || code === 'EPERM') {
      throw new GitSourceError('permission-denied', 'The repository path cannot be accessed.')
    }

    throw new GitSourceError('not-a-repository', 'The repository path does not exist.')
  }
}

function selectBranches(
  branches: Array<[string, string]>,
  requestedBranch?: string,
): Array<[string, string]> {
  if (!requestedBranch) {
    return branches
  }

  const selected = branches.filter(([name]) => name === requestedBranch)

  if (selected.length === 0) {
    throw new GitSourceError('not-found', `Local branch "${requestedBranch}" was not found.`)
  }

  return selected
}

function selectDefaultBranch(
  branches: Array<[string, string]>,
  currentBranch: string | null,
  requestedBranch?: string,
): string {
  const names = branches.map(([name]) => name)

  if (currentBranch) {
    return currentBranch
  }

  if (requestedBranch && names.includes(requestedBranch)) {
    return requestedBranch
  }

  if (names.includes('main')) {
    return 'main'
  }

  if (names.includes('master')) {
    return 'master'
  }

  return names[0] ?? ''
}

function normalizeMaxCommits(value: number | undefined): number {
  const maxCommits = value ?? DEFAULT_MAX_COMMITS_PER_BRANCH

  if (!Number.isInteger(maxCommits) || maxCommits <= 0) {
    throw new GitSourceError('unknown', 'maxCommitsPerBranch must be a positive integer.')
  }

  return maxCommits
}

function parseCommitLog(output: string): GitCommit[] {
  if (!output) {
    return []
  }

  const fields = output.split('\0')

  if (fields.at(-1) === '') {
    fields.pop()
  }

  if (fields.length % COMMIT_FIELD_COUNT !== 0) {
    throw new GitSourceError('git-command-failed', 'Git returned an invalid commit record.')
  }

  const commits: GitCommit[] = []

  for (let index = 0; index < fields.length; index += COMMIT_FIELD_COUNT) {
    const [
      sha,
      parentShas,
      authorName,
      authorEmail,
      authoredAt,
      committerName,
      committerEmail,
      committedAt,
      message,
    ] = fields.slice(index, index + COMMIT_FIELD_COUNT)

    commits.push({
      sha,
      parents: parentShas ? parentShas.split(' ') : [],
      message: message.replace(/\r?\n$/, ''),
      author: createLocalIdentity(authorName, authorEmail),
      committer: createLocalIdentity(committerName, committerEmail),
      authoredAt: authoredAt || null,
      committedAt: committedAt || null,
      url: null,
    })
  }

  return commits
}

function createLocalIdentity(name: string, email: string): GitIdentity {
  return {
    name: name || null,
    email: email || null,
    login: null,
    avatarUrl: null,
    profileUrl: null,
  }
}

function createLocalRepositoryId(repositoryPath: string): string {
  const digest = createHash('sha256').update(repositoryPath).digest('hex').slice(0, 16)
  return `local:${digest}`
}

function dedupeCommits(commits: GitCommit[]): GitCommit[] {
  return [...new Map(commits.map((commit) => [commit.sha, commit])).values()]
}

function getErrorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : undefined
}
