# GitHub Token Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support optional GitHub Personal Access Token authentication so browser users can raise GitHub API quota without leaking token data into public data models or downstream pipeline layers.

**Architecture:** Token support is limited to Browser UI, `GitHubApiSource`, `GitHubRestClient`, and `GitHubRestClientOptions`. `RenderPipeline.render(input)` continues to accept only `GitSourceInput`; Parser, Graph Builder, Layout, RenderModel, and SVG Renderer remain unaware of authentication. UX improvements such as authentication state and remaining quota are Source/UI concerns only.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Vitest 4, Oxlint, browser `fetch`, browser `localStorage`.

## Global Constraints

- Token may appear only in UI input, localStorage key `treebranch.github.token`, `GitHubApiSource`, `GitHubRestClient`, and `GitHubRestClientOptions`.
- Token must not enter `GitSourceInput`, `GitSourceSnapshot`, `RenderPipeline.render(input)`, `RenderPipelineResult`, Parser, Graph Builder, Layout, RenderModel, or SVG Renderer.
- Token must not appear in Snapshot JSON debug output.
- `Authorization: Bearer <token>` is sent only when the trimmed token is non-empty.
- Empty or whitespace token behaves as anonymous GitHub API access.
- HTTP `401` maps to `bad-credentials`.
- HTTP `403` maps to `rate-limited`.
- HTTP `404` maps to `not-found`.
- Network failure maps to `network-error`.
- Browser token persistence is allowed only through `localStorage` key `treebranch.github.token`.
- Clearing the token input removes `treebranch.github.token`.
- README, ADR, and release checklist must be updated because this sprint intentionally changes the earlier "do not write token to localStorage" decision.
- Rate-limit status is useful but secondary. If it threatens the Token security scope, defer detailed remaining-quota UI to a later v0.1.x task.

---

## File Structure

- Modify: `src/source/types.ts`
  - Add `bad-credentials` to `GitSourceErrorCode`.
- Modify: `src/source/github/githubRestClient.ts`
  - Add `token?: string` to `GitHubRestClientOptions`.
  - Normalize token.
  - Add `Authorization` header only when token exists.
  - Map `401` to `bad-credentials`.
  - Optionally capture GitHub rate-limit headers for Task 5.
- Modify: `src/source/github/GitHubApiSource.ts`
  - Accept configured `GitHubRestClient`.
  - Optionally expose GitHub API status for Task 5.
- Modify: `src/source/index.ts`
  - Export `GitHubRestClient` and optional GitHub API status types if needed by UI.
- Modify: `src/source/github/GitHubApiSource.test.ts`
  - Add Token header, anonymous request, `401`, and optional status tests.
- Modify: `src/source/types.test.ts`
  - Add compile-time guard that `GitSourceInput` does not accept token.
- Modify: `src/pipeline/RenderPipeline.test.ts`
  - Add tests proving token does not serialize through snapshot or pipeline result.
- Modify: `src/ui/sourceErrorMessages.test.ts`
  - Add `bad-credentials` message coverage.
- Modify: `src/App.tsx`
  - Add optional Token input.
  - Read/write/delete `treebranch.github.token`.
  - Wire Token into `GitHubRestClient`.
  - Add focused auth/rate-limit UX.
- Modify: `src/App.css`
  - Style Token input and optional API status display.
- Modify: `docs/adr/0005-token-security.md`
  - Record localStorage persistence decision.
- Modify: `docs/releases/v0.1.0-alpha-checklist.md`
  - Update Token persistence checklist.
- Modify: `README.md`
  - Update Token security and usage notes.

---

### Task 1: GitHubRestClient Supports Token

**Goal:** Make the lowest HTTP layer support GitHub authentication while keeping anonymous requests compatible.

**Files:**
- Modify: `src/source/types.ts`
- Modify: `src/source/github/githubRestClient.ts`
- Modify: `src/source/github/GitHubApiSource.test.ts`
- Modify: `src/ui/sourceErrorMessages.test.ts`

**Interfaces:**
- Consumes:
  ```ts
  export interface GitHubRestClientOptions {
    fetcher?: typeof fetch
    token?: string
  }
  ```
