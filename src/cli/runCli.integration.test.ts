import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCli } from './runCli'

const INTEGRATION_TEST_TIMEOUT_MS = 20_000

describe('treebranch CLI integration', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) =>
        rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      ),
    )
  }, INTEGRATION_TEST_TIMEOUT_MS)

  it('renders a real local Git repository to an SVG file', async () => {
    const repositoryPath = await mkdtemp(join(tmpdir(), 'treebranch cli repository-'))
    const outputDirectory = await mkdtemp(join(tmpdir(), 'treebranch cli output-'))
    const outputPath = join(outputDirectory, 'history.svg')
    temporaryDirectories.push(repositoryPath, outputDirectory)

    await runGit(repositoryPath, ['init', '--initial-branch=main'])
    await runGit(repositoryPath, ['config', 'user.name', 'Treebranch CLI Test'])
    await runGit(repositoryPath, ['config', 'user.email', 'cli@example.com'])
    await runGit(repositoryPath, ['config', 'commit.gpgsign', 'false'])
    await writeFile(join(repositoryPath, 'README.md'), '# CLI fixture\n')
    await runGit(repositoryPath, ['add', 'README.md'])
    await runGit(repositoryPath, ['commit', '-m', 'Initial CLI commit'])

    const exitCode = await runCli(['render', repositoryPath, '--output', outputPath], {
      output: {
        writeOut() {},
        writeError() {},
      },
    })

    expect(exitCode).toBe(0)
    const svg = await readFile(outputPath, 'utf8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('<circle')
    expect(svg).toContain('<text')
  }, INTEGRATION_TEST_TIMEOUT_MS)
})

function runGit(cwd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd, encoding: 'utf8', windowsHide: true }, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
