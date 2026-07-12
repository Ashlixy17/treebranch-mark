import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { LocalGitSource } from './LocalGitSource'

const INTEGRATION_TEST_TIMEOUT_MS = 20_000

describe('LocalGitSource integration', () => {
  const temporaryRepositories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryRepositories.splice(0).map((repositoryPath) =>
        rm(repositoryPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      ),
    )
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('reads branches, multiline commit data, and a merge from a real repository', async () => {
    const repositoryPath = await createRepository()
    temporaryRepositories.push(repositoryPath)

    await writeFile(join(repositoryPath, 'root.txt'), 'root\n')
    await runGit(repositoryPath, ['add', 'root.txt'])
    await runGit(repositoryPath, ['commit', '-m', 'Root commit'])

    await runGit(repositoryPath, ['checkout', '-b', 'feature'])
    await writeFile(join(repositoryPath, 'feature.txt'), 'feature\n')
    await runGit(repositoryPath, ['add', 'feature.txt'])
    await runGit(repositoryPath, [
      'commit',
      '-m',
      '功能提交',
      '-m',
      'Feature details on a second paragraph.',
    ])

    await runGit(repositoryPath, ['checkout', 'main'])
    await writeFile(join(repositoryPath, 'main.txt'), 'main\n')
    await runGit(repositoryPath, ['add', 'main.txt'])
    await runGit(repositoryPath, ['commit', '-m', 'Main commit'])
    await runGit(repositoryPath, ['merge', '--no-ff', 'feature', '-m', 'Merge feature'])

    const snapshot = await new LocalGitSource().loadRepository({ repositoryPath })

    expect(snapshot.branches.map((branch) => branch.name)).toEqual(['feature', 'main'])
    expect(snapshot.branches.find((branch) => branch.name === 'main')?.isDefault).toBe(true)
    expect(snapshot.commits).toHaveLength(4)

    const featureCommit = snapshot.commits.find((commit) => commit.message.startsWith('功能提交'))
    const mergeCommit = snapshot.commits.find((commit) => commit.message === 'Merge feature')

    expect(featureCommit).toMatchObject({
      author: {
        name: 'Treebranch Test',
        email: 'treebranch@example.com',
        login: null,
        avatarUrl: null,
        profileUrl: null,
      },
      url: null,
    })
    expect(featureCommit?.message).toContain('Feature details on a second paragraph.')
    expect(mergeCommit?.parents).toHaveLength(2)
    expect(JSON.stringify(snapshot)).not.toContain(repositoryPath)
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('returns an empty snapshot for a real repository without commits', async () => {
    const repositoryPath = await createRepository()
    temporaryRepositories.push(repositoryPath)

    const snapshot = await new LocalGitSource().loadRepository({ repositoryPath })

    expect(snapshot.repository.defaultBranch).toBe('main')
    expect(snapshot.branches).toEqual([])
    expect(snapshot.commits).toEqual([])
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('uses a stable fallback branch while HEAD is detached', async () => {
    const repositoryPath = await createRepository()
    temporaryRepositories.push(repositoryPath)
    await writeFile(join(repositoryPath, 'root.txt'), 'root\n')
    await runGit(repositoryPath, ['add', 'root.txt'])
    await runGit(repositoryPath, ['commit', '-m', 'Root commit'])
    await runGit(repositoryPath, ['checkout', '--detach', 'HEAD'])

    const snapshot = await new LocalGitSource().loadRepository({ repositoryPath })

    expect(snapshot.repository.defaultBranch).toBe('main')
    expect(snapshot.branches).toEqual([
      expect.objectContaining({ name: 'main', isDefault: true }),
    ])
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('supports an empty bare repository', async () => {
    const repositoryPath = await mkdtemp(join(tmpdir(), 'treebranch bare git-'))
    temporaryRepositories.push(repositoryPath)
    await runGit(repositoryPath, ['init', '--bare', '--initial-branch=main'])

    const snapshot = await new LocalGitSource().loadRepository({ repositoryPath })

    expect(snapshot.repository.defaultBranch).toBe('main')
    expect(snapshot.branches).toEqual([])
    expect(snapshot.commits).toEqual([])
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('rejects an existing directory that is not a Git repository', async () => {
    const repositoryPath = await mkdtemp(join(tmpdir(), 'treebranch not git-'))
    temporaryRepositories.push(repositoryPath)

    await expect(
      new LocalGitSource().loadRepository({ repositoryPath }),
    ).rejects.toMatchObject({ code: 'not-a-repository' })
  }, INTEGRATION_TEST_TIMEOUT_MS)
})

async function createRepository(): Promise<string> {
  const repositoryPath = await mkdtemp(join(tmpdir(), 'treebranch local git-'))
  await runGit(repositoryPath, ['init', '--initial-branch=main'])
  await runGit(repositoryPath, ['config', 'user.name', 'Treebranch Test'])
  await runGit(repositoryPath, ['config', 'user.email', 'treebranch@example.com'])
  await runGit(repositoryPath, ['config', 'commit.gpgsign', 'false'])
  return repositoryPath
}

function runGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf8', windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error)
        return
      }

      resolve(stdout)
    })
  })
}