- Produces:
  ```ts
  export type GitSourceErrorCode =
    | 'not-found'
    | 'rate-limited'
    | 'network-error'
    | 'unsupported-source'
    | 'bad-credentials'
    | 'unknown'
  ```

- [ ] **Step 1: Write failing tests for Token header behavior**

Add to `src/source/github/GitHubApiSource.test.ts`:

```ts
it('sends an authorization header when token is provided', async () => {
  let headers: Headers
  const client = new GitHubRestClient({
    token: 'ghp_test_token',
    fetcher: async (_input, init) => {
      headers = new Headers(init?.headers)
      return new Response(JSON.stringify(repositoryFixture), { status: 200 })
    },
  })

  await client.getRepository('octo', 'repo')

  expect(headers!.get('authorization')).toBe('Bearer ghp_test_token')
})

it('does not send an authorization header when token is missing', async () => {
  let headers: Headers
  const client = new GitHubRestClient({
    fetcher: async (_input, init) => {
      headers = new Headers(init?.headers)
      return new Response(JSON.stringify(repositoryFixture), { status: 200 })
    },
  })

  await client.getRepository('octo', 'repo')

  expect(headers!.has('authorization')).toBe(false)
})

it('ignores empty or whitespace tokens', async () => {
  let headers: Headers
  const client = new GitHubRestClient({
    token: '   ',
    fetcher: async (_input, init) => {
      headers = new Headers(init?.headers)
      return new Response(JSON.stringify(repositoryFixture), { status: 200 })
    },
  })

  await client.getRepository('octo', 'repo')

  expect(headers!.has('authorization')).toBe(false)
})
```

- [ ] **Step 2: Write failing test for `401 -> bad-credentials`**

Add to `src/source/github/GitHubApiSource.test.ts`:

```ts
it('maps 401 responses to bad-credentials source errors', async () => {
  const client = new GitHubRestClient({
    fetcher: async () => new Response('{}', { status: 401 }),
  })

  await expect(client.getRepository('octo', 'repo')).rejects.toMatchObject({
    code: 'bad-credentials',
    status: 401,
  })
})
```

- [ ] **Step 3: Write failing formatter test**

Add to `src/ui/sourceErrorMessages.test.ts`:

```ts
it('formats bad credential errors with the selected language message', () => {
  const messages: Record<GitSourceErrorCode, string> = {
    'not-found': 'Repository not found.',
    'rate-limited': 'GitHub API rate limit exceeded.',
    'network-error': 'Network request failed.',
    'unsupported-source': 'Unsupported source.',
    'bad-credentials': 'GitHub Token is invalid.',
    unknown: 'Repository could not be loaded.',
  }

  expect(formatSourceError('bad-credentials', messages)).toBe(
    'bad-credentials: GitHub Token is invalid.',
  )
})
```

- [ ] **Step 4: Run focused tests and confirm failure**

Run:

```bash
npm test -- src/source/github/GitHubApiSource.test.ts src/ui/sourceErrorMessages.test.ts
```

Expected: FAIL because `token` and `bad-credentials` are not implemented yet.

- [ ] **Step 5: Implement `bad-credentials` and Token header**

Update `src/source/types.ts`:

```ts
export type GitSourceErrorCode =
  | 'not-found'
  | 'rate-limited'
  | 'network-error'
  | 'unsupported-source'
  | 'bad-credentials'
  | 'unknown'
```

Update `src/source/github/githubRestClient.ts`:

```ts
export interface GitHubRestClientOptions {
  fetcher?: typeof fetch
  token?: string
}

export class GitHubRestClient {
  private readonly fetcher: typeof fetch
  private readonly token: string | null

  constructor(options: GitHubRestClientOptions = {}) {
    this.fetcher = options.fetcher ?? ((input, init) => globalThis.fetch(input, init))
    this.token = normalizeToken(options.token)
  }

  private async get<T>(path: string): Promise<T> {
    let response: Response
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`
    }

    try {
      response = await this.fetcher(`${GITHUB_API_BASE_URL}${path}`, {
        headers,
      })
    } catch (error) {
      throw new GitSourceError(
        'network-error',
        error instanceof Error ? error.message : 'Network request failed.',
      )
    }

    if (!response.ok) {
      throw mapGitHubResponseError(response)
    }

    return response.json() as Promise<T>
  }
}

