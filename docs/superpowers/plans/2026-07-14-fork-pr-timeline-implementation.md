# Fork PR Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Browser-first, equal-spaced GitHub Fork/PR timeline with split and merge curves, Commit/Release/Tag main-node modes, optional open PRs, and cached Graph Settings redraws.

**Architecture:** Extend `GitHubApiSource` with normalized PR branch, Release, Tag, capacity, and warning data. Keep the existing Parser/BranchGraph/RenderPipeline path intact for CLI and local Git, and add a parallel `ForkTimelineGraphBuilder` → `ForkTimelineLayout` → `ForkTimelineRenderModelBuilder` path orchestrated by `ForkTimelinePipeline` for the Browser Viewer. Extend the shared RenderModel and SVG renderer with optional rich timeline semantics while preserving legacy defaults.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Vitest 4 with jsdom, GitHub REST API 2022-11-28, SVG.

## Global Constraints

- Develop directly on `dev`; do not create a branch or worktree.
- Use GitHub REST and keep every Browser-imported module free of `node:fs`, `child_process`, and other Node APIs.
- Visualize only external fork PRs targeting the selected branch.
- Include merged PRs; closed-unmerged PRs are excluded; open PRs are optional and off by default.
- Use one UTC chronological order with equal x spacing and Year/Month/Day grouping; Month is the default.
- Main node mode defaults to Commit; Release and Tag modes retain hidden main geometry anchors.
- PR lanes always use commit nodes.
- PR branch limit values are exactly 10, 20, and 50; default is 20.
- Display-only setting changes must use the cached snapshot; increasing the PR limit may incrementally fetch missing PR histories.
- Keep existing local source, CLI, TreeLayout, SVG export, pan, drag, and smooth wheel zoom behavior.
- All new Browser strings must exist in English, Simplified Chinese, and Japanese.
- Follow red-green-refactor for every production behavior.
- Final gates are `npm test`, `npm run build`, and `npm run lint`.

---

## File Map

### Create

- `src/source/github/pullRequestSelection.ts` — pure fork eligibility, overlap, ordering, and capacity selection.
- `src/source/github/pullRequestSelection.test.ts` — source-selection unit tests.
- `src/graph/ForkTimelineGraphBuilder.ts` — normalized main/PR event graph and exact/inferred anchors.
- `src/graph/ForkTimelineGraphBuilder.test.ts` — graph semantics tests.
- `src/graph/forkTimelineTypes.ts` — fork graph contracts and main-node mode.
- `src/layout/ForkTimelineLayout.ts` — global equal-spacing and deterministic lane allocation.
- `src/layout/ForkTimelineLayout.test.ts` — chronology, grouping, lane reuse, and routing tests.
- `src/render-model/ForkTimelineRenderModelBuilder.ts` — rich layout-to-render-model conversion.
- `src/render-model/ForkTimelineRenderModelBuilder.test.ts` — node, edge, label, badge, and color mapping tests.
- `src/pipeline/ForkTimelinePipeline.ts` — Browser fork-timeline orchestration and cached redraw.
- `src/pipeline/ForkTimelinePipeline.test.ts` — orchestration and no-source-redraw tests.
- `src/renderer/svg/__fixtures__/fork-timeline-golden.svg` — representative merged/open/release/tag SVG.

### Modify

- `src/source/types.ts` — enriched PR, Release, Tag, warning, capacity, and source option contracts.
- `src/source/github/githubRestClient.ts` — REST response types and endpoints.
- `src/source/github/GitHubApiSource.ts` — base load, normalization, partial degradation, and incremental enrichment.
- `src/source/github/GitHubApiSource.test.ts` — REST and source integration fixtures.
- `src/source/cache/cacheKey.ts` and `.test.ts` — cache repository data independently from PR display capacity.
- `src/source/local/LocalGitSource.ts` and affected snapshot fixtures — empty rich GitHub collections.
- `src/graph/index.ts`, `src/layout/index.ts`, `src/render-model/index.ts`, `src/pipeline/index.ts` — export new contracts.
- `src/layout/types.ts` — rich fork layout result and lane-label geometry.
- `src/render-model/types.ts` — optional rich nodes, edges, labels, and lane labels.
- `src/renderer/svg/SvgRenderer.ts` and `.test.ts` — curves, colors, labels, junctions, and bounds.
- `src/App.tsx`, `src/App.css`, `src/App.test.tsx`, `src/App.layout.test.ts` — Graph Settings, cached redraw/top-up, warnings, translations, and layout.

