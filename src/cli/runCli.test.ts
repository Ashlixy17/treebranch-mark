import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RenderPipelineResult } from '../pipeline'
import { GitSourceError } from '../source'
import { runCli } from './runCli'

describe('runCli', () => {
  const temporaryDirectories: string[] = []

  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((path) =>
        rm(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }),
      ),
    )
  })

  it('renders a local repository and writes the SVG output', async () => {
    const directory = await createTemporaryDirectory()
    const outputPath = join(directory, 'nested', 'history.svg')
    const render = vi.fn().mockResolvedValue(pipelineResult())
    const output = createOutputCapture()

    const exitCode = await runCli(
      [
        'render',
        '.',
        '--output',
        outputPath,
        '--branch',
        'dev',
        '--max-commits',
        '25',
      ],
      { pipeline: { render }, output },
    )

    expect(exitCode).toBe(0)
    expect(render).toHaveBeenCalledWith({
      repositoryPath: '.',
      branch: 'dev',
      options: { maxCommitsPerBranch: 25 },
    })
    await expect(readFile(outputPath, 'utf8')).resolves.toBe('<svg>local</svg>')
    expect(output.stdout.join('\n')).toContain('history.svg')
    expect(output.stderr).toEqual([])
  })

  it('uses the current repository and branch.svg defaults', async () => {
    const directory = await createTemporaryDirectory()
    const render = vi.fn().mockResolvedValue(pipelineResult())
    const output = createOutputCapture()

    const exitCode = await runCli(['render', directory], {
      pipeline: { render },
      output,
      cwd: directory,
    })

    expect(exitCode).toBe(0)
    expect(render).toHaveBeenCalledWith({ repositoryPath: directory })
    await expect(readFile(join(directory, 'branch.svg'), 'utf8')).resolves.toBe(
      '<svg>local</svg>',
    )
  })

  it('prints help without constructing or calling the pipeline', async () => {
    const render = vi.fn()
    const output = createOutputCapture()

    const exitCode = await runCli(['--help'], { pipeline: { render }, output })

    expect(exitCode).toBe(0)
    expect(render).not.toHaveBeenCalled()
    expect(output.stdout.join('\n')).toContain('treebranch render <repository-path>')
  })

  it('returns a usage error for invalid max commits', async () => {
    const render = vi.fn()
    const output = createOutputCapture()

    const exitCode = await runCli(['render', '.', '--max-commits', '0'], {
      pipeline: { render },
      output,
    })

    expect(exitCode).toBe(2)
    expect(render).not.toHaveBeenCalled()
    expect(output.stderr.join('\n')).toContain('positive integer')
  })

  it('returns a source failure without writing an SVG', async () => {
    const render = vi.fn().mockRejectedValue(
      new GitSourceError('not-a-repository', 'The selected path is not a Git repository.'),
    )
    const output = createOutputCapture()

    const exitCode = await runCli(['render', '.'], { pipeline: { render }, output })

    expect(exitCode).toBe(1)
    expect(output.stderr).toEqual([
      'not-a-repository: The selected path is not a Git repository.',
    ])
  })

  async function createTemporaryDirectory(): Promise<string> {
    const directory = await mkdtemp(join(tmpdir(), 'treebranch cli-'))
    temporaryDirectories.push(directory)
    return directory
  }
})

function createOutputCapture() {
  const stdout: string[] = []
  const stderr: string[] = []

  return {
    stdout,
    stderr,
    writeOut(message: string) {
      stdout.push(message)
    },
    writeError(message: string) {
      stderr.push(message)
    },
  }
}

function pipelineResult(): RenderPipelineResult {
  return {
    svg: '<svg>local</svg>',
    snapshot: {
      source: 'local-git',
      repository: {
        id: 'local:test',
        owner: null,
        name: 'repo',
        fullName: 'repo',
        defaultBranch: 'main',
        url: null,
        description: null,
        stars: null,
      },
      branches: [],
      commits: [],
      contributors: [],
      pullRequests: [],
      fetchedAt: '2026-01-01T00:00:00.000Z',
    },
    parserWarnings: [],
    graphWarnings: [],
  }
}
