# Control Panel Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align Timeline Grouping with GitHub Token and Branch, then center Generate below the existing control fields.

**Architecture:** Preserve the existing form DOM and behavior. Change only the CSS Grid placement, with a raw-CSS regression test protecting the desktop and mobile layout declarations.

**Tech Stack:** React 19, CSS Grid, Vitest 4, Vite raw imports.

## Global Constraints

- Work directly on `dev`.
- Do not change form behavior, state, translations, or request logic.
- Do not create a new page or add JSX wrappers.
- Desktop uses two columns and three rows.
- Mobile keeps the existing single-column flow.

---

### Task 1: Reposition the control panel fields and button

**Files:**
- Create: `src/App.layout.test.ts`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: existing `.repo-form`, `.token-field`, `.repo-field`, `.grouping-field`, `.branch-field`, and submit button selectors.
- Produces: a two-column desktop grid with the button centered on a spanning third row.

- [ ] **Step 1: Write the failing CSS layout test**

```ts
import { describe, expect, it } from 'vitest'
import appStyles from './App.css?raw'

describe('App control panel layout', () => {
  it('aligns settings in two columns and centers Generate below them', () => {
    expect(appStyles).toMatch(
      /\.repo-form\s*{[^}]*grid-template-columns:\s*minmax\(280px, 1fr\) minmax\(120px, 180px\);/s,
    )
    expect(appStyles).toMatch(/\.grouping-field\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*1;/s)
    expect(appStyles).toMatch(/\.branch-field\s*{[^}]*grid-column:\s*2;[^}]*grid-row:\s*2;/s)
    expect(appStyles).toMatch(
      /\.repo-form button\s*{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*3;[^}]*justify-self:\s*center;/s,
    )
  })
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npm test -- src/App.layout.test.ts`

Expected: FAIL because the current grid still has a third `auto` column and places Generate in column three, row two.

- [ ] **Step 3: Apply the minimal CSS Grid change**

```css
.repo-form {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(120px, 180px);
  align-items: start;
  gap: 12px;
}

.repo-form button {
  grid-column: 1 / -1;
  grid-row: 3;
  justify-self: center;
  min-width: 180px;
}
```

Keep Token/Grouping on row one and Repository/Branch on row two. Retain the existing mobile rule that clears explicit rows and columns.

- [ ] **Step 4: Run focused and complete verification**

Run: `npm test -- src/App.layout.test.ts src/App.test.tsx`

Expected: both test files pass.

Run: `npm test`

Expected: all test files pass.

Run: `npm run build`

Expected: TypeScript, Browser/CLI builds, and boundary verification exit 0.

Run: `npm run lint`

Expected: oxlint exits 0 with no diagnostics.

- [ ] **Step 5: Commit**

```bash
git add src/App.css src/App.layout.test.ts
git commit -m "style: align control panel fields"
```