---

### Task 1: Define GitHub Timeline Source Contracts and REST Endpoints

**Files:**
- Modify: `src/source/types.ts`
- Modify: `src/source/github/githubRestClient.ts`
- Modify: `src/source/github/GitHubApiSource.test.ts`
- Modify: `src/source/cache/cacheKey.test.ts`
- Modify: `src/source/cache/cacheKey.ts`
- Modify: snapshot fixtures returned by `rg -l "pullRequests:" src`

**Interfaces:**
- Produces: `GitPullRequest`, `GitRelease`, `GitTag`, `GitSourceWarning`, `GitPullRequestCapacity`, and `pullRequestBranchLimit`.
- Produces client methods: `listPullRequests`, `listPullRequestCommits`, `listReleases`, `listTags`.

- [ ] **Step 1: Write failing source-contract and client URL tests**

Add tests that compile and assert the requested URL shapes:

```ts
it('requests all pull requests and PR commits', async () => {
  const urls: string[] = []
  const client = new GitHubRestClient({
    fetcher: async (input) => {
      urls.push(String(input))
      return new Response('[]', { status: 200 })
    },
  })

  await client.listPullRequests('octo', 'repo')
  await client.listPullRequestCommits('octo', 'repo', 7)

  expect(urls).toEqual([
    'https://api.github.com/repos/octo/repo/pulls?state=all&sort=updated&direction=desc&per_page=100',
    'https://api.github.com/repos/octo/repo/pulls/7/commits?per_page=100',
  ])
})

it('requests releases and tags', async () => {
  const urls: string[] = []
  const client = new GitHubRestClient({
    fetcher: async (input) => {
      urls.push(String(input))
      return new Response('[]', { status: 200 })
    },
  })

  await client.listReleases('octo', 'repo')
  await client.listTags('octo', 'repo')

  expect(urls).toEqual([
    'https://api.github.com/repos/octo/repo/releases?per_page=100',
    'https://api.github.com/repos/octo/repo/tags?per_page=100',
  ])
})
```

Update the cache-key test so `pullRequestBranchLimit: 10` and `50` produce the same repository cache key.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm test -- src/source/github/GitHubApiSource.test.ts src/source/cache/cacheKey.test.ts`

Expected: FAIL because the new methods and option do not exist and the current key does not express the new contract.

- [ ] **Step 3: Add normalized source contracts**

Add these contracts in `src/source/types.ts` and add the corresponding required collections to `GitSourceSnapshot`:

```ts
export type GitPullRequestState = 'merged' | 'open'
export type GitPullRequestLoadState = 'metadata' | 'complete' | 'partial'
export type GitPullRequestBranchLimit = 10 | 20 | 50

export interface GitPullRequest {
  number: number
  title: string
  state: GitPullRequestState
  url: string
  authorLogin: string | null
  authorAvatarUrl: string | null
  createdAt: string
  updatedAt: string
  mergedAt: string | null
  baseBranch: string
  headBranch: string
  headRepositoryFullName: string
  headSha: string
  mergeCommitSha: string | null
  commits: GitCommit[]
  loadState: GitPullRequestLoadState
  truncated: boolean
}

export interface GitRelease {
  id: number
  tagName: string
  name: string | null
  url: string
  publishedAt: string
  prerelease: boolean
  targetSha: string | null
  inferred: boolean
}

export interface GitTag {
  name: string
  commitSha: string
  url: string | null
}

export interface GitSourceWarning {
  code: 'pr-commits-unavailable' | 'pr-commits-truncated' | 'release-target-inferred' | 'capacity-partial'
  message: string
  pullRequestNumber?: number
}

