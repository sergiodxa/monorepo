---
title: Calendars, date ranges and time zones
description: Lay out a month calendar in the viewer's zone, read a report's day range from the query string, and let people pick their time zone from the runtime's own list.
section:
    title: Building Remix apps
    order: 3
order: 12
lastUpdated: 2026-10-08
---

Three date screens come up in almost every app: a month calendar with events on it, a report
whose period someone picks, and a settings form where a person says which time zone they
live in. Each one needs the calendar as the viewer reads it, not as the server's clock does,
and [`@sdxc/dates`](/api/dates) answers every calendar question in a zone you pass.

```bash
npm add @sdxc/dates @sdxc/result @sdxc/validate @sdxc/u @sdxc/ui remix
```

The examples take the viewer's locale and zone from a `Viewer` resolved once per request, as
[Dates, text and identifiers](/docs/building-remix-apps/values) sets up.

## Lay out a month

`monthGrid(date, { weekStartsOn, timeZone })` answers the six weeks a calendar draws for the
month `date` falls in, seven days each. The first row starts on the `weekStartsOn` day on or
before the 1st, and the days borrowed from the months either side carry `inMonth: false`.
Every month is the same 6 × 7 grid, so the calendar keeps its height as a person pages
through it.

Read the month from the query string, falling back to the current one, and work out the
neighbours the pager links to:

```typescript {% title="app/calendar/month.ts" %}
import type { MonthGridDay, TimeZone, Weekday } from "@sdxc/dates";

import { addMonths, endOfDay, fromDayKey, monthGrid, toDayKey } from "@sdxc/dates";
import { isSuccess } from "@sdxc/result";

export interface CalendarMonth {
	date: Date;
	weeks: MonthGridDay[][];
	interval: { start: Date; end: Date };
	previous: string;
	next: string;
}

function monthKey(date: Date, timeZone: TimeZone) {
	return toDayKey(date, timeZone).slice(0, 7);
}

export function calendarMonth(
	param: string | null,
	timeZone: TimeZone,
	weekStartsOn: Weekday = 1,
): CalendarMonth {
	let first = param === null ? null : fromDayKey(`${param}-01`, timeZone);
	let date = first !== null && isSuccess(first) ? first.data : new Date();

	let weeks = monthGrid(date, { weekStartsOn, timeZone });
	let days = weeks.flat();

	return {
		date,
		weeks,
		interval: {
			start: days[0]?.date ?? date,
			end: endOfDay(days.at(-1)?.date ?? date, timeZone),
		},
		previous: monthKey(addMonths(date, -1, timeZone), timeZone),
		next: monthKey(addMonths(date, 1, timeZone), timeZone),
	};
}
```

`?month=2026-06` names June 2026, and anything that is not a month falls back to the current
one, so a mangled link still shows a calendar. `fromDayKey` gives the first instant of that
day in the viewer's zone, and `addMonths` steps by calendar months in the same zone, so
paging from the 31st lands in the next month rather than skipping one.

`interval` runs from the first instant of the first cell to the last instant of the last,
padding days included: query events over it and the borrowed days show their events too.
`monthGrid` always answers 42 days, so the fallbacks are there for the type checker.

## Put events on the grid

The controller loads the events in the interval, and the view groups them by day key in the
viewer's zone. An event at 23:30 in New York is on the 14th there and the 15th in UTC, and
`toDayKey(event.startsAt, timeZone)` files it on the day the reader expects:

```tsx {% title="app/http/controllers/calendar.tsx" %}
import { createAction } from "remix/router";

import { calendarMonth } from "~/app/calendar/month";
import { Events } from "~/app/data/events";
import { viewerOf } from "~/app/http/viewer";
import { CalendarPage } from "~/resources/views/calendar";
import routes from "~/routes/web";

export default createAction(routes.calendar, async (ctx) => {
	let viewer = viewerOf(ctx.request);
	let month = calendarMonth(ctx.url.searchParams.get("month"), viewer.timeZone);
	let events = await Events.between(ctx.db, month.interval);

	return ctx.render(<CalendarPage month={month} events={events} viewer={viewer} />);
});
```

