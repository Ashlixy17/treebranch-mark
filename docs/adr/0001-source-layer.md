# ADR 0001: Source Layer Boundary

## Context

treebranch-mark needs to load Git history from multiple sources over time, starting with GitHub REST API and later expanding to Local Git, GitLab, and other providers.

Without a stable Source boundary, Parser, Graph Builder, Layout, and Renderer could accidentally depend on GitHub-specific response shapes.

## Decision

Introduce a `GitSource` boundary that normalizes provider-specific data into `GitSourceSnapshot`.

Source is responsible for:

- Fetching repository data
- Normalizing provider payloads
- Returning serializable snapshot data
- Mapping provider errors into `GitSourceError`

Source does not build commit graphs, branch graphs, layout coordinates, render models, or SVG output.

The first public Source field is `branches`, not `refs`, because the MVP only models branches.

## Consequences

Parser and later layers consume a stable source-neutral snapshot.

Future providers can be added without changing Parser, Graph Builder, Layout, RenderModel, or Renderer contracts.

Tags can be added later as a sibling field instead of overloading the branch model.

## Alternatives Considered

Using raw GitHub REST payloads across the app was rejected because it would couple every layer to GitHub.

Using a generic `refs` field in v0.1 was rejected because the MVP only supports branches and `refs` would imply tags and remotes that are not yet modeled.
