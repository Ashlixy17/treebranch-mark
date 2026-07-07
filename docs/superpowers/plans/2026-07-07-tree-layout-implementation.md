# Tree Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Step 4 Tree Layout so `BranchGraph` can be converted into renderer-neutral `LayoutResult` coordinates and edges.

**Architecture:** Add a new pure TypeScript `src/layout` layer. The layout consumes only `BranchGraph`, traverses commit nodes from branch heads, assigns deterministic `x` and `y` coordinates, deduplicates edges, and returns a small `LayoutResult` model with no renderer fields.

**Tech Stack:** TypeScript, Vitest, existing `src/graph`, `src/parser`, and `src/source` contracts.

## Global Constraints

- Layout input is `BranchGraph`.
- Layout output is `LayoutResult`.
- Layout must not take `CommitGraph` as a separate input.
- Layout must not mutate `BranchGraph`, `BranchNode`, `CommitNode`, or Source data.
- `LayoutResult.nodes` must contain only `id`, `x`, and `y`.
- `LayoutResult.edges` must contain only `from` and `to`.
- Layout must not depend on React, DOM, SVG API, Canvas API, CSS, browser globals, theme state, or UI components.
- Layout must not contain labels, colors, styles, icons, fonts, animation, or interaction data.
- Default branch sorts first; remaining branches sort by name.
- Branch lane gap is `100`.
- Commit column gap is `120`.
- Branch head commits are placed on their own branch lanes.
- If multiple branches point to the same head SHA, the first branch in sorted order owns that layout node.
- Shared ancestor commits use the first sorted branch lane that reaches them.
- Edges are directed from parent commit SHA to child commit SHA.
- Duplicate edges are removed with the key `` `${from}->${to}` ``.

---

## File Structure

- Create `src/layout/types.ts`
  - Owns `LayoutNode`, `LayoutEdge`, `LayoutResult`, `TreeLayout` contracts and layout spacing constants.
- Create `src/layout/TreeLayout.ts`
  - Owns the MVP tree layout algorithm.
- Create `src/layout/index.ts`
  - Re-exports layout public API.
- Create `src/layout/TreeLayout.test.ts`
  - Owns unit tests for empty graph, branch ordering, lane assignment, branch head lane priority, chronological x assignment, equal timestamp tie-breaking, edge generation, edge deduplication, and renderer-neutral output.
- Read `docs/superpowers/specs/2026-07-07-tree-layout-design.md`
  - Confirms the implementation follows the approved architecture.

---

### Task 1: Verify Tree Layout Design Preconditions

**Files:**
- Read: `docs/superpowers/specs/2026-07-07-tree-layout-design.md`

**Interfaces:**
- Consumes: Current Step 4 architecture design.
- Produces: Confirmation that the implementation can proceed from a fixed design.

- [ ] **Step 1: Confirm the spec contains timestamp tie-breaking**

Run:

```bash
rg -n "same timestamp|stable discovery order|SHA string comparison" docs/superpowers/specs/2026-07-07-tree-layout-design.md
```

Expected: Lines are printed for all three phrases.

- [ ] **Step 2: Confirm the spec contains branch head lane priority**

Run:

```bash
rg -n "head.*own lane|same head SHA|first branch in sorted order" docs/superpowers/specs/2026-07-07-tree-layout-design.md
```

Expected: Lines are printed for branch head lane ownership and same-head tie-breaking.

- [ ] **Step 3: Confirm the spec contains edge deduplication**

Run:

```bash
rg -n "Duplicate edges|from.*to|edge deduplication" docs/superpowers/specs/2026-07-07-tree-layout-design.md
```

Expected: Lines are printed for duplicate edge behavior and the test requirement.

- [ ] **Step 4: Confirm the spec is clean before code work**

Run:

```bash
git status -sb
```

Expected: No uncommitted changes in `docs/superpowers/specs/2026-07-07-tree-layout-design.md`.

---

### Task 2: Add Layout Public Types And Empty Graph Behavior

**Files:**
- Create: `src/layout/types.ts`
- Create: `src/layout/TreeLayout.ts`
- Create: `src/layout/index.ts`
- Create: `src/layout/TreeLayout.test.ts`

