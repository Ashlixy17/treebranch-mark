# Timeline Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make UTC-grouped, equally-spaced TimelineLayout the default output and let the Browser redraw its cached snapshot by year, month, or day.

**Architecture:** TimelineLayout emits renderer-neutral date groups in LayoutResult. RenderModel preserves those groups, SvgRenderer draws their labels and separators, and RenderPipeline exposes a source-free snapshot rendering path for the Browser setting.

**Tech Stack:** TypeScript 6, React 19, Vite 8, Vitest 4, SVG.

## Global Constraints

- Work directly on the existing `dev` branch; do not create a worktree or branch.
- Keep commit positions equally spaced and order them by UTC-resolved commit time.
- Use `committedAt`, then `authoredAt`; invalid values join the deterministic `Unknown date` group.
- Use `year`, `month`, and `day` UTC grouping, defaulting to `month`.
- Generated SVG groups must contain labels and vertical separator lines.
- Browser grouping changes must redraw a loaded snapshot without calling GitHub.
- Keep Source, Parser, and BranchGraph responsibilities unchanged.
- Do not add a CLI grouping argument in this stage.

---

### Task 1: Add Timeline layout contracts and geometry

**Files:**
- Create: `src/layout/TimelineLayout.ts`
- Create: `src/layout/TimelineLayout.test.ts`
- Modify: `src/layout/types.ts`
- Modify: `src/layout/index.ts`
- Modify: `src/layout/TreeLayout.ts`
- Modify: `src/layout/TreeLayout.test.ts`

**Interfaces:**
- Consumes: `BranchGraph`, `BranchNode`, and `CommitNode`.
- Produces: `Layout`, `TimelineGrouping`, `TimelineLayoutOptions`, `LayoutGroup`, and `TimelineLayout`.
- Preserves: `TreeLayout.layout(graph)` returns the same nodes and edges as before plus `groups: []`.

- [ ] **Step 1: Write the failing Timeline layout tests**

```ts
it('uses equal x gaps and UTC month groups', () => {
  const result = new TimelineLayout({ grouping: 'month' }).layout(graph)

  expect(result.nodes.map((node) => node.x)).toEqual([0, COMMIT_COLUMN_GAP, COMMIT_COLUMN_GAP * 2])
  expect(result.groups).toEqual([
    { id: '2026-01', label: '2026-01', startX: 0, endX: COMMIT_COLUMN_GAP },
    { id: '2026-02', label: '2026-02', startX: COMMIT_COLUMN_GAP * 2, endX: COMMIT_COLUMN_GAP * 2 },
  ])
})

it('groups a timestamp at a UTC month boundary by its UTC month', () => {
  const result = new TimelineLayout({ grouping: 'month' }).layout(boundaryGraph)
  expect(result.groups.map((group) => group.label)).toEqual(['2026-01', '2026-02'])
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- src/layout/TimelineLayout.test.ts`

Expected: the test fails because `TimelineLayout` is not exported or `groups` does not exist.

- [ ] **Step 3: Add the common layout contract and minimal TimelineLayout**

```ts
export interface Layout {
  layout(branchGraph: BranchGraph): LayoutResult
}

export type TimelineGrouping = 'year' | 'month' | 'day'

export interface LayoutGroup {
  id: string
  label: string
  startX: number
  endX: number
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  groups: LayoutGroup[]
}
```

Implement `TimelineLayout` by reusing TreeLayout's stable node discovery, timestamp ordering, y-lane assignment, and edge collection rules. Format group keys with UTC getters. Return `Unknown date` when both timestamps are invalid. Make `TreeLayout` implement `Layout` and append `groups: []` to every result.

- [ ] **Step 4: Run focused layout tests to verify GREEN**

Run: `npm test -- src/layout/TimelineLayout.test.ts src/layout/TreeLayout.test.ts`

Expected: Timeline UTC/equal-spacing tests and existing Tree tests pass.

- [ ] **Step 5: Commit the layout task**

```bash
git add src/layout
git commit -m "feat: add UTC timeline layout"
```

### Task 2: Carry date groups into the SVG output

**Files:**
- Modify: `src/render-model/types.ts`
- Modify: `src/render-model/RenderModelBuilder.ts`
- Modify: `src/render-model/RenderModelBuilder.test.ts`
- Modify: `src/renderer/svg/SvgRenderer.ts`
- Modify: `src/renderer/svg/SvgRenderer.test.ts`

