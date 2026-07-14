import { describe, expect, it } from 'vitest'
import type { Layout } from '../layout'
import type { GitSource, GitSourceInput, GitSourceSnapshot } from '../source'
import { GitSourceError } from '../source'
import { RenderPipeline } from './RenderPipeline'

describe('RenderPipeline', () => {
  it('renders a source snapshot into a standalone SVG string', async () => {
    const snapshot = snapshotFixture()
    const source = new FakeSource(snapshot)
    const pipeline = new RenderPipeline({ source })
    const input: GitSourceInput = {
      owner: 'example',
      repo: 'project',
      branch: 'main',
      options: {
        maxCommitsPerBranch: 20,
      },
    }

    const result = await pipeline.render(input)

    expect(source.lastInput).toEqual(input)
    expect(result.snapshot).toBe(snapshot)
    expect(result.parserWarnings).toEqual([])
    expect(result.graphWarnings).toEqual([])
    expect(result.svg).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
    expect(result.svg).toContain('<line')
    expect(result.svg).toContain('<circle')
    expect(result.svg).toContain('aaaaaaa')
    expect(result.svg).toContain('bbbbbbb')
  })

  it('loads the repository exactly once when rendering an input', async () => {
    const source = new FakeSource(snapshotFixture())
    const pipeline = new RenderPipeline({ source })

    await pipeline.render({ owner: 'example', repo: 'project' })

    expect(source.loadCount).toBe(1)
  })

  it('renders a supplied snapshot without loading the source', async () => {
    const source = new ThrowingSource(new Error('must not load'))
    const snapshot = snapshotFixture()

    const result = await new RenderPipeline({ source }).renderSnapshot(snapshot)

    expect(result.snapshot).toBe(snapshot)
    expect(result.svg).toContain('2026-01')
  })

  it('uses TimelineLayout when no layout is supplied', async () => {
    const result = await new RenderPipeline({ source: new FakeSource(snapshotFixture()) }).render({
      owner: 'example',
      repo: 'project',
    })

    expect(result.svg).toContain('2026-01')
  })

  it('uses the supplied layout override when rendering a snapshot', () => {
    const layout: Layout = {
      layout: () => ({
        nodes: [],
        edges: [],
        groups: [{ id: 'override', label: 'Layout override', startX: 0, endX: 0 }],
      }),
    }
    const pipeline = new RenderPipeline({ source: new FakeSource(snapshotFixture()) })

    const result = pipeline.renderSnapshot(snapshotFixture(), { layout })

    expect(result.svg).toContain('>Layout override</text>')
  })

  it('keeps missing branch heads as graph warnings and still returns SVG', async () => {
    const snapshot = snapshotFixture({
      branches: [
        {
          name: 'main',
          headSha: 'missing-head',
          isDefault: true,
          url: 'https://github.com/example/project/tree/main',
        },
      ],
    })
    const pipeline = new RenderPipeline({ source: new FakeSource(snapshot) })

    const result = await pipeline.render({ owner: 'example', repo: 'project' })

    expect(result.graphWarnings).toEqual([
      {
        type: 'missing-branch-head',
        branchName: 'main',
        headSha: 'missing-head',
        message: 'Branch main points to missing head missing-head.',
      },
    ])
    expect(result.svg).toContain('viewBox="0 0 48 48"')
  })

  it('passes source errors through to the caller', async () => {
    const pipeline = new RenderPipeline({
      source: new ThrowingSource(new GitSourceError('rate-limited', 'Rate limit exceeded.')),
    })

    await expect(pipeline.render({ owner: 'example', repo: 'project' })).rejects.toMatchObject({
      code: 'rate-limited',
    })
  })

  it('does not require token on render input', async () => {
    const source = new FakeSource(snapshotFixture())
    const pipeline = new RenderPipeline({ source })

    await pipeline.render({
      owner: 'example',
      repo: 'project',
    })

    expect(source.lastInput).toEqual({
      owner: 'example',
      repo: 'project',
    })
  })

  it('does not serialize github token into pipeline output models', async () => {
    const token = 'ghp_test_token_for_leak_check'
    const pipeline = new RenderPipeline({ source: new FakeSource(snapshotFixture()) })

    const result = await pipeline.render({
      owner: 'example',
      repo: 'project',
    })

    expect(JSON.stringify(result.snapshot)).not.toContain(token)
    expect(JSON.stringify(result.snapshot)).not.toContain('ghp_')
    expect(JSON.stringify(result)).not.toContain(token)
  })
})

class FakeSource implements GitSource {
  readonly kind = 'github-api'
  lastInput: GitSourceInput | null = null
  loadCount = 0
  private readonly snapshot: GitSourceSnapshot

  constructor(snapshot: GitSourceSnapshot) {
    this.snapshot = snapshot
  }

  async loadRepository(input: GitSourceInput): Promise<GitSourceSnapshot> {
    this.loadCount += 1
    this.lastInput = input
    return this.snapshot
  }
}

class ThrowingSource implements GitSource {
  readonly kind = 'github-api'
  private readonly error: Error

  constructor(error: Error) {
    this.error = error
  }

  async loadRepository(): Promise<GitSourceSnapshot> {
    throw this.error
  }
}

function snapshotFixture(overrides: Partial<GitSourceSnapshot> = {}): GitSourceSnapshot {
  return {
    source: 'github-api',
    repository: {
      id: '1',
      owner: 'example',
      name: 'project',
      fullName: 'example/project',
      defaultBranch: 'main',
      url: 'https://github.com/example/project',
      description: null,
      stars: 0,
    },
    branches: [
      {
        name: 'main',
        headSha: 'bbbbbbb2222222222222222222222222222222222',
        isDefault: true,
        url: 'https://github.com/example/project/tree/main',
      },
    ],
    commits: [
      commitFixture({
        sha: 'bbbbbbb2222222222222222222222222222222222',
        parents: ['aaaaaaa1111111111111111111111111111111111'],
        message: 'Add second commit',
        committedAt: '2026-01-02T00:00:00Z',
      }),
      commitFixture({
        sha: 'aaaaaaa1111111111111111111111111111111111',
        parents: [],
        message: 'Initial commit',
        committedAt: '2026-01-01T00:00:00Z',
      }),
    ],
    contributors: [],
    pullRequests: [],
    releases: [],
    tags: [],
    warnings: [],
    pullRequestCapacity: { requested: 20, mergedLoaded: 0, openLoaded: 0 },
    fetchedAt: '2026-01-03T00:00:00Z',
    ...overrides,
  }
}

function commitFixture(input: {
  sha: string
  parents: string[]
  message: string
  committedAt: string
}) {
  return {
    sha: input.sha,
    parents: input.parents,
    message: input.message,
    author: {
      name: 'Example Author',
      email: 'author@example.com',
      login: 'author',
      avatarUrl: null,
      profileUrl: null,
    },
    committer: {
      name: 'Example Committer',
      email: 'committer@example.com',
      login: 'committer',
      avatarUrl: null,
      profileUrl: null,
    },
    authoredAt: input.committedAt,
    committedAt: input.committedAt,
    url: `https://github.com/example/project/commit/${input.sha}`,
  }
}
