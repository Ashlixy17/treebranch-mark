import { describe, expect, it } from 'vitest'
import { GitSourceError } from '../types'
import { LocalGitSource } from './LocalGitSource'
import type { GitCommandResult, GitCommandRunner } from './GitCommandRunner'

describe('LocalGitSource', () => {
  it('maps local branches and commits into a serializable snapshot', async () => {
    const runner = new FakeGitCommandRunner({
      branches: [
        ['feature', 'sha-feature'],
        ['main', 'sha-main'],
      ],
      currentBranch: 'main',
      commitsByBranch: {
        feature: [commitRecord({ sha: 'sha-feature', parents: ['sha-main'] })],
        main: [commitRecord({ sha: 'sha-main' })],
      },
    })
    const source = new LocalGitSource({ runner })

    const snapshot = await source.loadRepository({ repositoryPath: '.' })

    expect(snapshot.source).toBe('local-git')
    expect(snapshot.repository).toMatchObject({
      owner: null,
      name: 'Treebranch-mark',
      fullName: 'Treebranch-mark',
      defaultBranch: 'main',
      url: null,
      description: null,
      stars: null,
    })
    expect(snapshot.repository.id).toMatch(/^local:[a-f0-9]{16}$/)
    expect(snapshot.branches).toEqual([
      {
        name: 'feature',
        headSha: 'sha-feature',
        isDefault: false,
        url: null,
      },
      {
        name: 'main',
        headSha: 'sha-main',
        isDefault: true,
        url: null,
      },
    ])
    expect(snapshot.commits).toEqual([
      expect.objectContaining({
        sha: 'sha-feature',
        parents: ['sha-main'],
        message: 'Commit sha-feature\nwith details',
        author: {
          name: 'Local Author',
          email: 'author@example.com',
          login: null,
          avatarUrl: null,
          profileUrl: null,
        },
        url: null,
      }),
      expect.objectContaining({ sha: 'sha-main', parents: [] }),
    ])
    expect(snapshot.contributors).toEqual([])
    expect(snapshot.pullRequests).toEqual([])
    expect(runner.logMaxCounts).toEqual([100, 100])
    expect(() => JSON.stringify(snapshot)).not.toThrow()
  })

  it('loads only the requested branch and honors maxCommitsPerBranch', async () => {
    const runner = new FakeGitCommandRunner({
      branches: [
        ['feature', 'sha-feature'],
        ['main', 'sha-main'],
      ],
      currentBranch: 'main',
      commitsByBranch: {
        feature: [commitRecord({ sha: 'sha-feature' })],
      },
    })
    const source = new LocalGitSource({ runner })

    const snapshot = await source.loadRepository({
      repositoryPath: '.',
      branch: 'feature',
      options: { maxCommitsPerBranch: 25 },
    })

    expect(snapshot.branches.map((branch) => branch.name)).toEqual(['feature'])
    expect(runner.loadedBranches).toEqual(['feature'])
    expect(runner.logMaxCounts).toEqual([25])
  })

  it('deduplicates commits reached from multiple branches', async () => {
    const shared = commitRecord({ sha: 'shared' })
    const runner = new FakeGitCommandRunner({
      branches: [
        ['feature', 'shared'],
        ['main', 'shared'],
      ],
      currentBranch: 'main',
      commitsByBranch: {
        feature: [shared],
        main: [shared],
      },
    })
    const source = new LocalGitSource({ runner })

    const snapshot = await source.loadRepository({ repositoryPath: '.' })

    expect(snapshot.commits).toHaveLength(1)
    expect(snapshot.commits[0]).not.toHaveProperty('branchNames')
  })

  it('returns an empty snapshot for a repository without commits', async () => {
    const runner = new FakeGitCommandRunner({ branches: [], currentBranch: 'main' })
    const source = new LocalGitSource({ runner })

    const snapshot = await source.loadRepository({ repositoryPath: '.' })

    expect(snapshot.repository.defaultBranch).toBe('main')
    expect(snapshot.branches).toEqual([])
    expect(snapshot.commits).toEqual([])
  })

  it('reports a requested branch that does not exist', async () => {
    const runner = new FakeGitCommandRunner({
      branches: [['main', 'sha-main']],
      currentBranch: 'main',
    })
    const source = new LocalGitSource({ runner })

    await expect(
      source.loadRepository({ repositoryPath: '.', branch: 'missing' }),
    ).rejects.toMatchObject({ code: 'not-found' })
  })

  it('maps an invalid repository to not-a-repository', async () => {
    const runner = new FakeGitCommandRunner({ branches: [], repositoryExitCode: 128 })
    const source = new LocalGitSource({ runner })

    await expect(source.loadRepository({ repositoryPath: '.' })).rejects.toMatchObject({
      code: 'not-a-repository',
    })
  })

  it('preserves git-not-installed errors from the command runner', async () => {
    const runner: GitCommandRunner = {
      run: () => Promise.reject(new GitSourceError('git-not-installed', 'Git is missing.')),
    }
    const source = new LocalGitSource({ runner })

    await expect(source.loadRepository({ repositoryPath: '.' })).rejects.toMatchObject({
      code: 'git-not-installed',
    })
  })
})

interface FakeGitCommandRunnerOptions {
  branches: Array<[name: string, headSha: string]>
  currentBranch?: string
  commitsByBranch?: Record<string, string[]>
  repositoryExitCode?: number
}

class FakeGitCommandRunner implements GitCommandRunner {
  readonly loadedBranches: string[] = []
  readonly logMaxCounts: number[] = []
  private readonly options: FakeGitCommandRunnerOptions

  constructor(options: FakeGitCommandRunnerOptions) {
    this.options = options
  }

  run(args: string[]): Promise<GitCommandResult> {
    if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
      return this.result('', this.options.repositoryExitCode ?? 0)
    }

    if (args[0] === 'rev-parse' && args[1] === '--is-bare-repository') {
      return this.result('false\n')
    }

    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return this.result(`${process.cwd()}\n`)
    }

    if (args[0] === 'for-each-ref') {
      return this.result(
        this.options.branches.map(([name, sha]) => `${name}\0${sha}`).join('\n'),
      )
    }

    if (args[0] === 'symbolic-ref') {
      return this.options.currentBranch
        ? this.result(`${this.options.currentBranch}\n`)
        : this.result('', 1)
    }

    if (args[0] === 'log') {
      const branchRef = args.find((arg) => arg.startsWith('refs/heads/')) ?? ''
      const branch = branchRef.slice('refs/heads/'.length)
      const maxCount = Number(args.find((arg) => arg.startsWith('--max-count='))?.split('=')[1])
      this.loadedBranches.push(branch)
      this.logMaxCounts.push(maxCount)
      return this.result((this.options.commitsByBranch?.[branch] ?? []).join(''))
    }

    return Promise.reject(new Error(`Unexpected Git command: ${args.join(' ')}`))
  }

  private result(stdout: string, exitCode = 0): Promise<GitCommandResult> {
    return Promise.resolve({ stdout, stderr: '', exitCode })
  }
}

function commitRecord(options: { sha: string; parents?: string[] }): string {
  return [
    options.sha,
    (options.parents ?? []).join(' '),
    'Local Author',
    'author@example.com',
    '2026-01-01T00:00:00+00:00',
    'Local Committer',
    'committer@example.com',
    '2026-01-01T00:01:00+00:00',
    `Commit ${options.sha}\nwith details`,
  ].join('\0') + '\0'
}