**Interfaces:**
- Consumes: `LayoutResult.groups` from Task 1.
- Produces: `RenderModel.groups` with the same `id`, `label`, `startX`, and `endX` fields.
- Preserves: models with `groups: []` produce the existing graph SVG structure.

- [ ] **Step 1: Write failing render-model and SVG tests**

```ts
expect(builder.build(layoutWithGroups, graph).groups).toEqual([
  { id: '2026-01', label: '2026-01', startX: 0, endX: 120 },
])

expect(renderer.render(modelWithTwoGroups)).toContain('>2026-01</text>')
expect(renderer.render(modelWithTwoGroups)).toContain('<line x1="180"')
expect(renderer.render(modelWithTwoGroups)).toContain('viewBox="-36 -')
```

- [ ] **Step 2: Run focused tests to verify RED**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts src/renderer/svg/SvgRenderer.test.ts`

Expected: the new group assertions fail because RenderModel and SvgRenderer do not yet expose groups.

- [ ] **Step 3: Implement group preservation and rendering**

```ts
export interface RenderGroup {
  id: string
  label: string
  startX: number
  endX: number
}

export interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
  groups: RenderGroup[]
}
```

Copy `layout.groups` in RenderModelBuilder. In SvgRenderer, compute a header y coordinate above the lowest node y, add escaped group labels at each `startX`, and add a separator at `(previous.endX + group.startX) / 2` for every group after the first. Update viewBox bounds to include the header and separator extents. Add `groups: []` to existing RenderModel fixtures.

- [ ] **Step 4: Run focused tests to verify GREEN**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts src/renderer/svg/SvgRenderer.test.ts`

Expected: group propagation, label/separator rendering, escaping, viewBox, avatar, and golden SVG tests pass.

- [ ] **Step 5: Commit the rendering task**

```bash
git add src/render-model src/renderer
git commit -m "feat: render timeline date groups"
```

### Task 3: Default Pipeline to Timeline and add cached snapshot rendering

**Files:**
- Modify: `src/pipeline/types.ts`
- Modify: `src/pipeline/RenderPipeline.ts`
- Modify: `src/pipeline/RenderPipeline.test.ts`
- Modify: `src/source/local/LocalRenderPipeline.test.ts`

**Interfaces:**
- Consumes: `Layout` and `TimelineLayout` from Task 1.
- Produces: `RenderPipeline.renderSnapshot(snapshot, { layout? })` and Timeline as the default layout.
- Preserves: `render(input)` loads exactly one snapshot through the configured Source and returns the same result shape.

- [ ] **Step 1: Write the failing Pipeline tests**

```ts
it('renders a supplied snapshot without loading the source', async () => {
  const source = new ThrowingSource(new Error('must not load'))
  const snapshot = snapshotFixture()
  const result = await new RenderPipeline({ source }).renderSnapshot(snapshot)

  expect(result.snapshot).toBe(snapshot)
  expect(result.svg).toContain('2026-01')
})

it('uses TimelineLayout when no layout is supplied', async () => {
  const result = await new RenderPipeline({ source: new FakeSource(snapshotFixture()) }).render(input)
  expect(result.svg).toContain('2026-01')
})
```

- [ ] **Step 2: Run the Pipeline tests to verify RED**

Run: `npm test -- src/pipeline/RenderPipeline.test.ts src/source/local/LocalRenderPipeline.test.ts`

Expected: the tests fail because `renderSnapshot` is unavailable and the default SVG has no date grouping.

- [ ] **Step 3: Implement a single snapshot render path**

```ts
async render(input: TInput): Promise<RenderPipelineResult> {
  return this.renderSnapshot(await this.dependencies.source.loadRepository(input))
}

renderSnapshot(
  snapshot: GitSourceSnapshot,
  overrides: { layout?: Layout } = {},
): RenderPipelineResult {
  const parserResult = this.dependencies.parser.parse(snapshot)
  const graphResult = this.dependencies.graphBuilder.build(parserResult.graph, snapshot.branches)
  const layout = (overrides.layout ?? this.dependencies.layout).layout(graphResult.graph)
  const renderModel = this.dependencies.renderModelBuilder.build(layout, graphResult.graph)

  return {
    svg: this.dependencies.renderer.render(renderModel),
    snapshot,
    parserWarnings: parserResult.warnings,
    graphWarnings: graphResult.warnings,
  }
}
```

