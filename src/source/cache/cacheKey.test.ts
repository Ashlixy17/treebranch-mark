import { describe, expect, it } from 'vitest'
import { createGitHubSnapshotCacheKey } from './cacheKey'

describe('createGitHubSnapshotCacheKey', () => {
  it('includes every query option with stable defaults', () => {
    expect(
      createGitHubSnapshotCacheKey({
        owner: 'Vuejs',
        repo: 'Core',
        branch: 'main',
      }),
    ).toBe('github:vuejs/core:main:100:true:true:false')
  })

  it('changes when repository or query options change', () => {
    const baseInput = {
      owner: 'vuejs',
      repo: 'core',
      branch: 'main',
    }

    const keys = [
      createGitHubSnapshotCacheKey(baseInput),
      createGitHubSnapshotCacheKey({ ...baseInput, repo: 'router' }),
      createGitHubSnapshotCacheKey({ ...baseInput, branch: 'dev' }),
      createGitHubSnapshotCacheKey({
        ...baseInput,
        options: { maxCommitsPerBranch: 20 },
      }),
      createGitHubSnapshotCacheKey({
        ...baseInput,
        options: { includePullRequests: false },
      }),
      createGitHubSnapshotCacheKey({
        ...baseInput,
        options: { includeContributors: false },
      }),
      createGitHubSnapshotCacheKey({
        ...baseInput,
        options: { includeTags: true },
      }),
    ]

    expect(new Set(keys)).toHaveLength(keys.length)
  })
})
