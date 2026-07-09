# Avatar Commit Nodes Design

## Goal

Render a GitHub author's avatar as the visual node for a commit while preserving
the existing circle node as a fallback.

## Data Flow

```text
GitCommit.author.avatarUrl
        |
        v
RenderModelBuilder
        |
        v
RenderNode.avatarUrl
        |
        v
SvgRenderer
```

Source already maps GitHub author identity data into `GitIdentity`, including
`avatarUrl`. Parser keeps the original `GitCommit` on each `CommitNode`, so
neither layer needs a production-code change.

## Decision

`RenderNode` gains an explicit `avatarUrl: string | null` field. The
`RenderModelBuilder` resolves each layout node to its commit and copies
`commit.author.avatarUrl` into that field. Unknown layout nodes use `null`.

Avatar is a commit-node visual attribute and only applies to a `RenderNode`
whose `kind` is `commit`.

`SvgRenderer` renders:

- A 32 by 32 pixel `<image>` when `avatarUrl` is not `null`.
- The existing `<circle>` when `avatarUrl` is `null`.
- The existing short SHA label in both cases.

Avatar images use one reusable SVG `<clipPath>` with
`clipPathUnits="objectBoundingBox"` so every image is circular without
node-specific clip identifiers. The avatar URL is emitted through
`SvgBuilder`, which escapes XML attribute values.

## Layer Boundaries

- Source does not know avatar dimensions or rendering behavior.
- Parser does not add graph-specific avatar fields.
- Layout remains pure geometry and does not change.
- RenderModel carries renderer-ready avatar data.
- SvgRenderer does not query GitHub, Source, Parser, or Graph.

## Alternatives Considered

### Renderer reads BranchGraph

Rejected because it couples the renderer to graph analysis and bypasses
RenderModel.

### Add an avatar-specific node kind

Rejected because the node remains a commit. Avatar is an optional visual
attribute, not a new semantic node type.

### Render square images without clipping

Rejected because it changes the visual language of commit nodes and does not
meet the circular-avatar requirement.

## Error And Fallback Behavior

Missing or unmatched GitHub users produce `avatarUrl: null` and render the
existing circle. Image loading failures are handled by the SVG viewer and do
not trigger network retries, embedding, or renderer-side fallback logic in this
MVP.

## Tests

- GitHub Source mapping retains `author.avatarUrl`.
- Parser retains the original author data without mutation.
- RenderModel maps an author avatar and emits `null` when unavailable.
- SvgRenderer emits `<image>` and a circular clip for avatars.
- Avatar URLs are XML-escaped.
- Nodes without avatars retain the existing circle.
- Golden SVG output remains deterministic.

## Non-Goals

- Avatar caching
- Base64 embedding
- Hover or tooltip behavior
- Author panels or statistics
- Animation
- Multi-provider avatar resolution
- Theme changes

## Definition Of Done

- Avatar data flows only through GitCommit, RenderModel, and SvgRenderer.
- Commit avatars render as fixed 32 pixel circles.
- Missing avatars render the original circle.
- SVG output remains standalone and deterministic.
- Tests, build, and lint pass.
