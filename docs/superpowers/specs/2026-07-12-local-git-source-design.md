# v0.2 Local Git Source Architecture Design

## Goals

v0.2 adds a Node-based `LocalGitSource` that converts an existing local Git
repository into the same serializable `GitSourceSnapshot` consumed by the
current Parser and rendering pipeline.

The intended CLI workflow is:

```text
treebranch render . --output branch.svg
```

The existing Parser, Graph Builder, Layout, RenderModel, and SVG Renderer must
not know whether the snapshot came from GitHub or a local repository.

## Architecture

```text
Browser Viewer                         Node CLI
      |                                   |
      v                                   v
GitHubApiSource                      LocalGitSource
      |                                   |
GitHub REST API                         git CLI
      |                                   |
      +---------------+-------------------+
                      |
                      v
              GitSourceSnapshot
                      |
                      v
               RenderPipeline
                      |
                      v
                  SVG string
```

`LocalGitSource` is Node-only. It must not be imported by the browser entry
point or bundled into the Vite application.

## Runtime Decision

The browser cannot reliably read an arbitrary `.git` directory. Browser file
APIs require user interaction, do not expose a portable repository abstraction,
and cannot execute Git plumbing commands.

Therefore:

- Browser Viewer continues to use `GitHubApiSource`.
- Local repository support is exposed through a Node CLI.
- CLI file writing belongs to the CLI, not Source or Pipeline.
- A browser folder picker is outside the v0.2 scope.

## Repository Reading Strategy

The MVP uses the installed Git executable through a small command-runner
abstraction. It does not parse `.git` files directly.

Using Git plumbing and porcelain commands correctly handles packed refs,
worktrees, shallow repositories, alternates, and repository format details
without reproducing Git internals in this project.

Commands must be executed with an argument array and without a shell. Repository
paths and branch names must never be interpolated into a command string.

## Source Contracts

The existing `GitSourceInput` contains GitHub-specific `owner` and `repo`
fields. Adding an optional local path to that interface would mix provider
concerns. v0.2 should make the source and pipeline generic over their input.

```ts
interface GitSource<TInput> {
  kind: GitSourceKind
  loadRepository(input: TInput): Promise<GitSourceSnapshot>
}

interface GitHubSourceInput {
  owner: string
  repo: string
  branch?: string
  options?: GitHubSourceOptions
}

interface LocalGitSourceInput {
  repositoryPath: string
  branch?: string
  options?: LocalGitSourceOptions
}

interface LocalGitSourceOptions {
  maxCommitsPerBranch?: number
}
```

`GitSourceInput` may remain as a deprecated alias of `GitHubSourceInput` for
v0.1 compatibility. Local-only fields must not be added to it.

`RenderPipeline` should use the same input type as its injected source:

```ts
class RenderPipeline<TInput> {
  constructor(dependencies: RenderPipelineDependencies<TInput>)
  render(input: TInput): Promise<RenderPipelineResult>
}
```

The Pipeline still has no source-selection logic and no knowledge of Git
commands. The Browser and CLI each construct a pipeline with the appropriate
source.

## Snapshot Normalization

Local Git must map repository data to existing source-neutral models.

### Branches

Only local branches under `refs/heads/*` are included in the MVP. Remote-tracking
branches and tags are excluded.

Each branch produces:

```ts
interface GitBranch {
  name: string
  headSha: string
  isDefault: boolean
  url: string | null
}
```

For a local repository, the branch referenced by `HEAD` is treated as the
default branch. In detached HEAD state, the selected branch is resolved by the
explicit input, then `main`, then `master`, then stable lexical order.

### Commits

Commits are loaded from the selected local branch heads and deduplicated by SHA.
The Source records only Git facts:

- SHA and parent SHAs
- full commit message
- author and committer identities
- authored and committed timestamps

It must not compute branch reachability, graph depth, coordinates, or render
properties.

Local Git has no canonical contributor avatar. Identity mapping is therefore:

```ts
{
  name,
  email,
  login: null,
  avatarUrl: null,
  profileUrl: null
}
```

The existing Renderer circle fallback remains responsible for commits without
avatars.

### Repository Metadata

