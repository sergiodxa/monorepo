---
name: app-pages
description: Design, build, redesign or review a signed-in app screen in this monorepo with taste — a dashboard, an admin or CMS, a list of records, a detail view, a settings page, an editor or an inbox, like Uptime's monitors or the reader app. Teaches the judgment that makes an app good to work in every day: a shell that is one object and remembers you, navigation that scales by swapping and searching instead of nesting, lists whose filters live in the URL with density you choose and selection that costs nothing until used, detail beside the list instead of in place of it, metrics inside the thing they measure, saving as a model rather than a toast, feedback where the user is looking, states typed by cause, a keyboard layer that is cheap and visible, and phones treated as their own layout. Use before planning or writing an app layout, an app component or an app screen, when redesigning one, or when reviewing a screen that "works but feels like an admin template".
---

# App pages

An app is used for hours, every day, by people who already know it. The references below don't win on
widgets — every one has a sidebar, a table and a toast — they win on judgment: the sidebar comes back the
width you left it, a filtered list is a link you can send, the bulk bar replaces the pagination instead of
stacking on it, "Saved" is quiet and "Publish" is loud, the toast says "Monitor deleted · Undo" and
nothing else. This skill teaches that judgment. The components are the easy part
(@rules/components-map.md).

## When to apply

- Building or changing an app shell, a list, a table, a detail view, a settings page or an editor
- Building or changing a component in `@sdxc/ui/app`
- Reviewing a signed-in screen before it ships, or after someone said "it works"

## The references

Studied at 1440 and 375, light and dark (@rules/study-the-references.md): GitHub (issues, projects,
PRs), Linear, Vercel and its Geist rules, Stripe, Sentry, Cloudflare and Kumo, Dub, Polar, Slack and
Discord, shadcn/ui, Primer, Catalyst, Radix Themes, and for content apps WordPress, Sanity, Payload,
Ghost and Notion.

## Principles

### The shell is one object, and it remembers you (CRITICAL) — @rules/shell-and-navigation.md

Content in an inset card on a tinted frame. One sidebar that is a column, a rail and a phone sheet,
collapsed by a cookie the server reads, so the first paint is right. Quiet 32px nav rows.

### Navigation scales by swapping, searching and pinning (CRITICAL) — @rules/shell-and-navigation.md

Name destinations by task, swap the whole panel for a scope ("‹ Settings"), keep three levels at most,
pin what people return to, and let ⌘K reach everything else.

### Lists are queries you can read (CRITICAL) — @rules/lists-and-tables.md

Filters, sort, view and density in the URL; counts on facets; chips that say what is applied; typed
cells, end-aligned numbers, `—` for unknown; selection that turns the footer into the bulk bar.

### Detail without losing the list (HIGH) — @rules/detail-and-master-detail.md

A non-modal sheet whose record is in the URL with `n / N` and ↑↓, or a master/detail split that becomes
one pane per route on phones. Properties as named label/value rows; history as a quiet timeline.

### Metrics live inside interaction (HIGH) — @rules/metrics.md

A stat explains itself (delta, comparison, a sentence); the chart answers the range picker; a row
carries its own sparkline and one-word state; empty periods are hatched, never zero.

### Saving is a model, not a toast (CRITICAL) — @rules/saving-and-forms.md

Explicit save for typed input, instant save for switches, never both in one section. Persistence is
quiet text, publication is the primary button. A failed submit keeps every character typed.

### Feedback goes where the user is looking (HIGH) — @rules/feedback-and-states.md

Inline first, a banner for state that needs resolving, a toast last: past tense, six words, Undo instead
of "Are you sure?". Confirm only the irreversible and name it.

### States are typed by cause (HIGH) — @rules/feedback-and-states.md

First run, no results, all caught up, no permission, failed: each its own empty state. Loading by
expected wait; refetching dims the old list in place; an error replaces only its region.

### The keyboard layer is cheap and visible (HIGH) — @rules/keyboard.md

`/`, j/k with an inset ring, `?`, `g`+letter, ⌘K that runs commands; one registry with scopes; every
action shows its key.

### Phones are their own layout (HIGH) — @rules/phones.md

Sheet for the sidebar, the index page as the parent, toolbars that wrap, tables that scroll inside their
box with the first column kept, controls sized for a thumb.

### The list never waits on the chart (HIGH) — @rules/frames.md

The document holds the shell, the header and the screen's primary content; charts, feeds and side
panels stream in as frames over `Skeleton` placeholders of their final size, each cached on its own
and reading its state from its own `src`.

### Words are part of the interface (MEDIUM) — @rules/app-copy.md

Verb + Noun labels, "…" only when a dialog follows, destructive last, the toast verb matches the button
verb, errors end with what to do next.

## Workflow

1. **Name the screen's job** in one sentence: "find the monitor that is down and pause it" is a list
   with a status facet, a row action and an Undo toast; "change the alert email" is one settings row.
2. **Pick the screen kind** (@rules/screen-kinds.md): overview, list, detail, settings, editor or inbox.
   Each has a known skeleton; start from it.
3. **Build** from `@sdxc/ui/app` and root `@sdxc/ui` (@rules/components-map.md). A piece two apps need
   goes in the package, not the app.
4. **Use it like a user** at six widths, both themes, keyboard only, then write the browser tests
   (@rules/verify-like-a-user.md).

## Worked examples

Five demo apps on sdxc.dev assemble the kit into whole products, each with its own art direction
set through theme tokens alone. Open the one closest to the screen you are building, then read its
source in `apps/sdxc-site/resources/views/demo-apps/<slug>/`:

- **Pulse** (`/demo/apps/pulse`): an ops dashboard — overview, a filtered services list with a
  peek sheet and bulk bar, a service detail, incidents and settings.
- **Inkwell** (`/demo/apps/inkwell`): a CMS — posts with count tabs and quick edit, the editor and
  its save model, media and settings.
- **Relay** (`/demo/apps/relay`): an inbox and light CRM — `sidebar | list | detail` on one screen,
  contacts, reports and settings.
- **Tern** (`/demo/apps/tern`): a chat assistant — history grouped by day, a conversation whose
  reply streams in and stops on Stop (and posts without script), a canvas beside the chat,
  projects, a shared read-only view and settings.
- **Chorus** (`/demo/apps/chorus`): a social network — a timeline whose likes and reposts flip
  at once and post in the background, a "Show N new posts" pill, a composer with a character
  ring, threads, profiles, grouped notifications, and a phone layout with a bottom tab bar.

All five are listed on the gallery at `/demo`.

## The bar

Put the screen beside the reference for its kind (Linear or GitHub for lists, Polar or Catalyst for
settings, WordPress for an editor, Stripe for detail). Reload with the sidebar collapsed: nothing jumps.
Copy the URL of a filtered list into a new tab: the same view. Select three rows: the footer becomes the
bulk bar with keys. Submit an invalid form: every field keeps its value. Delete something: one quiet
toast with Undo. Press `?`: every shortcut you used is listed. At 320 nothing scrolls sideways, in dark
mode it looks designed, and every motion stops under reduced motion.
