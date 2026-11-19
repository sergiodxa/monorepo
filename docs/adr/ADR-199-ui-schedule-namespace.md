# ADR-199: `@sdxc/ui/schedule` Holds a Calendar App's Parts

## Status

**Accepted** - 2026-11-18. Extends [ADR-186](./ADR-186-ui-component-namespaces.md).

## Background

The calendar demo on sdxc.dev added a time grid of days and hours, a month, an agenda, a phone's
strip of days and a people-by-hours availability grid to `@sdxc/ui/app`. They are one domain kit,
and ADR-186 gives each domain kit a namespace of its own instead of the shared `app` one.

## Context

- The natural name, `@sdxc/ui/calendar`, is already the root `Calendar` component's own subpath
  (`./*` maps `calendar` to `src/components/calendar.tsx`), and `namespaces.test.ts` rejects a
  namespace that shadows a root module.
- The root `Calendar` and `RangeMonths` are general date pickers that booking, finance and calendar
  screens all use, so they stay in the root.
- `RouteDialog`, a dialog its address opens, came from the same demo but is not calendar-specific,
  so it stays in `@sdxc/ui/app`.

## Decision

1. **`@sdxc/ui/schedule` is a namespace** (`src/schedule/`, exported as `@sdxc/ui/schedule` and
   `@sdxc/ui/schedule/<module>`), holding `TimeGrid`, `MonthView`, `Agenda`, `DayStrip` and
   `FreeBusy`, the `layoutTimedItems` and `layoutSpanItems` placement helpers, and the islands
   `TimeGridBehavior` and `DayStripScroll`.
2. **They move without shims.** `@sdxc/ui/app` no longer exports them, and every import moves to
   the new subpath in the same change.

## Consequences

- A scheduling screen imports from one namespace, and `@sdxc/ui/app` stays about workspace chrome.
- The islands' client entry ids change to `@sdxc/ui/schedule/time-grid` and
  `@sdxc/ui/schedule/day-strip`, so a site that maps package islands by specifier updates its map.