The current `GitRepository`, `GitBranch`, and `GitCommit` contracts contain
GitHub assumptions. v0.2 should normalize unavailable fields explicitly rather
than inventing values:

```ts
interface GitRepository {
  id: string
  owner: string | null
  name: string
  fullName: string
  defaultBranch: string
  url: string | null
  description: string | null
  stars: number | null
}
```

`GitBranch.url` and `GitCommit.url` should also become `string | null`.
GitHub numeric repository IDs are normalized to strings. For local Git, the
canonical repository path may be used internally to derive an ID, but absolute
local paths should not be displayed or exported unless the CLI user requests
debug output.

The local MVP returns empty `contributors` and `pullRequests` arrays. Contributor
aggregation and forge-specific pull request discovery are separate features.

## LocalGitSource Responsibilities

`LocalGitSource` is responsible for:

- validating and resolving the repository path
- checking that Git is installed
- checking that the path is a Git worktree or bare repository
- reading local branch names and head SHAs
- reading normalized commit records
- deduplicating commits by SHA
- mapping command failures to `GitSourceError`
- returning a serializable `GitSourceSnapshot`

It is not responsible for:

- building the Commit DAG
- computing branch reachability
- layout or rendering
- writing SVG files
- CLI argument parsing
- discovering GitHub avatars
- reading pull requests, issues, tags, or remote-tracking branches

## Error Model

Add local-source errors that allow the CLI to provide actionable messages:

```ts
type GitSourceErrorCode =
  | ExistingGitSourceErrorCode
  | 'git-not-installed'
  | 'not-a-repository'
  | 'permission-denied'
  | 'git-command-failed'
```

Git stderr may be attached as an internal cause, but command arguments containing
local paths should not be printed by default.

## Proposed Modules

```text
src/
  source/
    local/
      GitCommandRunner.ts
      LocalGitSource.ts
      LocalGitSource.test.ts
      types.ts
      index.ts
  cli/
    main.ts
    renderCommand.ts
    types.ts
```

The browser-facing `src/source/index.ts` must not re-export Node-only modules.
A separate Node entry point should export `LocalGitSource` for the CLI.

## CLI Boundary

The first CLI command is intentionally small:

```text
treebranch render <repository-path>
  --output <file>
  --branch <name>
  --max-commits <count>
```

The CLI is responsible for parsing arguments, constructing
`RenderPipeline<LocalGitSourceInput>`, writing the returned SVG string, and
setting process exit codes. It must not duplicate Parser, Graph, Layout, or
Renderer orchestration.

## Testing Strategy

Unit tests should inject a fake `GitCommandRunner` and cover command response
mapping without depending on machine state.

Integration tests should create temporary Git repositories and cover:

- empty repository
- linear history
- multiple local branches
- merge commit
- detached HEAD
- repository path containing spaces
- commit messages containing newlines and non-ASCII text
- missing Git executable
- invalid repository path
- snapshot JSON serialization
- `avatarUrl: null` identity fallback
- unchanged Parser-to-SVG pipeline behavior

## Implementation Tasks

1. Generalize Source and Pipeline input types without changing runtime behavior.
2. Implement and test the Node Git command runner.
3. Implement and test `LocalGitSource` snapshot normalization.
4. Add end-to-end Local Git Pipeline integration tests.
5. Add the minimal `treebranch render` CLI.
6. Review boundaries, run the complete test/build/lint suite, then merge.

Each task should be implemented, reviewed, and tested independently.

## Non-Goals

v0.2 Local Git Source does not include:

- browser `.git` directory access
- direct `.git` object parsing
- remote-tracking branches
- tags
- submodule traversal
- Git LFS data
- avatar lookup by email
- Timeline, Metro, or other layouts
- animation
- GitHub Action or VS Code extension

## Definition of Done

- `treebranch render . --output branch.svg` works in Node.
- Local Git output uses `GitSourceSnapshot`.
- Existing Parser through SVG Renderer layers require no provider-specific code.
- Browser builds contain no Node Git or filesystem imports.
- Local identities use explicit `null` avatar values.
- Snapshot output remains serializable.
- Invalid repositories and missing Git return typed errors.
- Unit and integration tests cover the local source boundary.
- `npm test`, `npm run build`, and `npm run lint` pass.