**Interfaces:**
- Consumes: `BranchGraph` from `src/graph`.
- Produces:

```ts
export const BRANCH_LANE_GAP = 100
export const COMMIT_COLUMN_GAP = 120

export interface LayoutNode {
  id: string
  x: number
  y: number
}

export interface LayoutEdge {
  from: string
  to: string
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

export interface TreeLayout {
  layout(branchGraph: BranchGraph): LayoutResult
}
```

- [ ] **Step 1: Write the failing empty graph test**

Add this initial test file:

```ts
import { describe, expect, it } from 'vitest'
import type { BranchGraph } from '../graph'
import { TreeLayout } from './TreeLayout'

describe('TreeLayout', () => {
  it('returns an empty layout for an empty branch graph', () => {
    const layout = new TreeLayout()
    const graph: BranchGraph = {
      branches: new Map(),
    }

    expect(layout.layout(graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: FAIL because `src/layout/TreeLayout.ts` does not exist yet.

- [ ] **Step 3: Add the layout type contracts**

Create `src/layout/types.ts`:

```ts
import type { BranchGraph } from '../graph'

export const BRANCH_LANE_GAP = 100
export const COMMIT_COLUMN_GAP = 120

export interface LayoutNode {
  id: string
  x: number
  y: number
}

export interface LayoutEdge {
  from: string
  to: string
}

export interface LayoutResult {
  nodes: LayoutNode[]
  edges: LayoutEdge[]
}

export interface TreeLayout {
  layout(branchGraph: BranchGraph): LayoutResult
}
```

Create `src/layout/TreeLayout.ts`:

```ts
import type { BranchGraph } from '../graph'
import type { LayoutResult, TreeLayout as TreeLayoutContract } from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(_branchGraph: BranchGraph): LayoutResult {
    return {
      nodes: [],
      edges: [],
    }
  }
}
```

Create `src/layout/index.ts`:

```ts
export { TreeLayout } from './TreeLayout'
export type { LayoutEdge, LayoutNode, LayoutResult, TreeLayout as TreeLayoutContract } from './types'
export { BRANCH_LANE_GAP, COMMIT_COLUMN_GAP } from './types'
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: PASS for the empty graph test.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/layout/types.ts src/layout/TreeLayout.ts src/layout/index.ts src/layout/TreeLayout.test.ts
git commit -m "feat(layout): add tree layout contract"
```

Expected: A commit containing the new layout module scaffold.

---

### Task 3: Implement Branch Sorting And Y Lane Assignment

**Files:**
- Modify: `src/layout/TreeLayout.test.ts`
- Modify: `src/layout/TreeLayout.ts`

**Interfaces:**
- Consumes: `BranchGraph.branches: Map<string, BranchNode>`.
- Produces: `LayoutNode.y` values using default branch first, then branch name order.

- [ ] **Step 1: Add fixtures and the failing branch lane test**

Replace `src/layout/TreeLayout.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import type { GitBranch, GitCommit } from '../source'
import { BRANCH_LANE_GAP } from './types'
import { TreeLayout } from './TreeLayout'

