# Fork PR Timeline Design

## Goal

Extend Treebranch Mark's Browser Viewer from a single-repository commit timeline into a contribution timeline that shows external contributors' pull-request branches alongside the selected main branch.

The graph keeps one unified, equally spaced chronological x-axis. External fork branches split from the main lane, run in parallel colored lanes, and merge back into the main lane when GitHub reports that the pull request was merged. The main lane can use Commit, Release, or Tag nodes, while pull-request lanes always use commits.

This stage is Browser-first and uses the existing GitHub REST source. It must preserve the current local repository, CLI, timeline grouping, SVG export, pan, and smooth zoom behavior.

## Confirmed Product Decisions

- Only pull requests from external fork repositories are visualized.
- A pull request must target the branch currently selected in Repository Controls.
- Merged fork PRs are included; closed-unmerged PRs are always excluded.
- Open fork PRs are optional and hidden by default.
- Open PR branches split from main but do not draw a merge-back connector.
- Main and PR commits share one chronological x-order with equal event spacing.
- The existing UTC year, month, and day grouping remains available; month remains the default.
- Main stays on the center lane.
- PR lanes alternate above and below main and reuse non-overlapping lanes.
- Open branches occupy outer lanes so their unbounded tails do not obscure completed branches.
- A smooth connector leaves main at the fork anchor and returns at the merge anchor.
- Exact anchors use solid lines; inferred anchors use dashed lines.
- Main node modes are Commit, Release, and Tag. Commit is the default.
- PR lanes always use commit nodes regardless of the main node mode.
- A Release label replaces the main commit avatar at the corresponding commit.
- Published stable and prerelease entries are included; drafts are excluded.
- Prereleases use a visually weaker, dashed label style.
- Multiple Releases or Tags at one commit share one node and stack their labels vertically.
- Hidden main commits remain geometry anchors in Release and Tag modes.
- Every PR has one deterministic color used for its line, connectors, nodes, and avatar rings.
- A PR lane starts with `contributor:branch · #PR`; open lanes also show an `Open` badge.
- The PR display limit is 10, 20, or 50, with 20 as the default.
- Candidate PRs are ordered by recent activity and must overlap the loaded main timeline.
- Display settings live in a separate Graph Settings panel inside the existing page.
- Display-only changes redraw cached data without reloading the repository.
- Raising the PR limit supplements the cache; it does not reload already cached data.

## Approaches Considered

### A. REST PR-centric enrichment (selected)

Extend `GitHubRestClient` and `GitHubApiSource` with pull-request commits, Releases, and repository Tags. Normalize these responses in `GitSourceSnapshot`, then pass them through a dedicated fork timeline graph and layout path.

This approach matches the current codebase, keeps Browser authentication unchanged, and uses GitHub's explicit PR metadata instead of guessing branch relationships. Individual PR failures can degrade independently.

### B. Replace REST with GraphQL

GraphQL could retrieve nested PR, repository, and commit metadata with fewer HTTP round trips. It would also require a second client, new pagination behavior, more complex partial-error handling, and a larger migration of the existing tested source boundary.

Rejected for this stage because the feature does not require replacing the working REST integration.

### C. Infer branches from main commits only

Merge commits, commit messages, and author identities could be used to guess external branches without additional API calls.

Rejected because squash and rebase merges lose the original branch topology, open PRs do not exist on main, and contributor identity cannot establish a fork relationship reliably.

## GitHub Data Acquisition

### Requests

For an owner, repository, and selected base branch, the Browser source loads:

1. The existing repository, branch, main commit, and contributor data.
2. Pull requests whose state is `all`, followed by local filtering.
3. Commit histories for selected external fork PRs.
4. Published Releases.
5. Repository Tags.

The implementation follows GitHub's REST endpoints:

