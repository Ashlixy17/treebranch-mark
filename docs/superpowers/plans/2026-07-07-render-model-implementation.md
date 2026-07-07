# RenderModel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Step 5 RenderModel layer that converts `LayoutResult + BranchGraph` into serializable renderer-ready commit data.

**Architecture:** Add a focused `src/render-model` module with public types, a `RenderModelBuilder`, and unit tests. The builder will copy layout coordinates, derive compact commit labels, attach renderer-neutral style tokens, and keep output independent from SVG, Canvas, React, DOM, and theme state.

**Tech Stack:** TypeScript, Vitest, existing `BranchGraph` and `LayoutResult` modules.

## Global Constraints

- RenderModel input is `LayoutResult + BranchGraph`.
- RenderModel output is plain serializable data.
- RenderModel must not depend on React, DOM, SVG API, Canvas API, WebGL API, CSS, browser globals, theme state, or UI components.
- RenderModel must not contain branch labels, lane labels, tooltips, hover state, selection state, animation state, theme colors, SVG paths, Canvas objects, DOM nodes, or React components.
- MVP node kind is `RenderNodeKind = 'commit'`.
- MVP node style token is `'commit'`.
- MVP edge style token is `'commit-edge'`.
- Use TDD: write failing tests before production code.

---

## File Structure

- Create `src/render-model/types.ts`
  - Owns `RenderModel`, `RenderNode`, `RenderEdge`, `RenderNodeKind`, `RenderNodeStyleToken`, `RenderEdgeStyleToken`, and `RenderModelBuilder` interfaces.
- Create `src/render-model/RenderModelBuilder.ts`
  - Owns the pure TypeScript builder implementation.
- Create `src/render-model/RenderModelBuilder.test.ts`
  - Owns all Step 5 behavior tests.
- Create `src/render-model/index.ts`
  - Re-exports the public RenderModel API.
- Modify `README.md`
  - Mark RenderModel as implemented after tests pass.
  - Add RenderModel to project structure and testing coverage.

---

### Task 1: Public RenderModel Types

**Files:**
- Create: `src/render-model/types.ts`
- Create: `src/render-model/index.ts`
- Test: `src/render-model/RenderModelBuilder.test.ts`

**Interfaces:**
- Consumes: `LayoutResult` from `src/layout`, `BranchGraph` from `src/graph`
- Produces:

```ts
export type RenderNodeKind = 'commit'
export type RenderNodeStyleToken = 'commit'
export type RenderEdgeStyleToken = 'commit-edge'

export interface RenderModel {
  nodes: RenderNode[]
  edges: RenderEdge[]
}

export interface RenderNode {
  id: string
  x: number
  y: number
  label: string
  kind: RenderNodeKind
  styleToken: RenderNodeStyleToken
}

export interface RenderEdge {
  from: string
  to: string
  styleToken: RenderEdgeStyleToken
}

export interface RenderModelBuilder {
  build(layout: LayoutResult, graph: BranchGraph): RenderModel
}
```

- [ ] **Step 1: Write the failing type-oriented behavior test**

```ts
import { describe, expect, it } from 'vitest'
import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'
import { RenderModelBuilder } from './RenderModelBuilder'

describe('RenderModelBuilder', () => {
  it('returns an empty render model for an empty layout', () => {
    const builder = new RenderModelBuilder()
    const layout: LayoutResult = { nodes: [], edges: [] }
    const graph: BranchGraph = { branches: new Map() }

    expect(builder.build(layout, graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: FAIL because `src/render-model/RenderModelBuilder.ts` does not exist.

- [ ] **Step 3: Add public types and minimal builder**

Create `src/render-model/types.ts` with the interfaces above.

Create `src/render-model/RenderModelBuilder.ts`:

```ts
import type { BranchGraph } from '../graph'
import type { LayoutResult } from '../layout'
import type { RenderModel, RenderModelBuilder as RenderModelBuilderContract } from './types'

export class RenderModelBuilder implements RenderModelBuilderContract {
  build(layout: LayoutResult, _graph: BranchGraph): RenderModel {
    return {
      nodes: layout.nodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        label: node.id.slice(0, 7),
        kind: 'commit',
        styleToken: 'commit',
      })),
      edges: layout.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        styleToken: 'commit-edge',
      })),
    }
  }
}
```

Create `src/render-model/index.ts`:

```ts
export { RenderModelBuilder } from './RenderModelBuilder'
export type {
  RenderEdge,
  RenderEdgeStyleToken,
  RenderModel,
  RenderModelBuilder as RenderModelBuilderContract,
  RenderNode,
  RenderNodeKind,
  RenderNodeStyleToken,
} from './types'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: PASS.

---

### Task 2: Node And Edge Mapping Behavior

**Files:**
- Modify: `src/render-model/RenderModelBuilder.test.ts`
- Modify: `src/render-model/RenderModelBuilder.ts`