export interface GitPullRequestCapacity {
  requested: GitPullRequestBranchLimit
  mergedLoaded: number
  openLoaded: number
}
```

Add `pullRequestBranchLimit?: GitPullRequestBranchLimit` and `includeReleases?: boolean` to `GitSourceOptions`. Add `releases`, `tags`, `warnings`, and `pullRequestCapacity` to every snapshot producer/fixture, using empty arrays and zero capacity outside GitHub.

- [ ] **Step 4: Add REST response types and methods**

Extend `GitHubPullRequestResponse.head` with `sha` and nullable `repo` fields (`full_name`, `fork`), and add `updated_at`. Add `GitHubReleaseResponse` and `GitHubTagResponse`. Implement the four public methods with the exact paths asserted above. Keep all requests routed through the existing private `get` method.

- [ ] **Step 5: Exclude PR display capacity from the cache key**

Keep owner/repo/branch, main commit depth, data-family include flags, and authentication-independent behavior in `createGitHubSnapshotCacheKey`, but do not include `pullRequestBranchLimit`. Add `includeReleases` to the key because it changes the loaded data family.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/source/github/GitHubApiSource.test.ts src/source/cache/cacheKey.test.ts src/source/types.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/source
git commit -m "feat: define fork timeline source contracts"
```

---

### Task 2: Select and Incrementally Enrich External Fork PRs

**Files:**
- Create: `src/source/github/pullRequestSelection.ts`
- Create: `src/source/github/pullRequestSelection.test.ts`
- Modify: `src/source/github/GitHubApiSource.ts`
- Modify: `src/source/github/GitHubApiSource.test.ts`

**Interfaces:**
- Consumes: normalized types and REST methods from Task 1.
- Produces: `selectEligiblePullRequests(responses, context)` and cached snapshots whose PR metadata persists across capacity increases.

- [ ] **Step 1: Write failing pure-selection tests**

Cover selected base, external `repo.fork`, repository mismatch, timeline overlap, merged/open eligibility, closed-unmerged exclusion, and `updated_at`/number ordering. Use this wished-for API:

```ts
const selected = selectEligiblePullRequests(responses, {
  repositoryFullName: 'octo/repo',
  baseBranch: 'main',
  timelineStart: '2026-01-01T00:00:00Z',
  timelineEnd: '2026-01-31T00:00:00Z',
})

expect(selected.map((pr) => pr.number)).toEqual([12, 7])
```

- [ ] **Step 2: Run the selection test and verify RED**

Run: `npm test -- src/source/github/pullRequestSelection.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the pure selector**

Implement:

```ts
export interface PullRequestSelectionContext {
  repositoryFullName: string
  baseBranch: string
  timelineStart: string | null
  timelineEnd: string | null
}

export function selectEligiblePullRequests(
  pullRequests: GitHubPullRequestResponse[],
  context: PullRequestSelectionContext,
): GitHubPullRequestResponse[] {
  return pullRequests
    .filter((pr) => pr.base.ref === context.baseBranch)
    .filter((pr) => pr.head.repo?.fork === true)
    .filter((pr) => pr.head.repo?.full_name !== context.repositoryFullName)
    .filter((pr) => pr.state === 'open' || pr.merged_at !== null)
    .filter((pr) => overlapsTimeline(pr, context.timelineStart, context.timelineEnd))
    .sort((left, right) =>
      right.updated_at.localeCompare(left.updated_at) || right.number - left.number,
    )
}
```

`overlapsTimeline` treats open PRs as ending at the timeline end and returns true when main timestamps are unavailable.

- [ ] **Step 4: Write failing source enrichment tests**

Add tests proving that:

- the initial default request enriches at most 20 merged and 20 open candidates;
- PR commit failures yield `loadState: 'partial'` and a warning while the snapshot resolves;
- a 250-item PR response sets `truncated: true` and a warning;
- raising the limit on the same source/cache does not reload repository, branches, main commits, Releases, Tags, or already complete PRs;
- drafts are excluded, prereleases retained, and Release tag names resolve through repository Tags;
- capacity counts are correct after a partial result.

- [ ] **Step 5: Run source tests and verify RED**

Run: `npm test -- src/source/github/GitHubApiSource.test.ts`

Expected: FAIL because `GitHubApiSource` does not load or enrich the new data.

- [ ] **Step 6: Implement base load and incremental top-up**

Refactor `loadRepository` into a base-load branch and an enrichment branch:

```ts
async loadRepository(input: GitSourceInput): Promise<GitSourceSnapshot> {
  const key = createGitHubSnapshotCacheKey(input)
  const requested = input.options?.pullRequestBranchLimit ?? 20
  const cached = this.cache.get(key)

  if (cached && cached.pullRequestCapacity.requested >= requested) {
    return cached
  }

  const base = cached ?? await this.loadBaseSnapshot(input, requested)
  const enriched = await this.enrichPullRequestCapacity(base, input, requested)
  this.cache.set(key, enriched, this.cacheTtlMs)
  return enriched
}
```

The base snapshot stores metadata for every eligible PR returned by the list endpoint with `loadState: 'metadata'`. `enrichPullRequestCapacity` selects the first N merged and first N open candidates, fetches only candidates not already `complete` or `partial`, catches errors per PR, and returns a new snapshot. Use a bounded promise worker rather than unbounded `Promise.all`.

Load contributors, PR metadata, Releases, and Tags concurrently after repository/branch/main commit prerequisites are known. Resolve Release targets from the Tag map; use nearest main commit time plus `inferred: true` and a warning if no exact SHA is present.

- [ ] **Step 7: Run source and cache tests and verify GREEN**

Run: `npm test -- src/source/github/GitHubApiSource.test.ts src/source/github/pullRequestSelection.test.ts src/source/cache`

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add src/source
git commit -m "feat: load external fork pull requests"
```