- [List pull requests and list commits on a pull request](https://docs.github.com/en/rest/pulls/pulls?apiVersion=2022-11-28)
- [List releases](https://docs.github.com/en/rest/releases/releases?apiVersion=2022-11-28#list-releases)
- [List repository tags](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repository-tags)

The PR commit endpoint exposes at most 250 commits for one pull request. A branch that exceeds that bound remains renderable but is marked as truncated and produces a partial-data warning.

### PR Eligibility

A PR is eligible when all of these rules hold:

- `base.ref` equals the selected branch.
- `head.repo.fork` is true.
- `head.repo.full_name` differs from the selected repository.
- The PR is merged, or it is open and available in the open-PR cache pool.
- Its activity interval overlaps the loaded main timeline.

The interval begins at `created_at`. A merged PR ends at `merged_at`; an open PR ends at the current graph boundary. A candidate overlaps when its interval intersects the earliest and latest timestamps in the loaded main commit snapshot.

Eligible candidates are sorted by `updated_at` descending, then PR number descending for deterministic ties.

### Fetch Capacity and Concurrency

The selected display limit is N. To let the open-PR switch redraw without a request, the initial repository load can cache up to N merged candidates and N open candidates. Rendering still shows at most N PR lanes after applying the current visibility filter and recent-activity order.

PR commit requests use a small bounded concurrency pool of four to six requests. Anonymous access remains supported, but the UI recommends a GitHub Token when a large PR limit risks rate limiting.

Increasing N supplements missing candidate metadata and commit histories. Decreasing N is a local redraw. Existing repository, main commit, Release, Tag, and completed PR data are not requested again.

## Source Model

The exact field names may follow existing project conventions, but the normalized snapshot needs the following concepts:

```ts
interface GitPullRequestBranch {
  number: number
  title: string
  url: string
  state: 'merged' | 'open'
  author: GitActor
  baseBranch: string
  headBranch: string
  headRepositoryFullName: string
  headSha: string
  createdAt: string
  updatedAt: string
  mergedAt?: string
  mergeCommitSha?: string
  commits: GitCommit[]
  truncated: boolean
}

interface GitRelease {
  id: number
  tagName: string
  name?: string
  url: string
  publishedAt: string
  prerelease: boolean
  targetSha?: string
}

interface GitTag {
  name: string
  commitSha: string
  url?: string
}

interface GitSourceWarning {
  code: string
  message: string
  pullRequestNumber?: number
}
```

`GitSourceSnapshot` gains PR branch, Release, Tag, and warning collections. The existing pull-request summary data may remain for metrics, but renderer-facing branch data uses the explicit normalized structure.

New collections are empty for sources that do not provide them. `LocalGitSource` and the CLI therefore keep working without inventing GitHub relationships.

No GitHub response types escape the source layer.

## Release and Tag Resolution

- A repository Tag is attached to the main commit SHA returned by the Tag endpoint.
- A Release first resolves its `tag_name` through the normalized Tag collection.
- If necessary, `target_commitish` may resolve to a known main commit or selected branch head.
- If the exact target is outside the loaded main window, the event is attached to the nearest main timestamp and marked inferred.
- Draft Releases are discarded.
- Published stable and prerelease entries are preserved.
- Tag chronology uses the pointed-to commit timestamp.
- An unresolved Release falls back to `published_at` for ordering and produces a warning.

## Fork Timeline Graph

Add a dedicated `ForkTimelineGraphBuilder` rather than teaching `SvgRenderer` about GitHub pull requests.

The graph contains:

- main commit events, including events that may later be hidden;
- PR commit events;
- Release and Tag annotations attached to main commits;
- exact or inferred fork anchors;
- exact or inferred merge anchors;
- lane identity and PR metadata;
- data completeness flags.

### Fork Anchor

The builder inspects the first PR commit and its parent SHAs. The preferred anchor is a parent present in the loaded main history.

If no parent is present, the builder chooses the closest main commit at or before the first PR commit timestamp. That anchor is marked inferred and its connector is dashed.

### Merge Anchor

For a merged PR, the builder first searches main history for `merge_commit_sha`. GitHub's value varies with merge strategy, so merge commit, squash, and rebase results are all treated as possible exact main SHAs.

If the SHA is not in the loaded main window, the builder selects the nearest main commit around `merged_at`. The merge is retained but marked inferred and drawn dashed.

Open PRs have no merge anchor. Closed-unmerged PRs never enter the graph.

## Unified Timeline Layout

Add `ForkTimelineLayout` while keeping `TreeLayout` and the existing base `TimelineLayout` supported.

### X Coordinates

1. Collect all main anchors and visible PR commit events.
2. Resolve every event timestamp in UTC.
3. Sort by timestamp.
4. Break equal-time ties deterministically by main-before-PR, PR number, commit SHA, and stable discovery order.
5. Assign one constant horizontal gap per sorted position.

This is chronological ordering with equal spacing, not a proportional calendar scale.

Hidden main commits remain in the ordered sequence in Release and Tag modes. As a result, switching main node modes does not collapse geometry or cause major branch movement.

UTC group labels remain `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. Each group includes a label and vertical separator in the exported SVG.

### Y Coordinates and Lane Reuse

- Main uses lane zero.
- Completed PR intervals are processed by fork position and recent-activity tie breakers.
- The layout alternates preferred sides above and below main.
- It chooses the nearest lane on that side whose occupied x-interval does not overlap.
- A non-overlapping later PR can reuse the lane.
- If the preferred side would create an avoidable connector crossing, the opposite free side is considered before adding a more distant lane.
- Open PRs are assigned after completed PRs and use the nearest free outer lanes.

The algorithm is deterministic and greedy. It prioritizes readability and lane reuse without attempting an expensive global crossing-minimization optimization.

### Connectors

Fork and merge connectors are cubic Bézier paths with horizontal tangents at both lane endpoints. Exact paths are solid; inferred paths are dashed. Consecutive commits within one PR lane use that PR's branch color.

## Main Node Modes

### Commit

- Show every main commit.
- A normal main commit uses the contributor avatar.
- If one or more Releases attach to that commit, stacked Release labels replace the avatar.
- PR lanes continue to show commit avatars.

### Release

- Show only published Release nodes on main.
- Use version labels instead of avatars.
- Stable Releases use the normal label style.
- Prereleases use a lighter, dashed style.
- Ordinary main commits remain hidden geometry anchors.

### Tag

- Show only Tag nodes on main.
- Use Tag labels instead of avatars.
- Ordinary main commits remain hidden geometry anchors.

When multiple labels point to one commit, one node owns a vertically stacked label collection. Labels do not create duplicate x positions.

A hidden main commit that receives a fork or merge connector is rendered as a small junction dot without an avatar or commit label.

## Color and Label Rules

Each PR receives a deterministic palette seed from repository identity and PR number. A cached color assignment keeps existing PR colors stable when visibility or the display limit changes. When adjacent active lanes collide, deterministic palette probing selects a distinct accessible color without changing already assigned entries.

The PR color applies to:

- the branch line;
- fork and merge connectors;
- commit node outlines;
- avatar rings;
- the lane label accent;
- the Open badge accent.

Main keeps the existing main color. Text, backgrounds, and line contrast must remain readable in the project's supported themes.

The lane label is `contributor:branch · #PR`. It appears near the first PR commit without covering the fork curve. Open lanes add a localized `Open` badge.

## Render Model and SVG

`LayoutResult` and RenderModel gain neutral lane and event semantics rather than GitHub API objects:

- lane id and lane color;
- node kind: commit, release, tag, or junction;
- edge kind: main, branch, fork, or merge;
- exact versus inferred style;
- stacked labels and badge data;
- path geometry for curved connectors;
- PR metadata needed for accessible titles and links.

`SvgRenderer` renders these semantics but does not decide whether a PR is eligible, where it forked, or what a merge SHA means.

The generated SVG continues to work inside the existing enlarged `SvgPreviewPanel`. Wheel zoom, smooth scaling, pointer dragging, view reset, and SVG export remain unchanged.

## Browser UI

Add a separate `Graph Settings` panel below Repository Controls and above the result panel. It is part of the existing page, not a new route or standalone page.

The panel contains:

| Setting | Values | Default |
| --- | --- | --- |
| Timeline grouping | Year, Month, Day | Month |
| Main node type | Commit, Release, Tag | Commit |
| Include open PR branches | Off, On | Off |
| PR branches | 10, 20, 50 | 20 |

Repository Controls keeps Token, repository, and Branch inputs. Generate remains centered at the bottom of that panel.

Desktop uses a consistent settings grid; narrow screens wrap to a readable single column. New strings are added to the existing Chinese, English, and Japanese dictionaries.

### Interaction Flow

- Generate loads the selected repository using the current Graph Settings.
- Grouping, main node type, and open-PR visibility redraw the cached snapshot.
- Those display-only changes do not issue GitHub requests.
- Raising the PR limit starts an incremental enrichment request while retaining the current SVG.
- When enrichment succeeds, the graph redraws with the larger cache.
- Lowering the PR limit redraws immediately without a request.
- Editing repository, Branch, or Token does not request automatically; Generate applies the changes.
- Partial warnings appear above the SVG result and can be expanded for PR-specific details.

## Cache Boundary

Repository identity, selected branch, and authentication scope identify the repository session cache. Display grouping, main node mode, and open-PR visibility are not source cache keys.

The cache tracks enrichment capacity and completion per PR. Incremental loading requests only missing pages or missing PR histories and merges them immutably into the cached snapshot. Failed PR histories remain retryable and do not invalidate successful entries.

A repository or branch change starts a different session. Token changes must not expose or serialize the token in cache diagnostics or warning text.

## Error Handling

Repository metadata or selected-main-branch failure remains fatal for that Generate action.

The following failures are partial:

- one PR commit history cannot be read;
- a PR history exceeds the supported 250-commit response;
- a Release target cannot be resolved exactly;
- a fork parent or merge SHA is outside the loaded main window;
- rate limiting stops enrichment before the requested capacity is reached.

Partial failures produce structured warnings, render all valid data, and mark inferred geometry where applicable. A failed redraw keeps the last valid SVG visible.

## Testing

### Source Tests

- REST response mapping and pagination.
- External fork and selected-base filtering.
- Merged, open, and closed-unmerged behavior.
- Timeline overlap and recent-activity ordering.
- 10, 20, and 50 capacity behavior.
- Bounded concurrency and incremental top-up without duplicate calls.
- Release, prerelease, draft, and Tag normalization.
- Per-PR failure, truncation, and rate-limit warnings.

### Graph and Layout Tests

- Exact parent fork anchors.
- Exact merge, squash, and rebase anchors.
- Time-based inferred fork and merge anchors.
- Unified chronological equal spacing.
- Stable equal-time ordering.
- UTC year, month, and day groups.
- Alternating sides, interval reuse, crossing preference, and outer open lanes.
- Hidden main anchors in Release and Tag modes.
- Multiple labels on one main commit.

### Render Tests

- Solid and dashed smooth connectors.
- One consistent PR color across all branch elements.
- PR-colored avatar rings.
- Commit, Release, Tag, prerelease, junction, lane label, and Open badge output.
- Label stacking, escaping, accessible titles, links, and uncropped viewBox bounds.
- A representative golden SVG containing merged, open, Release, prerelease, and multi-Tag cases.

### Browser and Regression Tests

- Graph Settings placement, defaults, responsive layout, and translations.
- Cached redraw without source requests.
- Incremental PR-limit loading.
- Partial-warning presentation.
- Existing repository form, local source, CLI, base timeline, export, pan, and zoom behavior.

All API tests use fixtures and do not access live GitHub.

## Out of Scope

- Visualizing branches that have never opened a PR.
- Closed-unmerged PR branches.
- GitHub GraphQL migration.
- A proportional-time x-axis.
- Editing or interacting with GitHub PR state.
- Reconstructing more than 250 PR commits in this stage.
- Adding PR enrichment to `LocalGitSource` or new CLI flags.
- Global optimal lane routing.

## Definition of Done

- The existing Browser Viewer can generate a multi-contributor Fork/PR timeline from GitHub.
- External fork branches split from and, when merged, reconnect to the selected main branch.
- Commit, Release, and Tag main-node modes follow the confirmed semantics.
- Open PRs are optional and off by default.
- All lanes use one equal-spaced UTC chronological order and year/month/day groups.
- PR colors, avatar rings, labels, badges, and exact/inferred connectors are consistent.
- Display-only settings redraw cached data without repository reloads.
- Raising the PR limit supplements rather than replaces cached data.
- Partial GitHub data degrades visibly without preventing a valid SVG.
- Existing Browser, local source, CLI, export, pan, zoom, and TreeLayout behavior does not regress.
- `npm test`, `npm run build`, and `npm run lint` all pass.