**Interfaces:**
- Consumes: `RenderModelBuilder.build(layout, graph)`
- Produces: render nodes with `id`, `x`, `y`, `label`, `kind`, `styleToken`; render edges with `from`, `to`, `styleToken`

- [ ] **Step 1: Add failing mapping tests**

Add tests for:

```ts
it('maps layout nodes to commit render nodes', () => {
  const builder = new RenderModelBuilder()
  const layout: LayoutResult = {
    nodes: [{ id: 'abcdef1234567890', x: 120, y: 100 }],
    edges: [],
  }
  const graph = graphFixture([commitNodeFixture('abcdef1234567890')])

  expect(builder.build(layout, graph).nodes).toEqual([
    {
      id: 'abcdef1234567890',
      x: 120,
      y: 100,
      label: 'abcdef1',
      kind: 'commit',
      styleToken: 'commit',
    },
  ])
})

it('maps layout edges to commit-edge render edges', () => {
  const builder = new RenderModelBuilder()
  const layout: LayoutResult = {
    nodes: [],
    edges: [{ from: 'parent', to: 'child' }],
  }
  const graph: BranchGraph = { branches: new Map() }

  expect(builder.build(layout, graph).edges).toEqual([
    {
      from: 'parent',
      to: 'child',
      styleToken: 'commit-edge',
    },
  ])
})
```

- [ ] **Step 2: Run test to verify failure if mapping is incomplete**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: FAIL if node or edge mapping omits required fields.

- [ ] **Step 3: Implement or adjust minimal mapping**

Keep implementation limited to copying coordinates and edges and assigning:

```ts
kind: 'commit'
styleToken: 'commit'
```

for nodes, and:

```ts
styleToken: 'commit-edge'
```

for edges.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: PASS.

---

### Task 3: Serialization, Fallback, And Immutability

**Files:**
- Modify: `src/render-model/RenderModelBuilder.test.ts`
- Modify: `src/render-model/RenderModelBuilder.ts`

**Interfaces:**
- Consumes: `RenderModel`
- Produces: serializable plain data and no input mutation

- [ ] **Step 1: Add failing resilience tests**

Add tests for:

```ts
it('falls back to a short id label when a layout node is not in the branch graph', () => {
  const builder = new RenderModelBuilder()
  const layout: LayoutResult = {
    nodes: [{ id: 'unknown123456', x: 0, y: 0 }],
    edges: [],
  }
  const graph: BranchGraph = { branches: new Map() }

  expect(builder.build(layout, graph).nodes[0]?.label).toBe('unknown')
})

it('returns JSON serializable plain data', () => {
  const builder = new RenderModelBuilder()
  const layout: LayoutResult = {
    nodes: [{ id: 'abcdef1234567890', x: 120, y: 100 }],
    edges: [{ from: 'parent', to: 'abcdef1234567890' }],
  }
  const graph = graphFixture([commitNodeFixture('abcdef1234567890')])

  const renderModel = builder.build(layout, graph)

  expect(JSON.parse(JSON.stringify(renderModel))).toEqual(renderModel)
})

it('does not mutate layout or branch graph inputs', () => {
  const builder = new RenderModelBuilder()
  const commit = commitNodeFixture('abcdef1234567890')
  const graph = graphFixture([commit])
  const layout: LayoutResult = {
    nodes: [{ id: commit.commit.sha, x: 120, y: 100 }],
    edges: [],
  }
  const beforeLayout = structuredClone(layout)
  const beforeGraph = snapshotBranchGraph(graph)

  builder.build(layout, graph)

  expect(layout).toEqual(beforeLayout)
  expect(snapshotBranchGraph(graph)).toEqual(beforeGraph)
})
```

- [ ] **Step 2: Run test to verify failure if serialization or immutability is broken**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: PASS if previous implementation already satisfies these constraints; if not, FAIL with the specific broken behavior.

- [ ] **Step 3: Adjust implementation only if tests fail**

Do not add `Map`, `Set`, class instances, functions, or graph references to `RenderModel`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/render-model/RenderModelBuilder.test.ts`

Expected: PASS.

---

### Task 4: README And Full Verification

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: implemented `src/render-model` module
- Produces: updated project status and directory structure docs

- [ ] **Step 1: Update README**

Update README to show:

- RenderModel MVP completed
- `src/render-model/` in directory structure
- RenderModel tests in testing coverage
- Next stage is SVG Renderer

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected:

- `npm test`: all tests pass
- `npm run build`: TypeScript and Vite build pass
- `npm run lint`: Oxlint reports no blocking errors

- [ ] **Step 3: Commit**

Run:

```bash
git add src/render-model README.md docs/superpowers/plans/2026-07-07-render-model-implementation.md
git commit -m "feat: add render model builder"
```