---

### Task 3: Build the Fork Timeline Domain Graph

**Files:**
- Create: `src/graph/forkTimelineTypes.ts`
- Create: `src/graph/ForkTimelineGraphBuilder.ts`
- Create: `src/graph/ForkTimelineGraphBuilder.test.ts`
- Modify: `src/graph/index.ts`

**Interfaces:**
- Consumes: `GitSourceSnapshot`.
- Produces: `ForkTimelineGraphBuilder.build(snapshot, options): ForkTimelineGraphBuilderResult`.

- [ ] **Step 1: Write failing graph tests**

Use this public contract:

```ts
const result = new ForkTimelineGraphBuilder().build(snapshot, {
  mainNodeMode: 'commit',
  includeOpenPullRequests: false,
  pullRequestLimit: 20,
})

expect(result.graph.mainEvents.map((event) => event.commit.sha)).toEqual(['a', 'b', 'c'])
expect(result.graph.lanes[0]).toMatchObject({
  id: 'pr-7',
  state: 'merged',
  forkAnchor: { commitSha: 'a', inferred: false },
  mergeAnchor: { commitSha: 'c', inferred: false },
})
```

Add separate tests for open visibility, limit ordering, inferred parent by nearest earlier time, inferred merge by `mergedAt`, Release replacement in Commit mode, Release-only and Tag-only visibility, stacked labels, prerelease labels, and hidden anchor junctions.

- [ ] **Step 2: Run graph tests and verify RED**

Run: `npm test -- src/graph/ForkTimelineGraphBuilder.test.ts`

Expected: FAIL because the graph builder and types do not exist.

- [ ] **Step 3: Define graph contracts**

Create focused contracts:

```ts
export type MainNodeMode = 'commit' | 'release' | 'tag'
export type ForkTimelineNodeKind = 'commit' | 'release' | 'tag' | 'junction'

export interface ForkTimelineLabel {
  text: string
  kind: 'release' | 'tag'
  url: string | null
  prerelease: boolean
  inferred: boolean
}

export interface ForkTimelineMainEvent {
  id: string
  commit: GitCommit
  visibleKind: ForkTimelineNodeKind | null
  labels: ForkTimelineLabel[]
  junction: boolean
}

export interface ForkTimelineAnchor {
  commitSha: string
  inferred: boolean
}

export interface ForkTimelineLane {
  id: string
  pullRequest: GitPullRequest
  commits: GitCommit[]
  forkAnchor: ForkTimelineAnchor
  mergeAnchor: ForkTimelineAnchor | null
}

export interface ForkTimelineGraph {
  repositoryFullName: string
  mainEvents: ForkTimelineMainEvent[]
  lanes: ForkTimelineLane[]
}
```

- [ ] **Step 4: Implement exact and inferred anchors**

Index main commits by SHA. For each visible complete/partial PR, sort commits chronologically. Resolve the fork anchor from a parent of the first PR commit; otherwise select the closest main timestamp at or before the first PR timestamp and mark inferred. Resolve merge SHA exactly; otherwise select the closest main timestamp to `mergedAt` and mark inferred. Mark every referenced hidden main event as `junction: true`.

