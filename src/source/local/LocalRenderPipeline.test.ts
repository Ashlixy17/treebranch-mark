import { describe, expect, expectTypeOf, it } from 'vitest'
import { RenderPipeline } from '../../pipeline'
import { LocalGitSource } from './LocalGitSource'
import type { GitCommandResult, GitCommandRunner } from './GitCommandRunner'
import type { LocalGitSourceInput } from './types'

describe('Local Git RenderPipeline', () => {
  it('infers local input and renders a LocalGitSource snapshot end to end', async () => {
    const source = new LocalGitSource({ runner: new SingleCommitGitRunner() })
    const pipeline = new RenderPipeline({ source })

    expectTypeOf(pipeline.render).parameter(0).toEqualTypeOf<LocalGitSourceInput>()

    const result = await pipeline.render({ repositoryPath: '.' })

    expect(result.snapshot.source).toBe('local-git')
    expect(result.snapshot.branches).toHaveLength(1)
    expect(result.parserWarnings).toEqual([])
    expect(result.graphWarnings).toEqual([])
    expect(result.svg).toContain('<svg')
    expect(result.svg).toContain('abc1234')
    expect(result.svg).toContain('2026-01')
  })
})

class SingleCommitGitRunner implements GitCommandRunner {
  run(args: string[]): Promise<GitCommandResult> {
    if (args[0] === 'rev-parse' && args[1] === '--git-dir') {
      return this.result('')
    }

    if (args[0] === 'rev-parse' && args[1] === '--is-bare-repository') {
      return this.result('false\n')
    }

    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') {
      return this.result(`${process.cwd()}\n`)
    }

    if (args[0] === 'for-each-ref') {
      return this.result('main\0abc1234567890\n')
    }

    if (args[0] === 'symbolic-ref') {
      return this.result('main\n')
    }

    if (args[0] === 'log') {
      return this.result([
        'abc1234567890',
        '',
        'Local Author',
        'author@example.com',
        '2026-01-01T00:00:00+00:00',
        'Local Committer',
        'committer@example.com',
        '2026-01-01T00:01:00+00:00',
        'Local pipeline commit',
        '',
      ].join('\0'))
    }

    return Promise.reject(new Error(`Unexpected Git command: ${args.join(' ')}`))
  }

  private result(stdout: string): Promise<GitCommandResult> {
    return Promise.resolve({ stdout, stderr: '', exitCode: 0 })
  }
}