```tsx {% title="resources/views/calendar.tsx" %}
import type { Handle } from "remix/component";

import { formatParts, formatWeekday, toDayKey } from "@sdxc/dates";
import { fg } from "@sdxc/u/color";
import { grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";

import type { CalendarMonth } from "~/app/calendar/month";
import type { Event } from "~/app/data/events";
import type { Viewer } from "~/app/http/viewer";

import routes from "~/routes/web";

interface Props {
	month: CalendarMonth;
	events: Event[];
	viewer: Viewer;
}

export function CalendarPage(handle: Handle<Props>) {
	return () => {
		let { month, events, viewer } = handle.props;
		let { locale, timeZone } = viewer;

		let byDay = new Map<string, Event[]>();
		for (let event of events) {
			let key = toDayKey(event.startsAt, timeZone);
			byDay.set(key, [...(byDay.get(key) ?? []), event]);
		}

		let title = formatParts(month.date, {
			locale,
			timeZone,
			month: "long",
			year: "numeric",
		})
			.map((part) => part.value)
			.join("");

		return (
			<section mix={[vstack({ gap: 4 })]}>
				<h1>{title}</h1>
				<nav>
					<LinkButton
						href={`${routes.calendar.href()}?month=${month.previous}`}
					>
						Previous
					</LinkButton>
					<LinkButton
						href={`${routes.calendar.href()}?month=${month.next}`}
					>
						Next
					</LinkButton>
				</nav>
				<ol
					mix={[
						grid(),
						gridTemplate({ columns: "repeat(7, minmax(0, 1fr))" }),
					]}
				>
					{month.weeks[0]?.map((day) => (
						<li key={day.weekday} aria-hidden="true">
							{formatWeekday(day.weekday, { locale })}
						</li>
					))}
					{month.weeks.flat().map((day) => (
						<li
							key={day.key}
							mix={[fg(day.inMonth ? "neutral" : "neutral.muted")]}
						>
							<time dateTime={day.key}>{day.day}</time>
							<ul>
								{(byDay.get(day.key) ?? []).map((event) => (
									<li key={event.id}>{event.title}</li>
								))}
							</ul>
						</li>
					))}
				</ol>
			</section>
		);
	};
}
```

Each cell already carries what a renderer needs, computed in the zone: `key` for the
lookup and the `dateTime` attribute, `day` for the number printed, `weekday` for the column,
and `date` for the first instant of the day. The heading row reads its labels from the first
week, so it follows `weekStartsOn` with no index arithmetic, and `formatWeekday` names each
column in the viewer's locale. `formatParts` builds the "June 2026" heading from the
locale's own month name and order.

For a date picker rather than an events calendar, `Calendar` and `DatePicker` in
[`@sdxc/ui`](/api/ui) draw the grid and own the keyboard.

## Read a report's day range

A report covers a run of whole days. A `DayRange` is two `"YYYY-MM-DD"` keys, both ends
included, so it travels through a URL and a form as written, and it reads the same in every
zone. Offer presets, and hold a hand-picked range to the same rules:

```typescript {% title="app/reports/range.ts" %}
import type { DayRange, TimeZone } from "@sdxc/dates";

import {
	addMonths,
	lastNDaysRange,
	monthRange,
	quarterRange,
	subDays,
	toDayKey,
	validateDayRange,
	yearToDateRange,
} from "@sdxc/dates";
import { success } from "@sdxc/result";

export type Preset = "lastMonth" | "last30Days" | "lastQuarter" | "yearToDate";

export function presetRange(preset: Preset, timeZone: TimeZone, now = new Date()) {
	let yesterday = subDays(now, 1);
	switch (preset) {
		case "lastMonth":
			return monthRange(addMonths(now, -1, timeZone), timeZone);
		case "last30Days":
			return lastNDaysRange(30, { from: yesterday, timeZone });
		case "lastQuarter":
			return quarterRange(addMonths(now, -3, timeZone), timeZone);
		case "yearToDate":
			return yearToDateRange(yesterday, timeZone);
	}
}

export function readRange(url: URL, timeZone: TimeZone, now = new Date()) {
	let from = url.searchParams.get("from");
	let to = url.searchParams.get("to");
	if (from === null || to === null) {
		return success<DayRange>(presetRange("lastMonth", timeZone, now));
	}

	let latest = toDayKey(subDays(now, 1), timeZone);
	return validateDayRange({ from, to }, { latest, maxDays: 366 });
}
```