Attach Releases and Tags by resolved SHA. In Commit mode, Release labels replace the normal commit presentation. In Release/Tag mode, keep every main event but set `visibleKind: null` unless it has the selected label kind or is a junction.

- [ ] **Step 5: Run graph tests and verify GREEN**

Run: `npm test -- src/graph/ForkTimelineGraphBuilder.test.ts src/graph/BranchGraphBuilder.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/graph
git commit -m "feat: build fork timeline graph"
```

---

### Task 4: Lay Out One Global Timeline and Reusable PR Lanes

**Files:**
- Create: `src/layout/ForkTimelineLayout.ts`
- Create: `src/layout/ForkTimelineLayout.test.ts`
- Modify: `src/layout/types.ts`
- Modify: `src/layout/index.ts`

**Interfaces:**
- Consumes: `ForkTimelineGraph` and `TimelineGrouping`.
- Produces: `ForkTimelineLayoutResult` with semantic nodes, curved edges, groups, and lane labels.

- [ ] **Step 1: Write failing layout tests**

Assert the following with exact coordinates:

```ts
const result = new ForkTimelineLayout({ grouping: 'month' }).layout(graph)

expect(result.nodes.map(({ id, x }) => [id, x])).toEqual([
  ['main-a', 0],
  ['pr-7-p1', 120],
  ['main-b', 240],
])
expect(result.lanes.map(({ laneIndex, y }) => [laneIndex, y])).toEqual([[1, -100]])
```

Add tests for equal-time stable ordering, UTC groups, alternating `-1/+1`, interval reuse, no reuse during overlap, open lanes outside completed lanes, deterministic repeated output, and Bézier paths with dashed inferred flags.

- [ ] **Step 2: Run layout tests and verify RED**

Run: `npm test -- src/layout/ForkTimelineLayout.test.ts`

Expected: FAIL because the layout does not exist.

- [ ] **Step 3: Define rich layout result types**

```ts
export interface ForkTimelineLayoutNode extends LayoutNode {
  laneId: string
  kind: ForkTimelineNodeKind | null
  commit: GitCommit
  labels: ForkTimelineLabel[]
  junction: boolean
  color: string
}

export interface ForkTimelineLayoutEdge {
  id: string
  from: string
  to: string
  kind: 'main' | 'branch' | 'fork' | 'merge'
  color: string
  inferred: boolean
  path: string | null
}

export interface ForkTimelineLaneLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  url: string
  badge: 'open' | null
}

export interface ForkTimelineLayoutResult {
  nodes: ForkTimelineLayoutNode[]
  edges: ForkTimelineLayoutEdge[]
  groups: LayoutGroup[]
  laneLabels: ForkTimelineLaneLabel[]
}
```

- [ ] **Step 4: Implement global event ordering**

Collect all main events and visible PR commits, resolve `committedAt` then `authoredAt`, sort UTC timestamps, and break ties by main lane first, PR number, SHA, then discovery index. Assign `COMMIT_COLUMN_GAP` increments. Keep hidden main events in this sequence.

- [ ] **Step 5: Implement lane allocation and colors**

Assign completed intervals greedily, alternating the preferred side, using the nearest non-overlapping absolute lane. Assign open intervals afterward to outer lanes. Use `BRANCH_LANE_GAP` for y coordinates.

Derive a stable base palette index from repository full name and PR number. Persist deterministic assignments within the layout pass; when an adjacent occupied lane already uses the same color, linearly probe the accessible palette without changing earlier assignments.

- [ ] **Step 6: Implement edge and label geometry**

Generate straight main/branch edges and cubic paths for fork/merge edges:

```ts
function curvePath(from: LayoutNode, to: LayoutNode): string {
  const controlX = from.x + (to.x - from.x) / 2
  return `M ${from.x} ${from.y} C ${controlX} ${from.y}, ${controlX} ${to.y}, ${to.x} ${to.y}`
}
```

Place the lane label near the first PR commit and set the badge only for open PRs. Create UTC groups from the same globally ordered event positions.

- [ ] **Step 7: Run layout regression tests and verify GREEN**

Run: `npm test -- src/layout`

Expected: PASS, including existing TreeLayout and TimelineLayout tests.

- [ ] **Step 8: Commit**

```powershell
git add src/layout
git commit -m "feat: lay out fork timeline lanes"
```

---

