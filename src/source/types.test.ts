import { describe, expect, it } from 'vitest'
import { GitSourceError, parseRepositoryInput } from './types'

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
})