describe('TreeLayout', () => {
  it('returns an empty layout for an empty branch graph', () => {
    const layout = new TreeLayout()
    const graph: BranchGraph = {
      branches: new Map(),
    }

    expect(layout.layout(graph)).toEqual({
      nodes: [],
      edges: [],
    })
  })

  it('sorts the default branch first and assigns deterministic branch lanes', () => {
    const main = commitNodeFixture('main-head', [], '2026-01-01T00:03:00Z')
    const feature = commitNodeFixture('feature-head', [], '2026-01-01T00:02:00Z')
    const hotfix = commitNodeFixture('hotfix-head', [], '2026-01-01T00:01:00Z')
    const graph = graphFixture([
      branchNodeFixture('hotfix', hotfix),
      branchNodeFixture('main', main, true),
      branchNodeFixture('feature/login', feature),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.y).toBe(0)
    expect(nodeById(result, 'feature-head')?.y).toBe(BRANCH_LANE_GAP)
    expect(nodeById(result, 'hotfix-head')?.y).toBe(BRANCH_LANE_GAP * 2)
  })
})

function graphFixture(branches: BranchNode[]): BranchGraph {
  return {
    branches: new Map(branches.map((branch) => [branch.branch.name, branch])),
  }
}

function branchNodeFixture(name: string, head: CommitNode, isDefault = false): BranchNode {
  return {
    branch: branchFixture(name, head.commit.sha, isDefault),
    head,
    reachableCommits: collectReachable(head),
  }
}

function collectReachable(head: CommitNode): Set<string> {
  const reachable = new Set<string>()
  const stack = [head]

  while (stack.length > 0) {
    const node = stack.pop()

    if (!node || reachable.has(node.commit.sha)) {
      continue
    }

    reachable.add(node.commit.sha)
    stack.push(...node.parents)
  }

  return reachable
}

function nodeById(result: { nodes: { id: string; x: number; y: number }[] }, id: string) {
  return result.nodes.find((node) => node.id === id)
}

function commitNodeFixture(
  sha: string,
  parents: CommitNode[] = [],
  committedAt = '2026-01-01T00:00:00Z',
): CommitNode {
  const node: CommitNode = {
    commit: commitFixture(sha, parents.map((parent) => parent.commit.sha), committedAt),
    parents,
    children: [],
  }

  for (const parent of parents) {
    parent.children.push(node)
  }

  return node
}

function commitFixture(sha: string, parents: string[], committedAt: string): GitCommit {
  return {
    sha,
    parents,
    message: `commit ${sha}`,
    author: {
      name: 'Mona',
      email: 'mona@example.com',
      login: 'mona',
      avatarUrl: null,
      profileUrl: null,
    },
    committer: {
      name: 'Hubot',
      email: 'hubot@example.com',
      login: 'hubot',
      avatarUrl: null,
      profileUrl: null,
    },
    authoredAt: committedAt,
    committedAt,
    url: `https://github.com/octo/repo/commit/${sha}`,
  }
}

function branchFixture(name: string, headSha: string, isDefault: boolean): GitBranch {
  return {
    name,
    headSha,
    isDefault,
    url: `https://github.com/octo/repo/tree/${name}`,
  }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: FAIL because all layouts are still empty.

- [ ] **Step 3: Implement branch sorting and head node lane assignment**

Replace `src/layout/TreeLayout.ts` with:

```ts
import type { BranchGraph, BranchNode } from '../graph'
import type { CommitNode } from '../parser'
import {
  BRANCH_LANE_GAP,
  type LayoutEdge,
  type LayoutResult,
  type TreeLayout as TreeLayoutContract,
} from './types'

export class TreeLayout implements TreeLayoutContract {
  layout(branchGraph: BranchGraph): LayoutResult {
    const branches = sortBranches([...branchGraph.branches.values()])
    const nodes = collectCommitNodes(branches)
    const yBySha = assignYCoordinates(branches, nodes)

    return {
      nodes: [...nodes.values()].map((node) => ({
        id: node.commit.sha,
        x: 0,
        y: yBySha.get(node.commit.sha) ?? 0,
      })),
      edges: collectEdges(nodes),
    }
  }
}

function sortBranches(branches: BranchNode[]): BranchNode[] {
  return [...branches].sort((left, right) => {
    if (left.branch.isDefault !== right.branch.isDefault) {
      return left.branch.isDefault ? -1 : 1
    }

    return left.branch.name.localeCompare(right.branch.name)
  })
}

function collectCommitNodes(branches: BranchNode[]): Map<string, CommitNode> {
  const nodes = new Map<string, CommitNode>()

  for (const branch of branches) {
    const stack = [branch.head]

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node || nodes.has(node.commit.sha)) {
        continue
      }

      nodes.set(node.commit.sha, node)
      stack.push(...node.parents)
    }
  }

  return nodes
}

function assignYCoordinates(branches: BranchNode[], nodes: Map<string, CommitNode>): Map<string, number> {
  const yBySha = new Map<string, number>()

  branches.forEach((branch, branchIndex) => {
    if (nodes.has(branch.head.commit.sha) && !yBySha.has(branch.head.commit.sha)) {
      yBySha.set(branch.head.commit.sha, branchIndex * BRANCH_LANE_GAP)
    }
  })

  branches.forEach((branch, branchIndex) => {
    for (const sha of branch.reachableCommits) {
      if (nodes.has(sha) && !yBySha.has(sha)) {
        yBySha.set(sha, branchIndex * BRANCH_LANE_GAP)
      }
    }
  })

  return yBySha
}

function collectEdges(_nodes: Map<string, CommitNode>): LayoutEdge[] {
  return []
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: PASS for empty graph and branch lane tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/layout/TreeLayout.ts src/layout/TreeLayout.test.ts
git commit -m "feat(layout): assign branch lanes"
```

Expected: A commit containing deterministic branch lane assignment.

---

### Task 4: Implement Chronological X Coordinates And Branch Head Priority

**Files:**
- Modify: `src/layout/TreeLayout.test.ts`
- Modify: `src/layout/TreeLayout.ts`

**Interfaces:**
- Consumes: `CommitNode.commit.committedAt`, `CommitNode.commit.authoredAt`, and branch sorted order.
- Produces: Chronological `LayoutNode.x` values and stable `LayoutNode.y` ownership for branch heads.

- [ ] **Step 1: Add failing tests for x ordering, equal timestamp tie-breaking, and branch head priority**

Add these tests inside the existing `describe('TreeLayout', () => { ... })` block:

```ts
  it('assigns increasing x coordinates by commit time', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const middle = commitNodeFixture('middle', [root], '2026-01-01T00:02:00Z')
    const head = commitNodeFixture('head', [middle], '2026-01-01T00:03:00Z')
    const graph = graphFixture([branchNodeFixture('main', head, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'root')?.x).toBe(0)
    expect(nodeById(result, 'middle')?.x).toBe(120)
    expect(nodeById(result, 'head')?.x).toBe(240)
  })

  it('uses stable discovery order when commits have the same timestamp', () => {
    const main = commitNodeFixture('main-head', [], '2026-01-01T00:01:00Z')
    const feature = commitNodeFixture('feature-head', [], '2026-01-01T00:01:00Z')
    const graph = graphFixture([
      branchNodeFixture('feature/login', feature),
      branchNodeFixture('main', main, true),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.x).toBe(0)
    expect(nodeById(result, 'feature-head')?.x).toBe(120)
  })

  it('places branch head commits on their own branch lanes before shared ancestors', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const featureHead = commitNodeFixture('feature-head', [root], '2026-01-01T00:02:00Z')
    const mainHead = commitNodeFixture('main-head', [featureHead], '2026-01-01T00:03:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', mainHead, true),
      branchNodeFixture('feature/login', featureHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(nodeById(result, 'main-head')?.y).toBe(0)
    expect(nodeById(result, 'feature-head')?.y).toBe(BRANCH_LANE_GAP)
    expect(nodeById(result, 'root')?.y).toBe(0)
  })
```

- [ ] **Step 2: Run the tests**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: FAIL because every `x` coordinate is still `0`.

- [ ] **Step 3: Implement chronological x coordinates**

Update the imports in `src/layout/TreeLayout.ts`:

```ts
import {
  BRANCH_LANE_GAP,
  COMMIT_COLUMN_GAP,
  type LayoutEdge,
  type LayoutResult,
  type TreeLayout as TreeLayoutContract,
} from './types'
```

Update `layout` and `collectCommitNodes`:

```ts
  layout(branchGraph: BranchGraph): LayoutResult {
    const branches = sortBranches([...branchGraph.branches.values()])
    const discovered = collectCommitNodes(branches)
    const xBySha = assignXCoordinates(discovered.nodes, discovered.discoveryOrder)
    const yBySha = assignYCoordinates(branches, discovered.nodes)

    return {
      nodes: [...discovered.nodes.values()].map((node) => ({
        id: node.commit.sha,
        x: xBySha.get(node.commit.sha) ?? 0,
        y: yBySha.get(node.commit.sha) ?? 0,
      })),
      edges: collectEdges(discovered.nodes),
    }
  }
```

```ts
function collectCommitNodes(branches: BranchNode[]): {
  nodes: Map<string, CommitNode>
  discoveryOrder: Map<string, number>
} {
  const nodes = new Map<string, CommitNode>()
  const discoveryOrder = new Map<string, number>()
  let nextDiscoveryIndex = 0

  for (const branch of branches) {
    const stack = [branch.head]

    while (stack.length > 0) {
      const node = stack.pop()

      if (!node || nodes.has(node.commit.sha)) {
        continue
      }

      nodes.set(node.commit.sha, node)
      discoveryOrder.set(node.commit.sha, nextDiscoveryIndex)
      nextDiscoveryIndex += 1
      stack.push(...node.parents)
    }
  }

  return { nodes, discoveryOrder }
}
```

Add these helpers above `assignYCoordinates`:

```ts
function assignXCoordinates(
  nodes: Map<string, CommitNode>,
  discoveryOrder: Map<string, number>,
): Map<string, number> {
  const sorted = [...nodes.values()].sort((left, right) => {
    const leftTime = commitTimestamp(left)
    const rightTime = commitTimestamp(right)

    if (leftTime !== rightTime) {
      return leftTime - rightTime
    }

    const leftDiscovery = discoveryOrder.get(left.commit.sha) ?? 0
    const rightDiscovery = discoveryOrder.get(right.commit.sha) ?? 0

    if (leftDiscovery !== rightDiscovery) {
      return leftDiscovery - rightDiscovery
    }

    return left.commit.sha.localeCompare(right.commit.sha)
  })
  const xBySha = new Map<string, number>()

  sorted.forEach((node, index) => {
    xBySha.set(node.commit.sha, index * COMMIT_COLUMN_GAP)
  })

  return xBySha
}

function commitTimestamp(node: CommitNode): number {
  return Date.parse(node.commit.committedAt ?? node.commit.authoredAt ?? '') || 0
}
```

- [ ] **Step 4: Run the tests**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: PASS for all current `TreeLayout` tests.

- [ ] **Step 5: Commit**

Run:

```bash
git status -sb
git add src/layout/TreeLayout.ts src/layout/TreeLayout.test.ts
git commit -m "feat(layout): assign chronological x coordinates"
```

Expected: A commit containing chronological x coordinates and the new tests.

---

### Task 5: Implement Edge Generation And Edge Deduplication

**Files:**
- Modify: `src/layout/TreeLayout.test.ts`
- Modify: `src/layout/TreeLayout.ts`

**Interfaces:**
- Consumes: `CommitNode.parents`.
- Produces: `LayoutEdge[]` directed from parent SHA to child SHA with duplicates removed.

- [ ] **Step 1: Add failing edge tests**

Add these tests inside the existing `describe('TreeLayout', () => { ... })` block:

```ts
  it('emits edges from parent commits to child commits', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const child = commitNodeFixture('child', [root], '2026-01-01T00:02:00Z')
    const graph = graphFixture([branchNodeFixture('main', child, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.edges).toEqual([
      {
        from: 'root',
        to: 'child',
      },
    ])
  })

  it('deduplicates edges reached through multiple branches', () => {
    const root = commitNodeFixture('root', [], '2026-01-01T00:01:00Z')
    const shared = commitNodeFixture('shared', [root], '2026-01-01T00:02:00Z')
    const mainHead = commitNodeFixture('main-head', [shared], '2026-01-01T00:03:00Z')
    const featureHead = commitNodeFixture('feature-head', [shared], '2026-01-01T00:04:00Z')
    const graph = graphFixture([
      branchNodeFixture('main', mainHead, true),
      branchNodeFixture('feature/login', featureHead),
    ])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(result.edges).toEqual([
      { from: 'shared', to: 'main-head' },
      { from: 'root', to: 'shared' },
      { from: 'shared', to: 'feature-head' },
    ])
  })
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: FAIL because `collectEdges` still returns an empty array.

- [ ] **Step 3: Implement edge generation and dedupe**

Replace `collectEdges` in `src/layout/TreeLayout.ts` with:

```ts
function collectEdges(nodes: Map<string, CommitNode>): LayoutEdge[] {
  const edges: LayoutEdge[] = []
  const seen = new Set<string>()

  for (const node of nodes.values()) {
    for (const parent of node.parents) {
      if (!nodes.has(parent.commit.sha)) {
        continue
      }

      const edge: LayoutEdge = {
        from: parent.commit.sha,
        to: node.commit.sha,
      }
      const key = `${edge.from}->${edge.to}`

      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      edges.push(edge)
    }
  }

  return edges
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: PASS for all `TreeLayout` tests.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/layout/TreeLayout.ts src/layout/TreeLayout.test.ts
git commit -m "feat(layout): emit commit edges"
```

Expected: A commit containing edge generation and deduplication.

---

### Task 6: Verify Renderer-Neutral Output And Run Full Checks

**Files:**
- Modify: `src/layout/TreeLayout.test.ts`

**Interfaces:**
- Consumes: `LayoutResult`.
- Produces: Regression tests that prevent labels, colors, SVG data, and mutation from entering Layout.

- [ ] **Step 1: Add renderer-neutral and immutability tests**

Add these tests inside the existing `describe('TreeLayout', () => { ... })` block:

```ts
  it('keeps layout nodes and edges renderer-neutral', () => {
    const root = commitNodeFixture('root')
    const child = commitNodeFixture('child', [root])
    const graph = graphFixture([branchNodeFixture('main', child, true)])
    const layout = new TreeLayout()

    const result = layout.layout(graph)

    expect(Object.keys(result.nodes[0]).sort()).toEqual(['id', 'x', 'y'])
    expect(Object.keys(result.edges[0]).sort()).toEqual(['from', 'to'])
  })

  it('does not mutate the branch graph or commit nodes', () => {
    const root = commitNodeFixture('root')
    const child = commitNodeFixture('child', [root])
    const branch = branchNodeFixture('main', child, true)
    const graph = graphFixture([branch])
    const before = {
      branchCount: graph.branches.size,
      reachable: [...branch.reachableCommits],
      childParentCount: child.parents.length,
      rootChildCount: root.children.length,
    }
    const layout = new TreeLayout()

    layout.layout(graph)

    expect(graph.branches.size).toBe(before.branchCount)
    expect([...branch.reachableCommits]).toEqual(before.reachable)
    expect(child.parents.length).toBe(before.childParentCount)
    expect(root.children.length).toBe(before.rootChildCount)
  })
```

- [ ] **Step 2: Run the layout tests**

Run:

```bash
npm test -- src/layout/TreeLayout.test.ts
```

Expected: PASS for all `TreeLayout` tests.

- [ ] **Step 3: Run all tests**

Run:

```bash
npm test
```

Expected: PASS for every test file.

- [ ] **Step 4: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete with exit code 0.

- [ ] **Step 5: Run lint**

Run:

```bash
npm run lint
```

Expected: Oxlint completes with exit code 0.

- [ ] **Step 6: Commit**

Run:

```bash
git add src/layout/TreeLayout.test.ts
git commit -m "test(layout): enforce renderer neutral output"
```

Expected: A commit containing only final layout regression tests, unless implementation changes were required to satisfy them.

---

### Task 7: Step 4 Review Gate

**Files:**
- Review only:
  - `src/layout/types.ts`
  - `src/layout/TreeLayout.ts`
  - `src/layout/index.ts`
  - `src/layout/TreeLayout.test.ts`
  - `docs/superpowers/specs/2026-07-07-tree-layout-design.md`

**Interfaces:**
- Consumes: Completed Tree Layout implementation.
- Produces: Review summary and any required fixes before merge.

- [ ] **Step 1: Review layout against the Definition of Done**

Check:

```text
- input is BranchGraph
- output is LayoutResult
- no CommitGraph input
- no React import
- no DOM or SVG API usage
- LayoutNode has only id, x, y
- LayoutEdge has only from, to
- no label/color/theme fields
- duplicate edges removed
- branch heads placed on own lanes where possible
```

- [ ] **Step 2: Search for forbidden dependencies**

Run:

```bash
rg -n "React|document|window|SVG|Canvas|label|color|theme|className|svgPath" src/layout
```

Expected: No matches except if a test explicitly asserts those strings are absent. If test strings produce matches, inspect them manually and confirm production files do not contain forbidden dependencies.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected: All commands exit with code 0.

- [ ] **Step 4: Commit review fixes if needed**

Run:

```bash
git status -sb
git add src/layout docs/superpowers/specs/2026-07-07-tree-layout-design.md
git commit -m "fix(layout): address tree layout review"
```

Expected: A commit is created only if review fixes were required.
