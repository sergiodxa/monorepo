---
title: Grids Without Orphans
impact: HIGH
tags: [grids, layout, stats, cards, responsive]
---

# Grids Without Orphans

Choose a grid's column count from its item count so every row is full at every width. Four cards in a
three-column grid leave an orphan; three plans in two columns at tablet width leave a lonely third.

## Why

- **An orphan cell looks like a bug**: it was the single most frequent defect across every review round
  (logo clouds, pricing, footers, sponsor rows, docs lists, region grids).
- **Content is cheaper to change than layout**: often the best fix is a ninth card or eight chips instead of
  nine, not a cleverer grid.

## Pattern

```tsx
// Bad: fixed three columns whatever the count
<Feature.Grid columns={3}>{reasons.map(…)}</Feature.Grid>   // 4 reasons → 3 + 1

// Good: columns follow the count
function columnsFor(count: number): Feature.Columns {
	return count % 3 === 0 ? 3 : 2;
}
<Feature.Grid columns={columnsFor(reasons.length)}>{reasons.map(…)}</Feature.Grid>
```

## Counts that work

| Items | Columns by width        |
| ----- | ----------------------- |
| 2     | 1 → 2                   |
| 3     | 1 → 3 (never 2)         |
| 4     | 1 → 2 → 4               |
| 5     | 3, last card spans      |
| 6     | 1 → 2 → 3               |
| 8     | 2 → 4                   |
| 9     | 1 → 3                   |

`Bento`, `Feature.Grid` and `StatStrip` already widen an odd last cell, and `SiteFooter` picks a column
plan with a full last row. Custom grids can use `balancedGrid()` in `packages/ui/src/styles/card-grid.ts`
as a model. Flex rows that wrap (sponsors, chips) centre with `justify-content: center`.

## Stats

A `StatStrip` carries four figures (six at most). The sdxc.dev home went from six to four because labels
wrapped to three lines; five figures render 2 + 2 + 1 on phones. Use `size="display"` for headline figures
(tabular numerals) and `variant="gap"` so figures start on the copy edge.

## Equal heights

Cards in a row share a height and their titles share a baseline: fixed-height scene frames, `subgrid`, or
`grid-auto-rows: 1fr`. Masonry with similar-length quotes looks broken; use a stretched grid.

## Rules

1. Derive columns from the item count; never hard-code three.
2. Prefer changing the content count to fixing an orphan with layout tricks.
3. Keep stat strips to four figures.
4. Align card titles per row with fixed media heights or subgrid.
5. Check every grid at 375, 768 and 1280, where column counts change.