Make the method synchronous unless an existing dependency requires async; keep `render` asynchronous only for Source loading. Replace the default `new TreeLayout()` with `new TimelineLayout()` and update dependency types to use `Layout`.

- [ ] **Step 4: Run focused Pipeline tests to verify GREEN**

Run: `npm test -- src/pipeline/RenderPipeline.test.ts src/source/local/LocalRenderPipeline.test.ts`

Expected: render, source-free redraw, Browser-source compatibility, and Local Git Pipeline tests pass.

- [ ] **Step 5: Commit the Pipeline task**

```bash
git add src/pipeline src/source/local/LocalRenderPipeline.test.ts
git commit -m "feat: support cached timeline redraws"
```

### Task 4: Add grouping controls to the existing Browser settings panel

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `TimelineGrouping`, `TimelineLayout`, and `RenderPipeline.renderSnapshot`.
- Produces: native `#timeline-grouping` select and source-free group changes.
- Preserves: token storage, repository loading, metrics, rate-limit status, and translations.

- [ ] **Step 1: Write failing App tests**

```ts
it('renders month as the default graph grouping setting', () => {
  renderApp()
  expect(getTimelineGrouping().value).toBe('month')
})

it('redraws the loaded snapshot when grouping changes without another fetch', async () => {
  const capturedUrls: string[] = []
  globalThis.fetch = async (input) => {
    capturedUrls.push(String(input))
    return fixtureResponseFor(input)
  }
  renderApp()
  await submitRepositoryForm()
  const requestCount = capturedUrls.length

  changeSelectValue(getTimelineGrouping(), 'day')

  expect(capturedUrls).toHaveLength(requestCount)
  expect(document.querySelector('.svg-preview')?.textContent).toContain('2026-01-01')
})
```

- [ ] **Step 2: Run the App tests to verify RED**

Run: `npm test -- src/App.test.tsx`

Expected: the grouping select does not exist and cached redraw behavior is unavailable.

- [ ] **Step 3: Implement settings state, redraw, translations, and responsive styling**

```tsx
const [timelineGrouping, setTimelineGrouping] = useState<TimelineGrouping>('month')
const pipelineRef = useRef<RenderPipeline<GitSourceInput> | null>(null)

<label className="field grouping-field" htmlFor="timeline-grouping">
  <span>{t.timelineGrouping}</span>
  <select id="timeline-grouping" value={timelineGrouping} onChange={handleTimelineGroupingChange}>
    <option value="year">{t.timelineGroupingYear}</option>
    <option value="month">{t.timelineGroupingMonth}</option>
    <option value="day">{t.timelineGroupingDay}</option>
  </select>
</label>
```

Add equivalent Chinese, English, and Japanese strings. Build TimelineLayout from the selected grouping for initial generation and save that Pipeline instance in `pipelineRef`. On selection changes, retain the current snapshot and call `pipelineRef.current?.renderSnapshot(snapshot, { layout: new TimelineLayout({ grouping }) })`; do not instantiate or call a Source. Place the field under the existing repo form and add light/dark/mobile select styling matching current fields.

- [ ] **Step 4: Run focused App tests to verify GREEN**

Run: `npm test -- src/App.test.tsx`

Expected: setting defaults, translations, and cached redraw pass; existing token tests remain green.

- [ ] **Step 5: Commit the Browser task**

```bash
git add src/App.tsx src/App.test.tsx src/App.css
git commit -m "feat: add timeline grouping controls"
```

### Task 5: Complete regression verification and documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: completed Timeline pipeline and Browser setting.
- Produces: user documentation that identifies Timeline as the default layout and its Browser grouping choices.

- [ ] **Step 1: Write the documentation text**

```text
Timeline is the default graph layout. In the Browser Viewer, choose UTC year,
month, or day grouping in Graph settings; changing it redraws the loaded graph
without another repository request.
```

- [ ] **Step 2: Add the minimal README change**

Add the exact Timeline behavior and the lack of a CLI grouping option to the existing architecture/usage sections. Do not alter the already released v0.2.0 release notes.

- [ ] **Step 3: Run the complete test suite**

Run: `npm test`

Expected: all test files pass with zero failures.

- [ ] **Step 4: Run production build and lint**

Run: `npm run build`

Expected: TypeScript, Browser build, CLI build, and build-boundary verification exit 0.

Run: `npm run lint`

Expected: oxlint exits 0 with no diagnostics.

- [ ] **Step 5: Commit the verification and documentation task**

```bash
git add README.md
git commit -m "docs: document timeline layout"
```
