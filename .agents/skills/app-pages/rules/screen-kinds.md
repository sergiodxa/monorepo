---
title: Screen Kinds
impact: HIGH
tags: [structure, dashboard, list, detail, settings, editor, inbox]
---

# Screen Kinds

Almost every app screen is one of six kinds. Name the kind first, then start from its skeleton. A
screen that tries to be two kinds (a dashboard that is also the list) is two screens.

## Overview (dashboard)

`PageHeader` (title, `RangePicker`) → `StatCard.Group` whose cards switch the chart → `Chart` with
comparison and incident bands → a "needs attention" list (a short `Table` or list, five rows, "View
all" to the list screen). Everything answers one question: is anything wrong, and where?

## List

`PageHeader` (title, primary "Create …") → `FilterBar` (count tabs, facets, chips, search, sort,
display) → `Table` (typed cells, selection, row actions, sticky header) → `SelectionBar` (pagination
that becomes the bulk bar). States: first-run `Empty`, no-results `Empty` under the toolbar, dimmed
refetch, inline error. Keys: `/`, j/k, x, Enter, Space to peek a `DetailSheet`.

## Detail

`PageHeader` (breadcrumb, title, status, actions, tabs with counts, compact sticky) → main column
(chart, recent activity) + properties column (`PropertyList`) → `Timeline`. Destructive actions live
in the overflow menu and in the settings tab's `DangerZone`.

## Settings

`SettingsLayout` (section nav | content) → `SettingsSection`s, each explicit or instant → `DangerZone`
last. Phones: nav as the parent page.

## Editor

`EditorLayout`: sticky bar (back, title, `SaveStatus`, Preview, Publish) → ~680px writing column →
280–320px properties sidebar (`PropertyList` with popover edits). Autosave drafts; ⌘S; a leave guard.

## Inbox / reader

`SplitView` (`modes | list | detail`) with unread grammar, next-unread and mark-read keys,
`OptimisticToggle`s for read/star/save, an "All caught up" cleared state, Undo on archive.

## Rules

1. Name the screen's kind before building.
2. Start from its skeleton; add only what the job needs.