### Task 5: Render Curves, Colored Avatars, Labels, Badges, and Junctions

**Files:**
- Modify: `src/render-model/types.ts`
- Create: `src/render-model/ForkTimelineRenderModelBuilder.ts`
- Create: `src/render-model/ForkTimelineRenderModelBuilder.test.ts`
- Modify: `src/render-model/index.ts`
- Modify: `src/renderer/svg/SvgRenderer.ts`
- Modify: `src/renderer/svg/SvgRenderer.test.ts`
- Create: `src/renderer/svg/__fixtures__/fork-timeline-golden.svg`

**Interfaces:**
- Consumes: `ForkTimelineLayoutResult`.
- Produces: backward-compatible `RenderModel` with optional rich semantics.

- [ ] **Step 1: Write failing RenderModel tests**

Assert commit/release/tag/junction kinds, PR avatar ring colors, stacked labels, lane labels, Open badges, edge colors, curved paths, and inferred flags. Also assert the existing `RenderModelBuilder` output remains unchanged.

- [ ] **Step 2: Run RenderModel tests and verify RED**

Run: `npm test -- src/render-model`

Expected: FAIL because rich model fields and the fork builder do not exist.

- [ ] **Step 3: Extend RenderModel with legacy-safe defaults**

Add optional-rich contracts while making the new builder always populate them:

```ts
export interface RenderLabel {
  text: string
  kind: 'release' | 'tag'
  url: string | null
  prerelease: boolean
  inferred: boolean
}

export interface RenderNode {
  id: string
  x: number
  y: number
  label: string
  kind: 'commit' | 'release' | 'tag' | 'junction'
  styleToken: 'commit' | 'release' | 'tag' | 'junction'
  avatarUrl: string | null
  color?: string
  labels?: RenderLabel[]
}

export interface RenderEdge {
  from: string
  to: string
  styleToken: 'commit-edge' | 'main-edge' | 'branch-edge' | 'fork-edge' | 'merge-edge'
  color?: string
  path?: string | null
  inferred?: boolean
}

export interface RenderLaneLabel {
  id: string
  x: number
  y: number
  text: string
  color: string
  url: string
  badge: 'open' | null
}
```

Add `laneLabels: RenderLaneLabel[]` to `RenderModel`; legacy `RenderModelBuilder` returns `[]`.

- [ ] **Step 4: Implement `ForkTimelineRenderModelBuilder`**

Map rich layout nodes, edges, groups, and lane labels without reinterpreting GitHub data. Normalize avatar URLs exactly as the existing builder does. Hidden non-junction nodes are omitted from rendered nodes only after their coordinates have already served layout geometry.

- [ ] **Step 5: Write failing SVG tests**

Assert:

- `<path>` with a cubic `d` for fork/merge edges;
- `stroke="#..."` and `stroke-dasharray` for inferred edges;
- avatar ring uses the PR color;
- Release/Tag `<rect>` and text replace avatars;
- prerelease labels use a dashed border;
- junction dots are smaller than commit nodes;
- lane label and Open badge are escaped and inside the viewBox;
- legacy fixture output remains stable except for intentionally added empty model defaults.

- [ ] **Step 6: Run SVG tests and verify RED**

Run: `npm test -- src/renderer/svg/SvgRenderer.test.ts`

Expected: FAIL because the renderer only draws currentColor lines and commit nodes.

- [ ] **Step 7: Implement rich SVG rendering and bounds**

Render a `<path fill="none">` when `edge.path` exists; otherwise render a line. Use `edge.color ?? 'currentColor'`, and add `stroke-dasharray="6 5"` when inferred. Render labels as rounded rect/text groups, prerelease dashed rects, junction circles, lane text links, and Open badge rect/text. Extend viewBox bounds for avatar radii, stacked label sizes, lane labels, badges, and curved lane y extents.

- [ ] **Step 8: Generate and assert the golden SVG fixture**

Create one deterministic model that contains a merged PR, an open PR, a stable Release, a prerelease, two Tags on one node, and one inferred merge. Check the complete output into `fork-timeline-golden.svg` and compare it byte-for-byte in the renderer test.

- [ ] **Step 9: Run render tests and verify GREEN**

