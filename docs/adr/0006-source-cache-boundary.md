# ADR 0006: Source Cache Boundary

## Context

GitHub API rate limits can block repeated demo requests. v0.1.0-alpha needs a simple cache to reduce duplicate Source work and make browser demos more reliable.

Cache must not pollute Parser, Pipeline, Layout, RenderModel, or Renderer boundaries.

## Decision

Cache belongs to Source.

The first cache is a Source-level Snapshot Cache:

```text
GitHubApiSource
  |
  v
SourceCache<GitSourceSnapshot>
```

Pipeline does not know cache exists.

Parser, Graph Builder, Layout, RenderModel, and Renderer do not know cache exists.

The MVP implementation should use an in-memory cache with a short TTL, such as 5 minutes.

Suggested interface:

```ts
interface SourceCache<TValue> {
  get(key: string): TValue | undefined
  set(key: string, value: TValue): void
  clear(): void
}
```

Cache key should include source parameters such as owner, repo, branch, max commits, and include flags.

Token must not be part of the cache key because token authenticates the request; it does not define the public repository snapshot.

HTTP cache with ETag, `If-None-Match`, and `304 Not Modified` is deferred.

## Consequences

Each Source can decide whether to cache, how long to cache, and how to implement cache without changing Pipeline.

Future `LocalGitSource`, `GitLabSource`, and other providers can choose their own cache strategies.

RenderPipeline stays a pure orchestration layer.

## Alternatives Considered

Putting cache in RenderPipeline was rejected because Pipeline would need source-specific knowledge.

Adding only HTTP cache in v0.1 was rejected because ETag and conditional requests add complexity that is unnecessary for the first alpha.

Using `Map<string, GitSourceSnapshot>` directly inside `GitHubApiSource` without an interface was rejected because a small `SourceCache` interface makes future `LocalStorage`, `IndexedDB`, or server-side cache implementations easier.