function normalizeToken(token: string | undefined): string | null {
  const trimmed = token?.trim()
  return trimmed ? trimmed : null
}
```

Update `mapGitHubResponseError`:

```ts
if (response.status === 401) {
  return new GitSourceError(
    'bad-credentials',
    'GitHub authentication failed. Please verify your Personal Access Token.',
    401,
  )
}

if (response.status === 403) {
  return new GitSourceError('rate-limited', 'GitHub API rate limit exceeded.', 403)
}
```

- [ ] **Step 6: Run focused tests and confirm pass**

Run:

```bash
npm test -- src/source/github/GitHubApiSource.test.ts src/ui/sourceErrorMessages.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/source/types.ts src/source/github/githubRestClient.ts src/source/github/GitHubApiSource.test.ts src/ui/sourceErrorMessages.test.ts
git commit -m "feat(github): support optional token auth"
```

---

### Task 2: Browser Token UI

**Goal:** Add Token input and browser persistence only. This task does not wire the Token into real GitHub requests yet.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces local UI state and persistence key:
  ```ts
  const TOKEN_STORAGE_KEY = 'treebranch.github.token'
  ```

- [ ] **Step 1: Add Token UI state**

Update `src/App.tsx` imports:

```ts
import { useEffect, useState } from 'react'
```

Inside `App`, add:

```ts
const TOKEN_STORAGE_KEY = 'treebranch.github.token'
const [githubToken, setGithubToken] = useState('')
```

Add startup restore:

```ts
useEffect(() => {
  const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)
  if (storedToken) {
    setGithubToken(storedToken)
  }
}, [])
```

Add change handler:

```ts
function handleTokenChange(value: string) {
  setGithubToken(value)
  const trimmed = value.trim()

  if (trimmed) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed)
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  }
}
```

- [ ] **Step 2: Add translation fields**

Extend `Translation`:

```ts
githubToken: string
githubTokenHint: string
```

Add English:

```ts
githubToken: 'GitHub Token (Optional)',
githubTokenHint: 'Stored locally and sent only to the GitHub API.',
```

Add Simplified Chinese:

```ts
githubToken: 'GitHub Token（可选）',
githubTokenHint: '仅保存在本地，并且只会发送给 GitHub API。',
```

Add Japanese:

```ts
githubToken: 'GitHub Token（任意）',
githubTokenHint: 'ローカルに保存され、GitHub API にのみ送信されます。',
```

- [ ] **Step 3: Render Token input**

Inside the form, between repository and branch fields, add:

```tsx
<label className="field token-field" htmlFor="github-token">
  <span>{t.githubToken}</span>
  <input
    id="github-token"
    type="password"
    value={githubToken}
    onChange={(event) => handleTokenChange(event.target.value)}
    placeholder="ghp_xxxxxxxxx"
    autoComplete="off"
  />
  <small>{t.githubTokenHint}</small>
</label>
```

- [ ] **Step 4: Add CSS**

Update `src/App.css`:

```css
.token-field {
  min-width: min(100%, 280px);
}

.field small {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.35;
}
```

If the current form layout becomes cramped, update the form grid:

```css
.repo-form {
  grid-template-columns: minmax(220px, 1fr) minmax(220px, 0.55fr) minmax(140px, 0.35fr) auto;
}
```

- [ ] **Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Manual browser persistence check**

Run:

```bash
npm run dev
```

Expected behavior:

- First load reads `treebranch.github.token` if present.
- Editing Token input writes trimmed value to `treebranch.github.token`.
- Clearing Token input removes `treebranch.github.token`.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/App.css
git commit -m "feat(app): add github token input"
```

---

### Task 3: Source Integrates Token Without Polluting Pipeline

