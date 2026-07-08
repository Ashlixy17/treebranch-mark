# ADR 0004: RenderModel Boundary

## Context

Layout produces pure geometry, but renderers need display-facing data such as labels and style tokens.

The project needs SVG first, but future Canvas, WebGL, export, and theme systems should share the same render-ready data model.

## Decision

Add a RenderModel layer between Layout and Renderer.

RenderModel consumes:

```text
LayoutResult + BranchGraph
```

RenderModel produces:

```ts
interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
}
```

The MVP supports only commit nodes:

```ts
type RenderNodeKind = 'commit'
```

`RenderNode.kind` is still a union type so future node kinds can be added without changing the `RenderNode` structure.

RenderModel remains pure data and must be serializable.

## Consequences

SVG Renderer does not need to know BranchGraph or Layout internals.

Future Canvas and WebGL renderers can consume the same RenderModel.

Future branch labels, tags, merge points, heads, annotations, and legends can extend `RenderNodeKind`.

## Alternatives Considered

Rendering directly from `LayoutResult` was rejected because labels and style tokens would either be missing or pushed into Layout.

Letting SVG Renderer query `BranchGraph` directly was rejected because it would couple renderers to graph internals.
