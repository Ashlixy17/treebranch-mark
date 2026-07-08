# ADR 0002: Parser Boundary

## Context

After Source returns a normalized snapshot, the project needs a runtime graph representation for commit traversal.

This graph should not leak GitHub API details or UI concerns.

## Decision

Commit Parser consumes `GitSourceSnapshot` and produces `CommitGraph`.

The graph uses O(1) node lookup by SHA:

```ts
interface CommitGraph {
  nodes: Map<string, CommitNode>
  roots: CommitNode[]
}
```

`CommitNode` references the original `GitCommit` and runtime graph links:

```ts
interface CommitNode {
  commit: GitCommit
  parents: CommitNode[]
  children: CommitNode[]
}
```

Parser does not mutate `GitSourceSnapshot`.

## Consequences

Graph Builder can resolve commits by SHA efficiently.

Parser can build parents and children once, then all later graph algorithms can reuse the same DAG structure.

Root commits are determined by `parents.length === 0`.

## Alternatives Considered

Returning only `CommitNode[]` was rejected because later layers need frequent SHA lookup.

Storing branch reachability in `GitCommit` was rejected because commits do not intrinsically know which branches can reach them.