**Goal:** Wire the Browser Token into `GitHubApiSource -> GitHubRestClient -> GitHub API` while keeping `GitSourceInput`, `RenderPipeline`, and downstream layers unchanged.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/source/index.ts`
- Modify: `src/pipeline/RenderPipeline.test.ts`

**Interfaces:**
- Consumes:
  ```ts
  new GitHubRestClient({ token: githubToken })
  new GitHubApiSource({ client })
  new RenderPipeline({ source })
  ```
- Produces: real GitHub API requests use the configured Token.

- [ ] **Step 1: Export GitHubRestClient**

Update `src/source/index.ts`:

```ts
export { GitHubRestClient } from './github/githubRestClient'
```

- [ ] **Step 2: Wire Token into Source construction**

Update `src/App.tsx` import:

```ts
import { GitHubApiSource, GitHubRestClient, GitSourceError, parseRepositoryInput } from './source'
```

Replace:

```ts
const pipeline = new RenderPipeline({
  source: new GitHubApiSource(),
})
```

with:

```ts
const source = new GitHubApiSource({
  client: new GitHubRestClient({
    token: githubToken,
  }),
})
const pipeline = new RenderPipeline({ source })
```

Do not add `token` to the object passed to `pipeline.render`.

- [ ] **Step 3: Add pipeline boundary test**

Add to `src/pipeline/RenderPipeline.test.ts`:

```ts
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
```

- [ ] **Step 4: Run focused tests and build**

Run:

```bash
npm test -- src/pipeline/RenderPipeline.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/source/index.ts src/pipeline/RenderPipeline.test.ts
git commit -m "feat(app): wire token into github source"
```

---

### Task 4: Security Tests

**Goal:** Lock the Token boundary with automated tests so future changes cannot accidentally leak Token into public models.

**Files:**
- Modify: `src/source/types.test.ts`
- Modify: `src/pipeline/RenderPipeline.test.ts`
- Modify: `src/source/github/GitHubApiSource.test.ts`
- Modify: `docs/adr/0005-token-security.md`
- Modify: `docs/releases/v0.1.0-alpha-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: `GitSourceInput`, `GitSourceSnapshot`, `RenderPipelineResult`, `GitHubRestClientOptions`
- Produces: security regression tests and updated docs.

- [ ] **Step 1: Add compile-time guard for GitSourceInput**

Add to `src/source/types.test.ts`:

```ts
it('does not accept github token on GitSourceInput', () => {
  const input = {
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
```

- [ ] **Step 2: Add serialization guard for pipeline output**

Add to `src/pipeline/RenderPipeline.test.ts`:

```ts
it('does not serialize github token into pipeline output models', async () => {
  const token = 'ghp_test_token_for_leak_check'
  const snapshot = snapshotFixture()
  const pipeline = new RenderPipeline({ source: new FakeSource(snapshot) })

  const result = await pipeline.render({
    owner: 'example',
    repo: 'project',
  })

  expect(JSON.stringify(result.snapshot)).not.toContain(token)
  expect(JSON.stringify(result)).not.toContain(token)
  expect(JSON.stringify(result.snapshot)).not.toContain('ghp_')
})
```

- [ ] **Step 3: Assert localStorage key is fixed in docs and UI**

Add a testable exported constant only if needed for testability. Preferred minimal approach:

```ts
const TOKEN_STORAGE_KEY = 'treebranch.github.token'
```

Keep the value exactly `treebranch.github.token`.

- [ ] **Step 4: Update ADR and release checklist**

Update `docs/adr/0005-token-security.md` Decision section:

```md
The browser UI may persist the token in `localStorage` under `treebranch.github.token` for user convenience.

This is the only permitted persistence location.

The token must be removed from `localStorage` when the user clears the token input.
```

Update `docs/releases/v0.1.0-alpha-checklist.md`:

```md
- [ ] Token is written only to `localStorage` key `treebranch.github.token`.
- [ ] Clearing the token input removes `treebranch.github.token`.
```

Update `README.md` Token section:

```md
- Token 只允许写入 `localStorage` 的 `treebranch.github.token`
- 用户清空 Token 输入框时必须删除该 localStorage 项
```

- [ ] **Step 5: Run security-focused verification**

Run:

```bash
npm test -- src/source/types.test.ts src/pipeline/RenderPipeline.test.ts src/source/github/GitHubApiSource.test.ts
rg -n "Token 不写入 `localStorage`|Do not save the token to `localStorage`|Token is not written to `localStorage`" README.md docs
```