Run: `npm test -- src/render-model src/renderer/svg`

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/render-model src/renderer
git commit -m "feat: render fork timeline SVG"
```

---

### Task 6: Add a Browser Fork Timeline Pipeline

**Files:**
- Create: `src/pipeline/ForkTimelinePipeline.ts`
- Create: `src/pipeline/ForkTimelinePipeline.test.ts`
- Modify: `src/pipeline/types.ts`
- Modify: `src/pipeline/index.ts`

**Interfaces:**
- Consumes: source, graph builder, layout, rich model builder, renderer.
- Produces: `render(input, settings)` and `renderSnapshot(snapshot, settings)`.

- [ ] **Step 1: Write failing pipeline tests**

Use this contract:

```ts
const pipeline = new ForkTimelinePipeline({ source })
const first = await pipeline.render(input, settings)
const redraw = pipeline.renderSnapshot(first.snapshot, {
  ...settings,
  mainNodeMode: 'release',
})

expect(source.loadCalls).toBe(1)
expect(redraw.svg).not.toBe(first.svg)
```

Also assert source warnings and graph warnings are returned, default settings are Commit/Month/open-off/20, and the existing `RenderPipeline` tests remain unchanged.

- [ ] **Step 2: Run pipeline tests and verify RED**

Run: `npm test -- src/pipeline/ForkTimelinePipeline.test.ts`

Expected: FAIL because the pipeline does not exist.

- [ ] **Step 3: Implement pipeline orchestration**

Define:

```ts
export interface ForkTimelineSettings {
  grouping: TimelineGrouping
  mainNodeMode: MainNodeMode
  includeOpenPullRequests: boolean
  pullRequestLimit: GitPullRequestBranchLimit
}

export class ForkTimelinePipeline<TInput = GitSourceInput> {
  async render(input: TInput, settings: ForkTimelineSettings): Promise<ForkTimelinePipelineResult> {
    return this.renderSnapshot(await this.source.loadRepository(input), settings)
  }

  renderSnapshot(snapshot: GitSourceSnapshot, settings: ForkTimelineSettings): ForkTimelinePipelineResult {
    const graph = this.graphBuilder.build(snapshot, settings)
    const layout = new ForkTimelineLayout({ grouping: settings.grouping }).layout(graph.graph)
    const model = this.modelBuilder.build(layout)
    return { svg: this.renderer.render(model), snapshot, warnings: [...snapshot.warnings, ...graph.warnings] }
  }
}
```

Dependency injection mirrors the existing pipeline so tests can isolate layers.

- [ ] **Step 4: Run all pipeline tests and verify GREEN**

Run: `npm test -- src/pipeline`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/pipeline
git commit -m "feat: add fork timeline pipeline"
```

---

