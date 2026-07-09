# Avatar Commit Nodes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a commit author's GitHub avatar as a circular SVG node with the existing circle as a fallback.

**Architecture:** Source and Parser already preserve `GitCommit.author.avatarUrl`, so production changes begin at RenderModel. `RenderModelBuilder` copies the avatar URL into plain renderer-ready data, and `SvgRenderer` uses a reusable object-bounding-box clip path to render a fixed 32 pixel circular image.

**Tech Stack:** TypeScript 6, Vitest, SVG strings, existing `SvgBuilder`

## Global Constraints

- Do not change Source or Parser responsibilities.
- `RenderNode.avatarUrl` is always `string | null`.
- Avatar applies only to `kind: 'commit'`.
- Avatar size is fixed at 32 pixels.
- Do not add caching, base64 embedding, hover, tooltip, animation, author statistics, or theme changes.
- Follow test-driven development and observe every new behavior fail before production changes.

---

### Task 1: Lock Existing Source And Parser Avatar Flow

**Files:**
- Modify: `src/source/github/GitHubApiSource.test.ts`
- Modify: `src/parser/CommitParser.test.ts`

**Interfaces:**
- Consumes: `GitCommit.author.avatarUrl: string | null`
- Produces: Regression coverage proving Source mapping and Parser preservation

- [ ] **Step 1: Strengthen the Source mapping assertion**

Add `avatarUrl` to the existing author assertion:

```ts
expect(snapshot.commits[0]).toMatchObject({
  author: {
    login: 'mona',
    avatarUrl: 'https://avatars.githubusercontent.com/u/1',
  },
})
```

- [ ] **Step 2: Add a Parser preservation test**

Create a snapshot commit with a non-null author avatar, parse it, and assert:

```ts
expect(result.graph.nodes.get('avatar-commit')?.commit.author.avatarUrl).toBe(
  'https://avatars.githubusercontent.com/u/1',
)
```

- [ ] **Step 3: Run the focused tests**

Run:

```bash
npm test -- src/source/github/GitHubApiSource.test.ts src/parser/CommitParser.test.ts
```

Expected: PASS because this task records already-supported data flow and does not add behavior.

### Task 2: Add Avatar Data To RenderModel

**Files:**
- Modify: `src/render-model/types.ts`
- Modify: `src/render-model/RenderModelBuilder.ts`
- Modify: `src/render-model/RenderModelBuilder.test.ts`

**Interfaces:**
- Consumes: `LayoutResult` and `BranchGraph`
- Produces: `RenderNode.avatarUrl: string | null`

- [ ] **Step 1: Write failing RenderModel tests**

Add one test with `commit.author.avatarUrl` set to a URL and one test for an
unknown layout node. Assert:

```ts
expect(renderModel.nodes[0]?.avatarUrl).toBe(
  'https://avatars.githubusercontent.com/u/1',
)
expect(unknownRenderModel.nodes[0]?.avatarUrl).toBeNull()
```

Update complete-object and key-list assertions to require `avatarUrl`.

- [ ] **Step 2: Run the RenderModel test and verify RED**

Run:

```bash
npm test -- src/render-model/RenderModelBuilder.test.ts
```

Expected: FAIL because `RenderNode` does not contain `avatarUrl`.

- [ ] **Step 3: Add the RenderNode field and graph lookup**

Extend the type:

```ts
export interface RenderNode {
  id: string
  x: number
  y: number
  label: string
  kind: RenderNodeKind
  styleToken: RenderNodeStyleToken
  avatarUrl: string | null
}
```

Build a SHA-to-commit lookup from `BranchGraph` commit nodes and set:

```ts
avatarUrl: commitsBySha.get(node.id)?.commit.author.avatarUrl ?? null
```

- [ ] **Step 4: Run the RenderModel test and verify GREEN**

Run:

```bash
npm test -- src/render-model/RenderModelBuilder.test.ts
```

Expected: PASS.

### Task 3: Render Circular Avatar Images With Circle Fallback

**Files:**
- Modify: `src/renderer/svg/SvgBuilder.ts`
- Modify: `src/renderer/svg/SvgRenderer.ts`
- Modify: `src/renderer/svg/SvgRenderer.test.ts`
- Modify: `src/renderer/svg/__fixtures__/mvp-golden.svg`
- Modify: render-node fixtures in integration tests identified by TypeScript

**Interfaces:**
- Consumes: `RenderModel` with explicit `avatarUrl`
- Produces: Deterministic standalone SVG with `<image>` or fallback `<circle>`

- [ ] **Step 1: Write failing SVG tests**

Add tests asserting that an avatar node contains:

```xml
<clipPath id="commit-avatar-clip" clipPathUnits="objectBoundingBox">
<image href="https://avatars.example/avatar?a=1&amp;b=2"
       width="32"
       height="32"
       clip-path="url(#commit-avatar-clip)" />
```

Also assert that a node with `avatarUrl: null` contains the existing circle and
does not contain `<image>`.

- [ ] **Step 2: Run the SVG test and verify RED**

Run:

```bash
npm test -- src/renderer/svg/SvgRenderer.test.ts
```

Expected: FAIL because avatar images and nested clip-path elements are not rendered.

- [ ] **Step 3: Allow SvgBuilder to append nested elements**

Add:

```ts
childElement(element: SvgBuilder): this {
  this.children.push(element.build())
  return this
}
```

This keeps nested SVG creation structured and preserves attribute escaping.

- [ ] **Step 4: Add conditional clip definition and avatar rendering**

When at least one commit node has an avatar, append:

```ts
const clipPath = new SvgBuilder('clipPath', {
  id: 'commit-avatar-clip',
  clipPathUnits: 'objectBoundingBox',
}).child('circle', { cx: 0.5, cy: 0.5, r: 0.5 })

svg.childElement(new SvgBuilder('defs').childElement(clipPath))
```

For each avatar node render an image centered on the layout coordinate:

```ts
svg.child('image', {
  href: node.avatarUrl,
  x: node.x - 16,
  y: node.y - 16,
  width: 32,
  height: 32,
  'clip-path': 'url(#commit-avatar-clip)',
  preserveAspectRatio: 'xMidYMid slice',
})
```

Otherwise render the existing circle. Render labels in both cases.

- [ ] **Step 5: Update fixtures and golden SVG**

Every explicit `RenderNode` fixture receives `avatarUrl`, using `null` by
default. Add one avatar to the golden model and update
`src/renderer/svg/__fixtures__/mvp-golden.svg` to the exact deterministic
output.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
npm test -- src/render-model/RenderModelBuilder.test.ts src/renderer/svg/SvgRenderer.test.ts src/pipeline/RenderPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run full quality gates**

Run:

```bash
npm test
npm run build
npm run lint
```

Expected: all commands exit with code 0.