The data rolls up nightly, so it is complete through yesterday: that is the latest day a
range may name, and the presets end there. `monthRange` and `quarterRange` name the whole
month or quarter an instant falls in, `yearToDateRange` runs from January 1st to the given
day, and `lastNDaysRange(30, …)` is the thirty days ending on `from`, that day included.

`validateDayRange` answers a `Result`, and its failure is an `InvalidDayRangeError` whose
`problem` names the first rule the range breaks, which maps straight to a message:

```typescript {% title="app/reports/messages.ts" %}
import type { DayRangeProblem } from "@sdxc/dates";

export const RANGE_PROBLEMS: Record<DayRangeProblem, string> = {
	invalid: "Pick a start and an end date.",
	reversed: "The start date has to come before the end date.",
	tooLate: "Data is available through yesterday.",
	tooLong: "Pick a range of a year or less.",
};
```

`invalid` covers an end that is not an exact day key naming a real day, so `2026-02-30` and
`2026-2-1` both fail it. To label the report, `isWholeMonth(range)` says whether the range is
exactly one calendar month, the case where a heading or a download's file name can name the
month alone, and `dayRangeLength(range)` counts its days, both ends included. To query by
instants, `fromDayKey(range.from, timeZone)` gives the first instant of the first day, and
`endOfDay` on the last day's start gives the last.

## Let people pick their time zone

A settings form offers the zones the runtime knows. `timeZonesByRegion()` groups them by
IANA area (`"America"`, `"Europe"`, …), ready for one `<optgroup>` each, and `"UTC"`, which
has no area, gets its own option at the top:

```tsx {% title="resources/components/time-zone-select.tsx" %}
import type { Handle } from "remix/component";

import { timeZonesByRegion } from "@sdxc/dates";
import { Select } from "@sdxc/ui";

export function TimeZoneSelect(handle: Handle<{ selected: string }>) {
	return () => {
		let { selected } = handle.props;

		return (
			<Select name="timeZone" aria-label="Time zone">
				<Select.Option value="UTC" selected={selected === "UTC"}>
					UTC
				</Select.Option>
				{timeZonesByRegion().map((group) => (
					<Select.Group key={group.region} label={group.region}>
						{group.zones.map((zone) => (
							<Select.Option
								key={zone}
								value={zone}
								selected={zone === selected}
							>
								{zone.replaceAll("_", " ")}
							</Select.Option>
						))}
					</Select.Group>
				))}
			</Select>
		);
	};
}
```

The action checks the submitted value against the same list with `isSupportedTimeZone`, so
the form and the check never disagree:

```typescript {% title="app/http/validators/settings.ts" %}
import { isSupportedTimeZone } from "@sdxc/dates";
import * as s from "remix/data-schema";

export const SETTINGS = s.object({
	timeZone: s
		.string()
		.refine(isSupportedTimeZone, "Pick a time zone from the list"),
});
```

`isSupportedTimeZone` accepts one spelling per zone, so a stored zone always matches the
option the form selects: an alias such as `"Etc/UTC"`, which `Intl` also accepts, fails it.
To accept every name `Intl` takes, such as a zone read from a calendar file, use
`isValidTimeZone` instead. The list is read from `Intl.supportedValuesOf("timeZone")` on
first use and cached for the isolate, with `"UTC"` added by name, since some runtimes,
Cloudflare Workers among them, leave it out.

`systemTimeZone()` reads the zone the runtime's clock runs in. In the browser that is the
person's own setting, which makes it the value an island can preselect on a first visit; on
a server it is usually `"UTC"`.

## Where to go next

- [Dates, text and identifiers](/docs/building-remix-apps/values) — resolving the viewer's
  zone and formatting a date in it.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — running
  the settings schema in an action and showing its issues.
- [`@sdxc/dates`](/api/dates) — every boundary, grid and range helper, and the zone math
  underneath.
