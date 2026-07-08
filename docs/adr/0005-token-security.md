# ADR 0005: GitHub Token Security

## Context

Anonymous GitHub REST API usage can hit rate limits quickly. v0.1.0-alpha needs optional GitHub Token support so users can generate real browser demos more reliably.

Token support introduces security risk if authentication data leaks into public data models, debug JSON, persisted storage, or renderer output.

## Decision

GitHub Token belongs only to the GitHub HTTP client boundary.

Recommended shape:

```ts
interface GitHubRestClientOptions {
  token?: string
}
```

Token may be persisted by the browser UI only in `localStorage` under the fixed key
`treebranch.github.token` for user convenience. This is the only permitted persistence
location.

The token must be removed from `localStorage` when the user clears the token input.

Token must not enter:

- `GitSourceInput`
- `GitSourceSnapshot`
- `RenderPipeline.render(input)`
- `RenderPipelineResult`
- Parser
- Graph Builder
- Layout
- RenderModel
- Renderer
- Snapshot JSON output
- README examples
- URL parameters
- `sessionStorage`

All token, cookie, and authentication constraints must have automated tests.

GitHub `401` responses should map to `bad-credentials`.

## Consequences

The Pipeline remains source-neutral and authentication-neutral.

Local Git, GitLab, and future sources do not need to know GitHub token concepts.

Security-sensitive behavior is protected by tests instead of documentation alone.

## Alternatives Considered

Adding `token?: string` to `GitSourceInput` was rejected because it would pollute the common Source interface with GitHub-specific authentication data.

Adding token support to `RenderPipeline.render(input)` was rejected because Pipeline should orchestrate layers, not manage provider authentication.
