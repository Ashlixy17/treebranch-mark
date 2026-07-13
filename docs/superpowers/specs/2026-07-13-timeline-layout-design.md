# Timeline Layout Design

## Goal

Make Timeline the default Treebranch Mark layout. Commits appear in stable chronological order with equal horizontal spacing, while UTC year, month, or day groups add labels and vertical separator lines to the generated SVG.

The Browser Viewer exposes the grouping choice in its existing settings area. Changing the choice redraws the current SVG from the already loaded source snapshot and must not make another GitHub API request.

## Confirmed Product Decisions

- Timeline replaces Tree as the default layout.
- Commits are ordered by time but remain equally spaced.
- Grouping uses UTC so Browser and CLI output is reproducible across machines.
- The Browser Viewer offers year, month, and day grouping controls.
- SVG groups display both a date label and a vertical separator line.
- The default grouping is month.
- The CLI uses the default Timeline layout and monthly grouping in this stage.
- TreeLayout remains available as a supported layout implementation.

## Approaches Considered

### A. Layout-owned group metadata (selected)

TimelineLayout produces group geometry and labels alongside node and edge geometry. RenderModel copies that neutral information and SvgRenderer draws it.

This keeps the date-to-geometry decision in Layout, makes grouping available to all entry points, and ensures exported SVG files carry the same date context as the Browser preview.

### B. Renderer reads commit dates

SvgRenderer could inspect BranchGraph or commits to derive date groups. This would make a rendering layer depend on graph data and duplicate layout logic.

Rejected because it weakens existing layer boundaries.

### C. Browser-only group headers

App could draw date headers around the SVG preview. The exported SVG and CLI output would have no grouping context.

Rejected because the grouping must be part of the generated SVG.

## Architecture

```text
GitSourceSnapshot (cached in App)
        |
        +-- RenderPipeline.render(input) ---- Source load on first generation
        |
        +-- RenderPipeline.renderSnapshot(snapshot, { layout }) -- redraw without Source load
                                                        |
                                                        v
                                      TimelineLayout({ grouping })
                                                        |
                                                        v
                              LayoutResult (nodes, edges, date groups)
                                                        |
                                                        v
                              RenderModel (nodes, edges, date groups)
                                                        |
                                                        v
                          SvgRenderer (labels, separators, graph)
```

The Browser Viewer must continue to depend on Pipeline APIs rather than importing Parser, Graph Builder, RenderModel, or Renderer directly.

## Layout Contract

Generalize the existing Tree-specific layout dependency to a common Layout contract. TreeLayout and TimelineLayout both implement it.

```ts
interface Layout {
  layout(branchGraph: BranchGraph): LayoutResult
}

type TimelineGrouping = 'year' | 'month' | 'day'

interface TimelineLayoutOptions {
  grouping?: TimelineGrouping
}

interface LayoutGroup {
  id: string
  label: string
  startX: number
  endX: number
}

interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
  groups: LayoutGroup[]
}
```

`groups` contains only renderer-neutral geometry and text. It does not contain SVG tags, colors, font choices, or DOM information. TreeLayout returns an empty group list, preserving its current visual output.

## Timeline Algorithm

1. Collect reachable commit nodes and deduplicate them by SHA.
2. Resolve each timestamp from `committedAt`, falling back to `authoredAt`.
3. Sort by resolved timestamp, then stable discovery order, then SHA.
4. Assign every sorted commit the same `TIMELINE_COMMIT_GAP` increment.
5. Retain the existing deterministic branch-lane rule for y coordinates.
6. Group nodes by their UTC year, month, or day key.
7. Emit one LayoutGroup per contiguous key. Its label is `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`; its x range covers the group's commits.

The first group has no preceding separator. Each later group is separated at the midpoint between its first commit and the preceding commit. RenderModel and SvgRenderer derive this separator from adjacent groups, so LayoutGroup remains small and renderer-neutral.

When neither timestamp is valid, the commit belongs to a deterministic `Unknown date` group. This avoids throwing during rendering and keeps repeated output stable.

## Rendering

RenderModel receives an equivalent group collection with its node and edge data. SvgRenderer reserves header space above the graph, draws each group label at the start of its range, draws a vertical separator between adjacent group ranges, and extends its viewBox to include the header and separators. Existing commit, edge, and avatar rendering remains unchanged.

Labels use UTC ISO-like forms deliberately. They are stable in exported SVG files and independent of the Browser language setting or the executing machine's local time zone.

## Pipeline Redraw Boundary

`RenderPipeline.render(input)` continues to load a snapshot from its configured source, then delegates to the same internal snapshot-rendering path.

`RenderPipeline.renderSnapshot(snapshot, { layout? })` exposes that path without calling the source. It parses the supplied snapshot, builds the branch graph, applies the supplied layout or the Pipeline default, creates the RenderModel, and renders SVG. `render(input)` delegates to this same path with its configured layout after Source loading. This prevents the Browser from duplicating core orchestration while allowing a grouping change to redraw locally.

## Browser Settings

App keeps a `timelineGrouping` state with a default of `month`. A native select with year, month, and day choices appears in a Graph settings subsection of the existing control panel, beneath the repository form.

- Before a repository is loaded, the selected value configures the next graph generation.
- On Generate graph, App constructs TimelineLayout using the selected grouping and runs the regular Pipeline load path.
- After a snapshot is loaded, changing the setting calls the Pipeline snapshot redraw path with the selected TimelineLayout.
- The grouping change preserves the snapshot, metrics, repository details, and rate-limit state, and makes no source request.

All new Browser strings are added to the existing Chinese, English, and Japanese dictionaries.

## Error Handling and Determinism

- Empty graphs produce empty nodes, edges, and groups.
- Invalid or absent dates produce the `Unknown date` group rather than an exception.
- Group output is ordered by the same sorted commit order as layout nodes.
- Same input and grouping always produce identical LayoutResult, RenderModel, and SVG output.
- Snapshot redraw errors follow the existing request error presentation without discarding the last valid snapshot.

## Testing

Add focused tests for equal commit spacing and stable chronological ordering; UTC month, year, and day boundaries; fallback and grouping of invalid timestamps; group label/range determinism and an empty graph; TreeLayout compatibility with empty groups; RenderModel preservation of group data; SVG labels, separators, escaping, and an uncropped viewBox; RenderPipeline.renderSnapshot without a source call; App grouping changes that redraw cached data without invoking GitHub API; and App strings and initial/default grouping behavior.

Existing source, Parser, Graph Builder, TreeLayout, avatar, CLI, and Browser tests remain part of the full regression suite.

## Scope

This stage changes Layout, RenderModel, SvgRenderer, RenderPipeline, and the existing Browser control panel. It does not change Source contracts, Parser behavior, BranchGraph construction, commit fetching, GitHub API behavior, or add a CLI grouping flag.

## Definition of Done

- TimelineLayout is the Pipeline default.
- Browser SVG output has equal chronological commit spacing.
- Browser grouping controls use UTC year, month, and day values.
- Generated SVG shows date labels and separators for each group.
- Changing grouping redraws the current snapshot without a source request.
- CLI produces the default monthly Timeline SVG.
- TreeLayout remains usable and all existing behavior remains covered.
- `npm test`, `npm run build`, and `npm run lint` pass.
