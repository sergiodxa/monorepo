---
title: Pulse
headline: An ops dashboard whose filters, peeks and charts all live in the address and stream in at their final size
summary: An invented ops dashboard for services, deploys and incidents, with filters in the URL, a keyboard-driven services table, a peek sheet and charts that stream in as their own frames.
tagline: An ops dashboard with streaming charts
cover: overview
shots:
  - id: overview
    page: ""
    wait: 1500
    alt: Pulse's overview, four stat cards above a latency chart with a shaded incident band, a comparison line and a range picker.
  - id: chart
    page: "?metric=latency"
    highlight: "#pulse-chart"
    wait: 1500
    alt: The latency chart, a solid current line over a dashed comparison line, a hatched no-data band and a red band labelled INC-482 investigating.
  - id: filter-bar
    page: "services?status=down&status=degraded"
    highlight: "[data-slot='filter-bar']"
    alt: The services filter bar with status count tabs, facet buttons, a search field, a sort menu and an Updated status.
  - id: peek
    page: "services?peek=checkout-api"
    highlight: "[data-slot='detail-sheet-panel']"
    wait: 1500
    alt: A detail sheet for checkout-api with its properties, a position counter and a timeline of incidents and deploys.
  - id: status-strip
    page: "services/checkout-api"
    highlight: "[data-slot='status-strip']"
    wait: 1500
    alt: A 90-day status strip for checkout-api, one bar per day, a few amber and red among the green.
  - id: danger-zone
    page: "settings"
    highlight: "[data-slot='danger-zone']"
    alt: The settings danger zone, with transfer ownership and delete workspace cards.
  - id: phone
    page: "services"
    viewport: phone
    alt: The services list on a phone, count tabs, a search field and a Filters menu above rows that show each service's name and status.
---

Pulse is an invented operations dashboard for Northwind, a made-up company with a few dozen services. It covers an overview of uptime, latency, errors and incidents, a services list, a page for each service, incidents, deployments, status pages and workspace settings. The art direction is dense and technical: graphite slate neutrals, an electric cyan signal, tight 4px corners, and figures set in a monospace face.

The build exists to show the app-layer components of `@sdxc/ui` working together under real data shapes: a filterable table you can drive from the keyboard, a peek sheet, a bulk-action bar, charts with gaps and annotations, and a settings panel with a danger zone. Two things make it worth reading closely. Every view a person might want to share is an address. And every part that is slow to compute streams in after the page, into a placeholder of exactly its size, so nothing on screen moves when it lands.

## The brief

A monitoring dashboard is read under pressure. When something breaks, the person opening it needs the state of every service at a glance, a way to narrow the list to what is failing, and enough detail to act, without losing their place. That means dense tables that stay readable, filters that survive a reload and can be pasted into an incident channel, charts that are honest about missing data, and a keyboard path through all of it.

Pulse takes on each of those. It also takes on the states a real dashboard has to draw: loading, error, no results, an all-clear, and a first run with nothing set up yet. Each is one link away, through `?state=loading` or `?state=error` on the overview and the services list, so a reviewer can see every one without breaking anything. Every form answers with a redirect and a toast, and the demo keeps nothing.

## Stat cards that drive one chart

The overview opens with four [StatCard](/api/ui/stat-card) tabs: uptime, latency, errors and incidents. Each card is a link that sets `?metric=`, and a [RangePicker](/api/ui/range-picker) beside them sets `?range=`. So `?metric=latency&range=90d` is a view you can bookmark, and the server renders exactly that chart.

The chart is the [Chart](/api/ui/chart) component with four layers. A comparison line shows the previous period. The current line has null points where data is missing, and the component draws them as gaps. A hatched `Chart.Band` covers the no-data stretch, and a danger-toned band marks the live incident, labelled from the incident's own data as "INC-482 · investigating". Its shape is drawn the way a live incident looks: latency spikes the hour it broke, then holds a noisy plateau with brief dips.

![The latency chart, a solid current line over a dashed comparison line, a hatched no-data band and a red band labelled INC-482 investigating](/showcase/pulse/chart.webp "The chart is honest about missing data: a hatched band where nothing was recorded, and the incident labelled from its own record.")

```tsx
<Chart.Band
	from={series.gap[0] - 0.5}
	to={series.gap[1] + 0.5}
	label={COPY.overview.noData}
	variant="hatched"
/>
```

Neither the stats nor the chart is in the first response. The overview's page sends its shell, header and "Needs attention" list at once. The stat cards and the chart each arrive as a frame of their own, from `frames/overview/stats` and `frames/overview/chart`. Until they land, `StatCard.Skeleton` cards with two footer lines, and a box with the chart's aspect ratio, hold their places at both a phone's and a desktop's width.

## A services table built for triage

The services list is where an on-call engineer spends their time. A [FilterBar](/api/ui/filter-bar) sits above the table with status count tabs, facets for status and region, a search field, a sort menu and a quiet status slot. Each control writes a query parameter, so `services?status=down&status=degraded` or `services?region=sin&sort=latency` is a view a teammate can open. Density and auto-refresh share one [ViewOptions](/api/ui/view-options) menu, so the toolbar reads as one calm row.

![The services filter bar with status count tabs, facet buttons, a search field, a sort menu and an Updated status](/showcase/pulse/filter-bar.webp "Every tab, facet, search and sort in the bar writes the address, so the filtered list is a link.")

