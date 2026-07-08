import { describe, expect, it } from 'vitest'
import { GitSourceError, parseRepositoryInput } from './types'
import type { GitSourceInput } from './types'

describe('parseRepositoryInput', () => {
  it('parses owner/repo shorthand', () => {
    expect(parseRepositoryInput('octo/repo')).toEqual({
      owner: 'octo',
      repo: 'repo',
    })
  })

  it('parses GitHub repository URLs', () => {
    expect(parseRepositoryInput('https://github.com/octo/repo.git')).toEqual({
      owner: 'octo',
      repo: 'repo',
    })
  })

  it('rejects unsupported repository identifiers', () => {
    expect(() => parseRepositoryInput('not a repository')).toThrow(GitSourceError)
  })

  it('does not accept github token on GitSourceInput', () => {
    const input: GitSourceInput = {
      owner: 'octo',
      repo: 'repo',
      // @ts-expect-error token must stay out of source input
      token: 'ghp_test_token_for_leak_check',
    }

    expect(input).toMatchObject({
      owner: 'octo',
      repo: 'repo',
    })
  })
})