### Task 7: Integrate Graph Settings and Cached Redraw in the Existing Page

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`
- Modify: `src/App.test.tsx`
- Modify: `src/App.layout.test.ts`

**Interfaces:**
- Consumes: `ForkTimelinePipeline`, `ForkTimelineSettings`, and enriched source snapshots.
- Produces: the confirmed existing-page UI and incremental PR capacity interaction.

- [ ] **Step 1: Write failing default and placement tests**

Assert a separate `.graph-settings-panel` between `.control-panel` and `.snapshot`, plus:

```ts
expect(getTimelineGrouping().value).toBe('month')
expect(getMainNodeType().value).toBe('commit')
expect(getIncludeOpenPullRequests().checked).toBe(false)
expect(getPullRequestLimit().value).toBe('20')
```

Update the layout test to assert Repository Controls contains only Token/Repository/Branch/Generate and Graph Settings uses a responsive grid.

- [ ] **Step 2: Run App tests and verify RED**

Run: `npm test -- src/App.test.tsx src/App.layout.test.ts`

Expected: FAIL because Graph Settings and the new controls do not exist.

- [ ] **Step 3: Add translations, state, and existing-page markup**

Add translations for Graph Settings, Main node type, Commit, Release, Tag, Include open PR branches, PR branches, Open, partial data, and warning details in all three dictionaries.

Add state:

```ts
const [mainNodeMode, setMainNodeMode] = useState<MainNodeMode>('commit')
const [includeOpenPullRequests, setIncludeOpenPullRequests] = useState(false)
const [pullRequestLimit, setPullRequestLimit] = useState<GitPullRequestBranchLimit>(20)
```

Move Timeline Grouping out of `.repo-form` and into `.graph-settings-panel`. Keep Generate centered under Token/Repository/Branch.

- [ ] **Step 4: Write failing cached-redraw and top-up tests**

Extend `fixtureResponseFor` for `pulls`, `pulls/:number/commits`, `releases`, and `tags`. Assert grouping, main-node mode, and open visibility changes do not add requests. Assert changing PR limit 20 → 50 makes only missing PR commit requests and retains the current SVG until the promise resolves. Assert 50 → 10 makes no request.

- [ ] **Step 5: Run interaction tests and verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because App still uses the legacy pipeline and has no incremental setting flow.

- [ ] **Step 6: Switch App to `ForkTimelinePipeline`**

On Generate, create one `GitHubApiSource` and `ForkTimelinePipeline`, store the normalized source input in a ref, and request:

```ts
options: {
  maxCommitsPerBranch: 100,
  includeContributors: false,
  includePullRequests: true,
  includeReleases: true,
  includeTags: true,
  pullRequestBranchLimit: pullRequestLimit,
}
```

Display-only handlers call `pipeline.renderSnapshot(snapshot, nextSettings)`. A limit increase calls `pipeline.render` with the stored input and increased source option, keeps the current SVG visible, then replaces snapshot/SVG on success. A decrease is a local redraw.

- [ ] **Step 7: Render partial warnings and loading state**

Show a warning section above `SvgPreviewPanel`, with a summary and expandable PR-specific details. Disable settings during the initial repository load. During capacity top-up, disable only the PR limit control and show a localized inline loading indicator without clearing the SVG.

- [ ] **Step 8: Implement responsive CSS**

Use a separate settings grid with four fields on wide screens, two columns on tablet, and one column at the existing mobile breakpoint. Preserve the enlarged SVG viewport and existing pan/zoom classes.

- [ ] **Step 9: Run App tests and verify GREEN**

Run: `npm test -- src/App.test.tsx src/App.layout.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit**

```powershell
git add src/App.tsx src/App.css src/App.test.tsx src/App.layout.test.ts
git commit -m "feat: add fork timeline graph settings"
```

---

### Task 8: Full Regression, Browser Verification, and Documentation Sync

**Files:**
- Modify only files required by verified failures.
- Review: `docs/superpowers/specs/2026-07-14-fork-pr-timeline-design.md`
- Review: `README.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: a verified, user-testable upgrade on `dev`.

- [ ] **Step 1: Run the complete automated suite**

Run individually and preserve complete output:

```powershell
npm test
npm run build
npm run lint
```

Expected: all commands exit 0. If a behavior failure appears, write or refine the smallest failing regression test before changing production code.

- [ ] **Step 2: Verify Browser/Node runtime boundary**

Run: `npm run verify:build-boundaries`

Expected: exit 0 and no Browser output imports Node built-ins.

- [ ] **Step 3: Start the app and visually inspect the existing page**

Run: `npm run dev -- --host 127.0.0.1`

Using the in-app browser, verify desktop and narrow widths with a public repository that has external fork PRs:

- Graph Settings is separate and aligned.
- Generate stays centered in Repository Controls.
- merged PRs split and reconnect with colored curves;
- open PRs are absent by default and appear when enabled;
- Commit/Release/Tag and Year/Month/Day redraw without repository requests;
- labels and viewBox are not clipped;
- wheel zoom and dragging remain smooth.

- [ ] **Step 4: Sync README only if the existing quick-start section documents graph settings**

If README already enumerates Browser controls, add the four new Graph Settings and the GitHub Token recommendation. Do not add unrelated release notes.

- [ ] **Step 5: Re-run gates after any verification fix**

Run: `npm test && npm run build && npm run lint` using separate PowerShell commands if shell chaining obscures output.

Expected: all exit 0 with no failing or skipped required tests.

- [ ] **Step 6: Review the final diff against every design requirement**

Check external-fork/base filtering, open default, three main modes, PR commits, equal chronology, UTC grouping, lane reuse, exact/inferred curves, labels, colors, partial warnings, cache top-up, translations, and runtime boundary. Record any deliberate gap before claiming completion.

- [ ] **Step 7: Commit final verification fixes or README changes**

```powershell
git add <only-the-reviewed-files>
git commit -m "docs: document fork timeline controls"
```

Skip this commit when verification creates no changes.
