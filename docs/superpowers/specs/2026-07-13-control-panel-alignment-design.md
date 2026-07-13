# Control Panel Alignment Design

## Goal

Rearrange the existing repository control panel so GitHub Token and Timeline Grouping align horizontally, Timeline Grouping aligns vertically with Branch, and the Generate button sits centered beneath the fields.

## Layout

Desktop and tablet widths use a two-column, three-row CSS Grid:

```text
GitHub Token       Timeline Grouping
Repository         Branch
          Generate
```

- Column one is the flexible primary-input column.
- Column two is the narrower settings column.
- GitHub Token and Timeline Grouping start on the same row and align at the top so the Token hint does not shift the Grouping control.
- Timeline Grouping and Branch share the same grid column and width.
- Generate spans both columns and is horizontally centered on the third row.

At widths below the existing responsive breakpoint, the form remains a single column in DOM order and the button remains usable at mobile width.

## Implementation Boundary

This change is CSS-only unless verification exposes an accessibility or DOM-order issue. It reuses the existing form fields and submit button and does not change:

- GitHub Token storage or requests;
- Timeline grouping state or cached redraw behavior;
- repository or branch input behavior;
- translations;
- Pipeline, Layout, RenderModel, or SVG output.

## Approaches Considered

### Two-column CSS Grid (selected)

Adjust the existing grid to remove the third button column, place the button on a spanning third row, and explicitly align the first-row fields. This is the smallest change and preserves responsive behavior.

### Nested row wrappers

Adding JSX wrappers would make each visual row explicit but increases markup and test churn without adding behavior.

### Flex wrapping

Flexbox requires additional width and wrapping rules, and the Token hint makes vertical alignment less predictable.

## Verification

- Confirm field positions through the CSS Grid declarations.
- Confirm the existing form DOM and submit behavior remain unchanged.
- Run `npm test`.
- Run `npm run build`.
- Run `npm run lint`.
- Manually inspect desktop and mobile layouts if a browser is available.

## Definition of Done

- GitHub Token and Timeline Grouping are horizontally aligned.
- Timeline Grouping and Branch are vertically aligned.
- Generate is centered below the field grid.
- The mobile form remains a readable single column.
- All automated quality gates pass.
