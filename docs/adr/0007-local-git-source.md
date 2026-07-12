# ADR 0007: Local Git Source Boundary

## Context

Treebranch Mark v0.1 reads repository history through GitHub REST API. This
enables a browser viewer but introduces network dependency and API rate limits.
Users with an existing local repository already have the required Git objects
and refs in their working copy.

The current Source contract also assumes a GitHub-shaped input containing
`owner` and `repo`, while a local source needs a repository path.

## Decision

v0.2 will add a Node-only `LocalGitSource` and a minimal CLI.

`LocalGitSource` will invoke the installed Git executable through an injectable
command runner. It will not parse `.git` files directly. Commands will use an
argument array without a shell.

The Browser Viewer will continue to use `GitHubApiSource`. Browser folder access
is outside the v0.2 scope.

`GitSource` and `RenderPipeline` will become generic over their source input.
GitHub and Local Git will use separate input types; a local path will not be
added to the GitHub input contract.

Only local branches under `refs/heads/*` are included. Local commits are
normalized into `GitSourceSnapshot`, deduplicated by SHA, and use
`avatarUrl: null` because Git does not store contributor avatars.

Local repository metadata that does not exist will be represented with explicit
`null` values. Provider-specific values will not be fabricated.

The CLI will call the existing RenderPipeline and write its SVG string to disk.
It will not duplicate graph, layout, or rendering logic.

## Consequences

Local repositories can be rendered without GitHub API access or rate limits.

Parser, Graph Builder, Layout, RenderModel, and Renderer remain source-neutral.

The browser and Node builds require separate entry points so Node filesystem and
process APIs are never bundled into the browser application.

Some v0.1 repository and URL fields must become nullable or source-neutral in
v0.2. Compatibility aliases should be used where practical.

Git must be installed for Local Git Source and CLI usage.

## Alternatives Considered

Parsing `.git` objects and refs directly was rejected for the MVP because it
would require handling packed refs, worktrees, alternates, shallow repositories,
and repository format changes.

Reading a local repository in the browser was rejected because browser file
access is permission-driven, not portable, and cannot execute Git commands.

Adding `repositoryPath` to the existing GitHub-shaped `GitSourceInput` was
rejected because it would mix provider-specific inputs and weaken Source
boundaries.

Implementing Timeline Layout before Local Git Source was deferred because a
second data source increases the core engine's usefulness and removes API rate
limits without changing downstream visualization layers.
