# ADR 0003: LayoutResult Boundary

## Context

treebranch-mark needs multiple future visualizations such as Tree, Timeline, Metro, River, Circular, and other layouts.

If layout data contains renderer details, every new renderer or visual style would force changes to layout algorithms.

## Decision

Layout consumes `BranchGraph` and produces a renderer-neutral `LayoutResult`.

```ts
interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

interface LayoutNode {
  id: string
  x: number
  y: number
}

interface LayoutEdge {
  from: string
  to: string
}
```

Layout only computes coordinates and edge relationships.

Layout does not include labels, colors, styles, SVG, Canvas objects, DOM nodes, animations, or interactions.

## Consequences

Different renderers can consume the same layout result through RenderModel.

New layouts can be added without changing SVG rendering.

Tree Layout can stay simple and deterministic for the MVP.

## Alternatives Considered

Writing `x` and `y` directly into `BranchGraph` was rejected because graph data should not depend on a specific layout.

Generating SVG directly from Layout was rejected because it would couple algorithm output to one renderer.