Expected:

- Tests PASS.
- `rg` prints no matches.

- [ ] **Step 6: Commit**

```bash
git add src/source/types.test.ts src/pipeline/RenderPipeline.test.ts src/source/github/GitHubApiSource.test.ts docs/adr/0005-token-security.md docs/releases/v0.1.0-alpha-checklist.md README.md
git commit -m "test: lock github token security boundary"
```

---

### Task 5: UX for Auth and Rate Limit Status

**Goal:** Improve user-facing feedback after the security-critical path is in place.

**Files:**
- Modify: `src/source/github/githubRestClient.ts`
- Modify: `src/source/github/GitHubApiSource.ts`
- Modify: `src/source/github/GitHubApiSource.test.ts`
- Modify: `src/source/index.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Produces:
  ```ts
  export interface GitHubRateLimitStatus {
    authentication: 'anonymous' | 'authenticated'
    limit: number | null
    remaining: number | null
    resetAt: string | null
  }

  getRateLimitStatus(): GitHubRateLimitStatus | null
  ```

- [ ] **Step 1: Add `bad-credentials` messages in all languages**

In `src/App.tsx`, add to English:

```ts
'bad-credentials': 'Authentication failed. Please verify your GitHub Personal Access Token.',
```

Update English rate-limit text:

```ts
'rate-limited': 'GitHub API rate limit exceeded. Configure a Personal Access Token or try again later.',
```

Add to Simplified Chinese:

```ts
'bad-credentials': 'GitHub Token 无效，请检查后重试。',
'rate-limited': 'GitHub API 已达到限额，可配置 Personal Access Token 后重试。',
```

Add to Japanese:

```ts
'bad-credentials': 'GitHub Token が無効です。確認してから再試行してください。',
'rate-limited': 'GitHub API のレート制限に達しました。Personal Access Token を設定して再試行してください。',
```

- [ ] **Step 2: Write rate-limit status tests**

Add to `src/source/github/GitHubApiSource.test.ts`:

```ts
it('captures GitHub rate limit response headers for anonymous requests', async () => {
  const client = new GitHubRestClient({
    fetcher: async () =>
      new Response(JSON.stringify(repositoryFixture), {
        status: 200,
        headers: {
          'x-ratelimit-limit': '60',
          'x-ratelimit-remaining': '12',
          'x-ratelimit-reset': '1783500000',
        },
      }),
  })

  await client.getRepository('octo', 'repo')

  expect(client.getRateLimitStatus()).toEqual({
    authentication: 'anonymous',
    limit: 60,
    remaining: 12,
    resetAt: '2026-07-08T08:40:00.000Z',
  })
})

it('marks rate limit status as authenticated when token exists', async () => {
  const client = new GitHubRestClient({
    token: 'ghp_test_token',
    fetcher: async () =>
      new Response(JSON.stringify(repositoryFixture), {
        status: 200,
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '4978',
          'x-ratelimit-reset': '1783500000',
        },
      }),
  })

  await client.getRepository('octo', 'repo')

  expect(client.getRateLimitStatus()).toMatchObject({
    authentication: 'authenticated',
    limit: 5000,
    remaining: 4978,
  })
})
```

- [ ] **Step 3: Implement Source rate-limit status**

Add to `src/source/github/githubRestClient.ts`:

```ts
export interface GitHubRateLimitStatus {
  authentication: 'anonymous' | 'authenticated'
  limit: number | null
  remaining: number | null
  resetAt: string | null
}
```

Add method:

```ts
private rateLimitStatus: GitHubRateLimitStatus | null = null

getRateLimitStatus(): GitHubRateLimitStatus | null {
  return this.rateLimitStatus
}
```

After receiving any `response`, set:

```ts
this.rateLimitStatus = readRateLimitStatus(response.headers, this.token !== null)
```

Add helpers:

```ts
function readRateLimitStatus(headers: Headers, authenticated: boolean): GitHubRateLimitStatus {
  const reset = parseHeaderNumber(headers.get('x-ratelimit-reset'))

  return {
    authentication: authenticated ? 'authenticated' : 'anonymous',
    limit: parseHeaderNumber(headers.get('x-ratelimit-limit')),
    remaining: parseHeaderNumber(headers.get('x-ratelimit-remaining')),
    resetAt: reset === null ? null : new Date(reset * 1000).toISOString(),
  }
}

