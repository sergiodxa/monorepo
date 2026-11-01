---
title: Components Map
impact: MEDIUM
tags: [components, sdxc-ui, reference]
---

# Components Map

Build app screens from `@sdxc/ui/app` and the general `@sdxc/ui` first. A piece two apps need that is
missing here belongs in the package, not in one app.

## Where to learn a component

1. Source and JSDoc: `packages/ui/src/app/<name>.tsx` (general pieces in `src/components/`); props on
   the namespace.
2. Guarantees: `<name>.browser.test.tsx` beside it.
3. Live catalogue: `https://sdxc.dev/api/ui/<name>`, listed under **App**; the overview with every
   CSS variable is `/api/ui/app-foundations`.
4. Real use: `rg "<Name" apps/uptime apps/reader apps/sdxc-site`.

## Wiring an app

- **Islands.** Map each specifier the screen uses in `bootstrap/browser.ts`'s `PACKAGE_MODULES`, as
  sdxc.dev does: `@sdxc/ui/app/{app-shell-toggle, auto-refresh, command-palette, detail-sheet,
  filter-bar, keyboard-help, optimistic-toggle, save-bar, save-status, selection-bar,
  settings-section, split-view, table, toasts}`, `@sdxc/ui/confirm`, `@sdxc/ui/relative-time`. An
  unmapped island leaves its server HTML working and its keys, counts and timers off.
- **Strings.** Every part takes a `labels` object (or label props); pass `t(...)`.
- **Cookies.** Read `readAppShellCookie(cookieHeader)` and `readSplitViewLayout(cookieHeader)` on the
  server and pass the results in.

## The app kit

| Need | Use | Import |
| --- | --- | --- |
| The frame: sidebar column / icon rail / phone sheet, top bar, inset content card, ⌘B | `AppShell` (+ `.Group`, `.Item`, `.Back`, `.Identity`) | `@sdxc/ui/app` |
| Title, breadcrumb or parent link, status, ordered actions, tabs with counts, compact sticky | `PageHeader` | `@sdxc/ui/app` |
| Count tabs, facets with counts, applied chips, search, sort, view slot — all in the URL | `FilterBar` (+ `removeFilterHref`, `clearFiltersHref`, `setParamHref`) | `@sdxc/ui/app` |
| Display options: layout, grouping, ordering, density, visible properties | `ViewOptions` | `@sdxc/ui/app` |
| "Auto-refresh: 30s ▾" for a live list | `AutoRefresh` | `@sdxc/ui/app` |
| Data table: sticky header, density, selection, row actions, whole-row link, pinned column | `Table` (+ `.Select`, `.SelectAll`, `.RowLink`, `.Actions`, `.ActionsColumn`) | `@sdxc/ui/app` |
| Typed cells | `Table.NumberCell`, `.CurrencyCell`, `.IdCell`, `.DateCell`, `.StatusCell`, `.BarCell` | `@sdxc/ui/app` |
| Table states | `Table.Empty` (outside the table), `Table.Error` (in the body), `aria-busy` (dims a refetch) | `@sdxc/ui/app` |
| Pagination that becomes the bulk bar, Esc clears, action keys | `SelectionBar` (counts any `data-selection-item` checkboxes) | `@sdxc/ui/app` |
| j/k rows with an inset ring, Enter/o, x, Space peek, `/` search | `rowNavigation()` mixin | `@sdxc/ui/app` |
| Stat with delta, comparison, sparkline slot, footer; groups as cards, ruled columns or chart tabs | `StatCard`, `StatCard.Group`, `StatCard.Skeleton` | `@sdxc/ui/app` |
| Trend inside a row, with a one-word state | `Sparkline` | `@sdxc/ui/app` |
| Per-period status bars with hatched no-data | `StatusStrip` | `@sdxc/ui/app` |
| 24h · 7d · 30d · 90d with letter keys and a custom range, in the URL | `RangePicker` (+ `rangePickerKeys()`) | `@sdxc/ui/app` |
| Charts with comparison, threshold, incident band, no-data bars | `Chart` (`Chart.Line comparison`, `Chart.Threshold`, `Chart.Band`) | `@sdxc/ui/app` |
| A record beside its list, open state in the URL, `n / N`, Esc | `DetailSheet` | `@sdxc/ui/app` |
| Sidebar, list and detail on one screen (list and detail without `sidebar`), cookie widths, one pane per route on phones | `SplitView` | `@sdxc/ui/app` |
| Label/value facts with named empties and popover edits | `PropertyList` | `@sdxc/ui` |
| Activity history with a rail and "N more" | `Timeline` | `@sdxc/ui` |
| Status word with a dot; `n/N` dot cluster | `StatusDot`, `StatusDot.Summary` | `@sdxc/ui` |
| "2m ago" with exact local and UTC time on hover | `RelativeTime` (`local` for the viewer's zone) | `@sdxc/ui` |
| Settings nav that becomes the parent page on phones | `SettingsLayout` | `@sdxc/ui/app` |
| A settings group with ruled rows and its own Save; explicit or instant | `SettingsSection`, `SettingsSection.Row` | `@sdxc/ui/app` |
| Irreversible actions with consequences and type-to-confirm | `DangerZone`, `DangerZone.Action`; `Confirm typeToConfirm` | `@sdxc/ui/app`, `@sdxc/ui` |
| "Unsaved changes · Discard · Save" with ⌘S and a leave guard | `SaveBar` | `@sdxc/ui/app` |
| Saving… → Saved → Edited 2m ago, Failed · Retry | `SaveStatus` (+ `setSaveStatus`) | `@sdxc/ui/app` |
| Read/star/save that flips at once and admits failure | `OptimisticToggle` | `@sdxc/ui/app` |
| Editor: sticky action bar, writing column, properties sidebar / phone sheet | `EditorLayout` | `@sdxc/ui/app` |
| Toasts: one region for server flashes and client toasts, stack of 3, Undo, promise | `Toasts`, `pageToaster()`, `Toaster.promise` | `@sdxc/ui/app` |
| Account state that needs resolving | `Banner` | `@sdxc/ui` |
| Empty by cause, compact inside a card | `Empty kind="first-run" \| "no-results" \| "cleared" \| "permission" \| "error"` | `@sdxc/ui/app` |
| First-load placeholders at the real height | `Skeleton.Row`, `.Table`, `.Stat`, `.List` | `@sdxc/ui/app` |
| ⌘K palette with recent items, groups, nested pages, commands that act | `CommandPalette` (+ `.Group`, `.Item`, `.Page`, `.Trigger`) | `@sdxc/ui/app` |
| `?` cheat sheet generated from the page's shortcuts | `KeyboardHelp` | `@sdxc/ui/app` |
| Shortcuts with scopes (modal > sheet > page), `g` sequences, `data-shortcut` | `shortcutRegistry()` | `@sdxc/ui/app` |

Already in the kit and still the right choice: `Tree`, `GridList`, `Resizable`, `ContextMenu`,
`DropZone`, `FileTrigger`, `Toolbar`, `ShortcutList`, and the general overlays and form fields.

## Rules

1. Reach for the part in this table before writing markup for the job it does.
2. Map the islands a screen uses; read the cookies on the server.
3. Pass every string; never rely on English defaults.
