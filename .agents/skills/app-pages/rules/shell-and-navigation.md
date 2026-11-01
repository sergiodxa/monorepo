---
title: Shell and Navigation
impact: CRITICAL
tags: [shell, sidebar, navigation, rail, cookie, layout]
---

# Shell and Navigation

The shell is the part of the app a person sees ten thousand times. It should disappear: one object,
the same width every time, the current place obvious, nothing jumping on load.

## The shell is one object

- **Inset content card on a tinted frame.** The sidebar and the frame share one grey; the content sits
  in a card `--ui-app-inset-gap` (8px) in from the edges with a 12px radius. The sidebar becomes part of
  the frame, so the screen reads as one thing with a workspace inside it, not a web page with a menu.
  (shadcn, Catalyst, Dub, Polar, Slack.)
- **One sidebar element, three forms.** A 256px column, a ~52px icon rail, and a 288px sheet below 768px.
  Render the nav once: the same element becomes each form. Two copies of the nav (a desktop aside and a
  phone dialog) drift apart, and neither app here used the second copy.
- **Collapse is a preference the server renders.** Store it in a cookie, read it on the server, render
  the right width on the first paint. ⌘B toggles. A collapse state that lives only in `localStorage`
  flashes the wrong width on every load.
- **The rail peeks.** Hovering or focusing the collapsed rail opens it as an overlay without reflowing
  the content. Tooltips exist only in the rail, where the labels are hidden.
- **Charts and tables reflow when the width changes.** Server SVG with a `viewBox` scales for free;
  anything measured in JS must re-measure when the transition ends.

## Quiet nav rows

- 32px rows (`--ui-app-nav-row-size`), 13–14px text, icons muted (~60% ink) so labels carry the meaning.
- Current page: a soft fill or a 2px edge pill, plus `aria-current="page"`. The parent stays marked on
  its child routes (`/monitors/42` keeps "Monitors" current).
- Counts follow the unread grammar: muted label = nothing new, bold label = something new, a count pill
  = something needs you (a down monitor, unread items). Roll counts up to the rail.
- Section titles are plain sentence-case labels, not uppercase eyebrows.

## Navigation scales by swapping, searching and pinning

- **Name by task, not by product or type.** "Monitors" with a type facet beats "HTTP monitors, DNS
  monitors, TCP monitors, Flow monitors" as four nav rows. Half of Uptime's old nav was monitor types.
- **Swap the panel, don't nest.** Settings replaces the whole nav with "‹ Settings" and its sections;
  Esc goes back. Two scopes stacked in one list are what make big sidebars unreadable. Three levels at
  most, only the current branch open.
- **Pinned and recent at the top** — the sidebar holds where you go back to, not every destination.
  Saved views ("Down now", "Assigned to me") are nav items. ⌘K reaches everything else.
- **Rail for modes, sidebar for the list in that mode, panel for the record** when the app has modes
  (an inbox, a reader): that is `SplitView`, not a deeper tree.
- **Top bar** holds where you are (breadcrumb or title), search, and the one global action. A workspace
  switcher sits at the top of the sidebar; the user menu at the bottom.

## Page header

- Breadcrumb (or a parent link that appears only on narrow screens), an `h1`, a one-line description,
  a status badge when the record has one, then actions: primary at the end, secondary before it,
  everything else in one overflow menu.
- Tabs under the title carry counts ("Incidents 3"). They are links with `aria-current`, so each tab is a
  URL.
- On long detail pages the header compacts and sticks after scrolling, so you never lose which record
  you are in.

## Rules

1. Use `AppShell`; never hand-roll an `<aside popover>` per app.
2. Read the collapse cookie on the server and pass it in.
3. Group the nav by task, swap panels for scopes, put counts where they need attention.
4. One `PageHeader` per screen; one primary action.