[AutoRefresh](/api/ui/auto-refresh) shows "Updated …" in that status slot and reloads on the interval the visitor picks. The list carries the time it was rendered, so the first refresh waits its full interval. Filter tabs, sort orders and chips start loading their page on intent, so the click that follows renders a stored page.

The [Table](/api/ui/table) is an island with the [rowNavigation](/api/ui/mixins/row-navigation) mixin. `j` and `k` move between rows, `x` selects, Enter opens, and Space opens the focused row's peek sheet. Each row draws a [Sparkline](/api/ui/sparkline), a [StatusDot](/api/ui/status-dot) with a state word, right-aligned tabular numbers, a [RelativeTime](/api/ui/relative-time), and a 30-day [StatusStrip](/api/ui/status-strip). Drawing 30 days here and keeping all 90 for a service's own page keeps the list's HTML small. Selecting rows raises a [SelectionBar](/api/ui/selection-bar) with pause, resume and delete. A delete's toast carries an Undo button that posts the restore.

```tsx
<Table
	aria-label={labels.table}
	density={density}
	pinFirstColumn
	mix={[
		rowNavigation({ peek: true, labels: labels.keys }),
		on("ui:row-peek", (event) => { /* … */ }),
	]}
>
```

## A peek that keeps your place

Opening a row's peek sets `?peek=checkout-api`. The page renders the list exactly as it was, and a [DetailSheet](/api/ui/detail-sheet) opens beside it with an `n / N` position, the service's properties in a [PropertyList](/api/ui/property-list), and a [Timeline](/api/ui/timeline) of incidents and deploys. The sheet's body streams in as its own frame over a [Skeleton](/api/ui/skeleton) of the same size. Values that are monospace, such as the endpoint, version, latency, error rate and uptime, get monospace placeholder bars, so the content lands without moving anything in any font.

![A detail sheet for checkout-api with its properties, a position counter and a timeline of incidents and deploys](/showcase/pulse/peek.webp "The peek opens beside the list from its own address, with the list untouched behind it.")

A service's own page goes deeper. It has a [PageHeader](/api/ui/page-header) with status, actions and tabs for overview, checks, incidents and settings, each a `?tab=` link. The chart, the 90-day strip, the history and the properties each stream in as cached frames. The history scrolls inside a box of fixed height, and the endpoint fits one line with the full address on hover.

![A 90-day status strip for checkout-api, one bar per day, a few amber and red among the green](/showcase/pulse/status-strip.webp "A service's own page keeps all 90 days of its status strip.")

## A shell that stays put, and a keyboard map

The [AppShell](/api/ui/app-shell) sidebar, header and status strip stay mounted while only the `main` frame swaps between screens. The address and history update, Back and Forward restore the screen and its scroll, and row actions and settings forms post into `main` and raise a [Toasts](/api/ui/toasts) message without adding a history entry. When a post redraws the row whose button was pressed, focus settles on that button's replacement, its form, or the screen's heading. With JavaScript off, every link and form still works as a full page. A [Banner](/api/ui/banner) across the top of the shell carries a declined-card billing notice with a link to update the payment method.

A [KeyboardHelp](/api/ui/keyboard-help) sheet opens on `?`, or from Keyboard shortcuts in the user menu, and lists every key the app answers to. The workspace switcher and the user row open real [Menu](/api/ui/menu)s.

## Settings with every save model

Settings is a [SettingsLayout](/api/ui/settings-layout) of [SettingsSection](/api/ui/settings-section)s. Some rows are [Switch](/api/ui/switch)es that save at once. Others are forms with an explicit Save, and a form that fails validation redirects back with a toast saying what to fix. The workspace URL row draws `pulse.dev/` as a prefix inside the field.

The [DangerZone](/api/ui/danger-zone) at the foot holds ownership transfer and workspace deletion. Deleting asks the visitor to type the workspace slug exactly, and anything else returns with a toast.

![The settings danger zone, with transfer ownership and delete workspace cards](/showcase/pulse/danger-zone.webp "Destructive actions sit last, and deletion asks for the workspace slug typed out.")

On a phone the sidebar becomes a sheet behind a menu button, the filter bar folds its facets into one Filters menu under the count tabs and search, and the table keeps its first column pinned, so a service's name stays in view while the rest scrolls sideways.

![The services list on a phone, count tabs, a search field and a Filters menu above rows that show each service's name and status](/showcase/pulse/phone.webp "On a phone the facets fold into one Filters menu, and the service column stays pinned.")

## Takes after

- [Vercel](https://vercel.com) — the observability overview where a metric card picks the chart, and a deployments list. Pulse adds the incident band and hatched gaps to the chart.
- [Linear](https://linear.app) — `j`/`k` row navigation, a peek panel beside the list, and a `?` shortcuts sheet. In Pulse the peek is an address.
- [Sentry](https://sentry.io) — incident tabs for open and resolved, and an "All caught up" view for what is assigned to you.

## Where to start reading

- [`pulse/frames.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pulse/frames.tsx) — every part that streams in after the shell, each reading its state from its own path.
- [`pulse/services-table.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pulse/services-table.tsx) — the keyboard-driven table island.
- [`pulse/overview.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/pulse/overview.tsx) — stat cards, range picker and the annotated chart.
