---
title: Cairn
headline: An issue tracker that reloads only the frame a click changes, and keeps every view in the address
summary: An invented issue tracker with grouped lists whose filters live in the address, a drag-and-drop board, projects on a roadmap, cycles with burn-up charts and an inbox.
cover: list
shots:
  - id: list
    page: "?issue=WEB-118"
    alt: Cairn's My issues list grouped by status, with issue WEB-118 open in a pane beside the list.
  - id: filter-bar
    page: "?status=todo&status=started"
    highlight: "[data-slot='filter-bar']"
    alt: The list's filter bar with search, the status facet applied and the Display button.
  - id: status-menu
    page: "?issue=WEB-118"
    click: "button[commandfor='cairn-status-WEB-118']"
    highlight: "#cairn-status-WEB-118"
    alt: The status menu open on an issue, listing Backlog, Todo, In Progress, Done and Canceled.
  - id: board
    page: "team/web/board"
    highlight: "[data-slot='board-columns']"
    alt: The Web team's board, with a column per state and issue cards showing ids, labels and assignees.
  - id: roadmap
    page: "roadmap"
    highlight: "[data-slot='gantt']"
    wait: 1500
    alt: The roadmap, with every project as a bar on a month and week timeline grouped by quarter, and today's line through every row.
  - id: cycle
    page: "cycles/web-24"
    highlight: "[data-slot='cairn-list-header']"
    wait: 3000
    alt: A cycle's header with its figures and a burn-up chart of points done against scope.
  - id: palette
    page: "?issue=WEB-118"
    click: "button[commandfor='cairn-palette']"
    highlight: "#cairn-palette"
    alt: The command menu open over the list, searching issues, projects and commands.
  - id: phone-list
    page: ""
    viewport: phone
    alt: Cairn's issue list on a phone, with a bottom tab bar.
---

Cairn is an invented issue tracker for Saltmarsh, a fictional product studio with a Web team and
a Platform team. The visitor is signed in as Ilse Varga and finds grouped issue lists, a board
per team, projects on a roadmap, two-week cycles with burn-up charts, saved views and an inbox.
Lichen green on cool slate, a humanist sans with monospace ids and estimates, and tight square
corners.

The demo sets out to show the daily-driver feel of a modern tracker — single-key edits, detail
beside the list, a board you can rearrange — built from server-rendered screens. The sidebar,
top bar, command menu and keyboard help mount once. After that, every click reloads only the
named frame it changes: the list view, the open issue, the board, its sheet or the roadmap's
timeline. Every screen still renders whole on the server, and every edit is a form that works
with script turned off.

## The brief

An issue tracker lives or dies on two things: how fast you can triage, and whether a view you
built can be shared. Triage means opening an issue without losing your place in the list,
changing status, priority and assignee from the keyboard, and acting on many rows at once.
Sharing means a filtered, grouped list is a link. Around that sit a board for the team's flow,
a roadmap for projects, cycles that show whether the team will finish, and an inbox for what
happened to your work.

Cairn takes on all of that. Its hard edge is persistence: a visitor's edits, created issues and
comments are kept per visitor in cookies, pages drawn for one visitor are never cached, and
"Reset the demo" in the account menu clears everything.

## A list whose view is a link

The issue list groups by status, priority, assignee or project. Each row shows a priority glyph,
the id, a state glyph that fills as work advances, labels drawn with
[LabelChip](/api/ui/label-chip), the project, the estimate and the assignee. Search, filters,
grouping, ordering and density all live in the address, so `?status=todo&status=started` or
`team/web?group=project&order=updated` is a view you can send. The
[FilterBar](/api/ui/filter-bar) shows each applied filter as a removable chip with Clear
filters on Esc, and [ViewOptions](/api/ui/view-options) under Display sets grouping, ordering
and density.

