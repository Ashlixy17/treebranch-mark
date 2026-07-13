# Timeline Final Fix Report

## Status

All findings in `final-review-findings.md` were addressed without changing the approved Timeline defaults, Browser redraw boundary, TreeLayout availability, or CLI behavior.

## Root-cause evidence and fixes

### Group-label viewBox clipping

- Root cause: `SvgRenderer.getViewBox()` bounded x coordinates using nodes, group start/end coordinates, and separators only. Group labels are rendered left-anchored at `group.startX`, so their text extent was absent from the right bound.
- Valid RED: `npm test -- src/renderer/svg/SvgRenderer.test.ts`
  - 3 focused failures for `2026-01-31`, `2026-01`, and `Unknown date`.
  - Actual right edge was `36` for every case; conservative required edges including default padding were `156`, `120`, and `180`.
- Minimal fix: include `group.startX + group.label.length * fontSize` among viewBox x candidates. This deliberately uses a full em per character as a conservative monospace estimate.
- Note: the first combined RED run exposed that the new test initially parsed the y fields of the viewBox. The parser was corrected, the production bound line was removed, and the renderer-only RED above was re-run before restoring the fix.

### Contiguous Timeline groups

- Root cause: `TimelineLayout.collectGroups()` stored groups in a global `Map` keyed by group id. A later run with the same id updated the earlier run's `endX`, collapsing separated runs and creating overlapping group ranges.
- RED: `npm test -- src/renderer/svg/SvgRenderer.test.ts src/layout/TimelineLayout.test.ts src/pipeline/RenderPipeline.test.ts`
  - The invalid-date, epoch-date, invalid-date regression expected three groups but received two.
  - The first `Unknown date` group incorrectly spanned `startX: 0` through `endX: 240` across the intervening `1970-01-01` group.
- Minimal fix: accumulate groups in output order and extend only the immediately preceding group when its id matches. A repeated non-adjacent key now starts a new group.

### README terminology

- Evidence: README described the selector as being in "Graph settings", while the implemented selector is embedded in the existing repository control panel.
- Fix: changed only that location phrase to "the repository control panel". Timeline default, UTC grouping choices, source-free redraw wording, and CLI documentation remain unchanged.

### Direct Pipeline contracts

- Added a direct test proving one call to `render(input)` increments the fake source's `loadCount` exactly once.
- Added a direct test supplying a unique layout result to `renderSnapshot(snapshot, { layout })` and asserting its `Layout override` label reaches the SVG.
- Both tests passed on their first focused run, confirming the existing production Pipeline already honored these contracts. No Pipeline production change was necessary.

## GREEN verification

- Focused GREEN: `npm test -- src/renderer/svg/SvgRenderer.test.ts src/layout/TimelineLayout.test.ts src/pipeline/RenderPipeline.test.ts src/source/local/LocalRenderPipeline.test.ts src/App.test.tsx`
  - 5 files passed, 38 tests passed.
- Full tests: `npm test`
  - 19 files passed, 128 tests passed.
- Production build: `npm run build`
  - TypeScript build, CLI build, Browser build, and build-boundary verification all exited 0.
- Lint: `npm run lint`
  - oxlint exited 0 with no diagnostics.
- Whitespace gate: `git diff --check`
  - exited 0; Git printed only the repository's existing LF-to-CRLF conversion notices.

## Self-review against binding requirements

- Timeline remains the default Pipeline layout.
- Equal chronological spacing and UTC year/month/day grouping logic are unchanged.
- Exported SVG retains labels and separators; the only renderer change expands the right bound.
- Browser grouping redraw remains source-free through `renderSnapshot` in the existing repository control panel.
- TreeLayout remains available.
- Local CLI behavior remains monthly Timeline by default with no grouping flag.
- No unrelated refactor or architecture change was introduced.

## Files

- `README.md`
- `src/layout/TimelineLayout.ts`
- `src/layout/TimelineLayout.test.ts`
- `src/pipeline/RenderPipeline.test.ts`
- `src/renderer/svg/SvgRenderer.ts`
- `src/renderer/svg/SvgRenderer.test.ts`
- `.superpowers/sdd/final-fix-report.md`

## Commits

- `2d27e04` - `fix: close timeline final review gaps`
- The evidence report is committed separately after it is written; its hash is included in the final handoff because a commit cannot contain its own final hash.

## Concerns

No blocking concerns. The conservative full-em label estimate can add harmless right-side whitespace for narrow glyphs; this is intentional to prevent clipping without browser-specific text measurement.