function parseHeaderNumber(value: string | null): number | null {
  if (value === null) {
    return null
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}
```

Add to `src/source/github/GitHubApiSource.ts`:

```ts
import type { GitHubRateLimitStatus } from './githubRestClient'

getRateLimitStatus(): GitHubRateLimitStatus | null {
  return this.client.getRateLimitStatus()
}
```

Export type in `src/source/index.ts`:

```ts
export { GitHubRestClient, type GitHubRateLimitStatus } from './github/githubRestClient'
```

- [ ] **Step 4: Add API status UI**

Extend `Translation`:

```ts
apiStatus: string
authenticated: string
anonymous: string
remaining: string
unknownRateLimit: string
```

Add state:

```ts
const [rateLimitStatus, setRateLimitStatus] = useState<GitHubRateLimitStatus | null>(null)
```

At submit start:

```ts
setRateLimitStatus(null)
```

After successful render:

```ts
setRateLimitStatus(source.getRateLimitStatus())
```

Render a simple card:

```tsx
<div className="run-card api-card">
  <span>{t.apiStatus}</span>
  {rateLimitStatus ? (
    <strong>
      {rateLimitStatus.authentication === 'authenticated' ? t.authenticated : t.anonymous}
      {rateLimitStatus.remaining !== null && rateLimitStatus.limit !== null
        ? ` · ${t.remaining}: ${rateLimitStatus.remaining} / ${rateLimitStatus.limit}`
        : ''}
    </strong>
  ) : (
    <strong>{t.unknownRateLimit}</strong>
  )}
</div>
```

Add CSS:

```css
.api-card strong {
  line-height: 1.3;
}
```

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
npm test -- src/source/github/GitHubApiSource.test.ts src/ui/sourceErrorMessages.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 6: Manual browser check**

Run:

```bash
npm run dev
```

Expected:

- Invalid token shows `bad-credentials`.
- Rate-limited response suggests configuring a Personal Access Token.
- Anonymous request shows `Anonymous` when headers are available.
- Token request shows `Authenticated` when headers are available.
- Remaining quota displays as `Remaining: current / limit` when headers are available.

- [ ] **Step 7: Commit**

```bash
git add src/source/github/githubRestClient.ts src/source/github/GitHubApiSource.ts src/source/github/GitHubApiSource.test.ts src/source/index.ts src/App.tsx src/App.css
git commit -m "feat(app): show github api auth status"
```

---

## Final Verification

- [ ] **Step 1: Run full tests**

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run production build**

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: Oxlint reports no errors.

- [ ] **Step 4: Check git status**

```bash
git status -sb
```

Expected: clean working tree after commits.

## Subagent Execution Notes

Use `superpowers:subagent-driven-development`.

Recommended review gates:

1. Task 1 review focuses on `GitHubRestClient` behavior and error mapping.
2. Task 2 review focuses on UI persistence only and should reject Source/Pipeline changes.
3. Task 3 review focuses on integration boundaries and should reject Token fields in `GitSourceInput` or `RenderPipeline.render`.
4. Task 4 review focuses on security tests and documentation consistency.
5. Task 5 review focuses on UX and should reject changes that move status into `GitSourceSnapshot` or `RenderPipelineResult`.

## Self-Review

Spec coverage:

- Optional Token HTTP support: Task 1.
- Browser Token input and localStorage: Task 2.
- Browser to Source to REST client integration: Task 3.
- Security tests: Task 4.
- Authentication and rate-limit UX: Task 5.
- Full verification: Final Verification.

Placeholder scan:

- The plan contains no intentionally incomplete implementation steps.

Type consistency:

- `GitHubRestClientOptions.token` is the only Token-bearing TypeScript option.
- `bad-credentials` is part of `GitSourceErrorCode`.
- Rate-limit status stays Source/UI-specific and does not enter `GitSourceSnapshot` or `RenderPipelineResult`.