![The list's filter bar with search, the status facet applied and the Display button](/showcase/cairn/filter-bar.webp "Every filter is a chip you can remove, and every chip is part of the address.")

Checking rows turns the footer into a [SelectionBar](/api/ui/selection-bar) with Start, Mark
done, Assign to me and Mark urgent. A bulk action posts once for every checked issue, redraws
the list in place and shows one toast. The title, search and filters stay put while only the
rows scroll, and each group's heading sticks at the top of the rows while its group is in view.

## Detail beside the list, and edits that save on pick

An issue opens beside its list in a [SplitView](/api/ui/split-view) pane, with Previous, Next
and `j`/`k`. The pane holds the description, sub-issues with their progress, one
[Timeline](/api/ui/timeline) of history and comments, and a properties panel built from
[PropertyList](/api/ui/property-list). The split keeps the pane sizes and collapsed panes the
visitor set, in a cookie of its own.

Two nested frames make that cheap. The view frame holds the list and the open issue; the issue
frame sits inside it and holds only the issue:

```tsx
export const VIEW_FRAME = "cairn-view";

export const ISSUE_FRAME = "cairn-issue";
```

A filter, a grouping change or Close reloads the view. A row opened beside the list, Previous,
Next, `j`/`k` and a comment reload only the issue, and a small island moves the list's
current-row mark to match. Every in-app link and form names the frame it reloads, so the
address still moves to the new page while the rest of the screen stays where it was.

Status, priority and assignee each open a menu — also on `s`, `p` and `a` — that saves the
moment you pick. A [SaveStatus](/api/ui/save-status) beside the id says "Saving…" as soon as
the form submits, then "Saved", then decays to "Edited 2m ago", with no toast.

![The status menu open on an issue, listing every state with In Progress checked](/showcase/cairn/status-menu.webp "Each state is a form button, so a pick saves at once, with or without script.")

Each issue's status, priority and assignee live in a cookie of their own, so two quick edits
never overwrite each other, and every edit posts to the page it was made on, naming the issue in
a field, so the address after a post is the page the visitor returns to.

## A board that keeps where you drop

Each team's board has a column per state. A card moves by mouse drag, by Shift and an arrow key
with the landing column announced to screen readers, or by its own move menu, which works
without script. Cards keep the place they are dropped, within a column too, and a column nobody
has rearranged reads by priority and then oldest first. A column's + opens the create dialog
with that column's state chosen.

![The Web team's board, with a column per state and issue cards](/showcase/cairn/board.webp "Drag, Shift and an arrow, or the card's own menu all feed the same form post.")

The board fills the window under the top bar, its columns scrolling under sticky headers. A
card opens its issue in a [DetailSheet](/api/ui/detail-sheet) beside the board; the board and
the sheet are frames of their own, so opening a card, Previous, Next and Close reload only the
sheet.

## Projects, roadmap and cycles

Projects lists each project's health, lead, progress in estimate points done and target date.
The roadmap draws every project with [Gantt](/api/ui/gantt) on a month and week axis, grouped by
the quarter it starts in, each bar filled to its progress, with today's line through every row
and a hatched tail running to a late project's projected date. It opens scrolled to today, and
its Active and Closed tabs are addresses that reload only the timeline.

![The roadmap with projects as bars grouped by quarter and today's line through every row](/showcase/cairn/roadmap.webp "Bars fill as points close, and a hatched tail shows how late a project is running.")

A cycle's page streams its figures and its burn-up [Chart](/api/ui/chart) in as frames over
[Skeleton](/api/ui/skeleton) placeholders of their exact size, above the cycle's issues. The
chart draws points completed, the scope line above it and a dashed even pace to the end. As
the visitor scrolls the cycle's issues, the header rolls away while the title and filter bar
stay in place.

![A cycle's figures and burn-up chart of points done against scope](/showcase/cairn/cycle.webp "Scope, completion, open issues and time left sit over a burn-up chart that streams in as its own frame.")

## A keyboard layer

`c` opens a native create dialog from any screen; an untitled issue comes back as a page that
keeps everything typed. ⌘K opens a [CommandPalette](/api/ui/command-palette) of commands,
issues, projects, teams and views with their `g` shortcuts, and `?` lists every key in
[KeyboardHelp](/api/ui/keyboard-help). Issue text and comments expand emoji shortcodes through
[@sdxc/emoji](/api/emoji).

![The command menu open over the list, with commands and their shortcuts](/showcase/cairn/palette.webp "The command menu lists the g-key shortcut beside each place it can take you.")

On a phone, the sidebar becomes a sheet and the main destinations move into a
[TabBar](/api/ui/tab-bar) with the inbox's unread count, while the list keeps its groups and
checkboxes.

![Cairn's issue list on a phone, with a bottom tab bar](/showcase/cairn/phone-list.webp "On a phone, My issues, Inbox, Board and Projects move into a tab bar.")

## Takes after

- [Linear](https://linear.app) — dense grouped lists, single-key edits for status, priority and
  assignee, cycles and the ⌘K menu; Cairn keeps every edit a form that works without script.
- [GitHub Projects](https://github.com/features/issues) — a board and a roadmap over the same
  issues, with the open item in a sheet beside the board.
- [Jira](https://www.atlassian.com/software/jira) — projects on a quarter-grouped timeline with
  a line for today.

## Where to start reading

- [`list.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/cairn/list.tsx)
  — the grouped list, its address-driven filters and the nested view and issue frames.
- [`board.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/cairn/board.tsx)
  — drag, keyboard and no-script moves feeding one post.
- [`state.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/cairn/state.ts)
  — a visitor's edits in per-issue cookies.
