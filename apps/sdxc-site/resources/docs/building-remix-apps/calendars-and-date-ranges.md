---
title: Calendars, date ranges and time zones
description: Lay out a month calendar in the viewer's zone, read a report's day range from the query string, and let people pick their time zone from the runtime's own list.
section:
    title: Building Remix apps
    order: 4
order: 12
lastUpdated: 2026-10-25
outcomes:
    - "How to lay out a month grid and place events on it in the viewer's zone with `@sdxc/dates`"
    - "How to read a report's day range from the query string"
    - "How to let people pick their time zone from the runtime's own list"
---

Three date screens come up in almost every app: a month calendar with events on it, a report
whose period someone picks, and a settings form where a person says which time zone they
live in. Each one needs the calendar as the viewer reads it, not as the server's clock does,
and [`@sdxc/dates`](/api/dates) answers every calendar question in a zone you pass.

```bash
npm add @sdxc/dates @sdxc/result @sdxc/u @sdxc/ui remix
```

The examples take the viewer's locale and zone from a `Viewer` resolved once per request, as
[Dates, text and identifiers](/docs/building-remix-apps/values) sets up.

## Lay out a month

`monthGrid(date, { weekStartsOn, timeZone })` answers the six weeks of seven days a calendar
draws for the month `date` falls in, with the days borrowed from the months either side marked
`inMonth: false`. Read the month from the query string, falling back to the current one, and
work out the neighbours the pager links to:

```typescript {% title="app/services/calendar/month.ts" %}
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

`?month=2026-06` names June 2026, and anything else falls back to the current month, so a
mangled link still shows a calendar. `addMonths` steps by calendar months in the viewer's zone,
so paging from the 31st lands in the next month. `interval` covers every cell, padding days
included, so the borrowed days show their events too.

## Put events on the grid

The controller loads the events in the interval, and the view groups them by day key in the
viewer's zone. An event at 23:30 in New York is on the 14th there and the 15th in UTC, and
`toDayKey(event.startsAt, timeZone)` files it on the day the reader expects:

```tsx {% title="app/http/controllers/calendar.tsx" %}
import { createAction } from "remix/router";

import { calendarMonth } from "~/app/services/calendar/month";
import { Events } from "~/app/models/events";
import { viewerOf } from "~/app/services/viewer";
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

import type { CalendarMonth } from "~/app/services/calendar/month";
import type { Event } from "~/app/models/events";
import type { Viewer } from "~/app/services/viewer";

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

Each cell carries `key`, `day` and `weekday`, computed in the zone. The heading row reads its
labels from the first week, so it follows `weekStartsOn`, and `formatWeekday` and `formatParts`
name the columns and the month in the viewer's locale.

## Read a report's day range

A report covers a run of whole days. A `DayRange` is two `"YYYY-MM-DD"` keys, both ends
included, so it travels through a URL and a form as written, and it reads the same in every
zone. Offer presets, and hold a hand-picked range to the same rules:

```typescript {% title="app/services/reports/range.ts" %}
import type { DayRange, TimeZone } from "@sdxc/dates";

import {
	addMonths,
	lastNDaysRange,
	monthRange,
	subDays,
	toDayKey,
	validateDayRange,
} from "@sdxc/dates";
import { success } from "@sdxc/result";

export type Preset = "lastMonth" | "last30Days";

export function presetRange(preset: Preset, timeZone: TimeZone, now = new Date()) {
	let yesterday = subDays(now, 1);
	switch (preset) {
		case "lastMonth":
			return monthRange(addMonths(now, -1, timeZone), timeZone);
		case "last30Days":
			return lastNDaysRange(30, { from: yesterday, timeZone });
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

The data rolls up nightly, so yesterday is the latest day a range may name. `validateDayRange`
answers a `Result` whose failure's `problem` names the first rule the range breaks, which maps
straight to a message:

```typescript {% title="resources/views/reports/messages.ts" %}
import type { DayRangeProblem } from "@sdxc/dates";

export const RANGE_PROBLEMS: Record<DayRangeProblem, string> = {
	invalid: "Pick a start and an end date.",
	reversed: "The start date has to come before the end date.",
	tooLate: "Data is available through yesterday.",
	tooLong: "Pick a range of a year or less.",
};
```

To query by instants, `fromDayKey(range.from, timeZone)` gives the first instant of the first
day, and `endOfDay` on the last day's start gives the last.

## Let people pick their time zone

`timeZonesByRegion()` groups the zones the runtime knows by IANA area (`"America"`,
`"Europe"`, …), ready for one `<optgroup>` each, and `"UTC"` gets its own option at the top:

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

> [!NOTE]
> An alias such as `"Etc/UTC"`, which `Intl` also accepts, fails `isSupportedTimeZone`. To
> accept every name `Intl` takes, such as a zone read from a calendar file, use
> `isValidTimeZone` instead.

## Test the month and the range

Both services are plain functions of a zone and a clock, so a test passes a fixed `now` and
asserts on the keys a page would link to, with no request involved:

```typescript {% title="app/services/reports/range.test.ts" %}
import { isFailure, unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { calendarMonth } from "~/app/services/calendar/month";
import { readRange } from "~/app/services/reports/range";

let NOW = new Date("2026-06-15T12:00:00Z");

test("pages a month in the viewer's zone", () => {
	let month = calendarMonth("2026-06", "America/New_York");

	expect(month.weeks.flat()).toHaveLength(42);
	expect(month.previous).toBe("2026-05");
	expect(month.next).toBe("2026-07");
});

test("defaults to last month and refuses a range reaching today", () => {
	let fallback = readRange(new URL("https://example.com/reports"), "UTC", NOW);
	expect(unwrap(fallback)).toEqual({ from: "2026-05-01", to: "2026-05-31" });

	let picked = readRange(
		new URL("https://example.com/reports?from=2026-06-01&to=2026-06-15"),
		"UTC",
		NOW,
	);
	expect(isFailure(picked) && picked.error.problem).toBe("tooLate");
});
```

## Where to go next

- [Dates, text and identifiers](/docs/building-remix-apps/values) — resolving the viewer's
  zone and formatting a date in it.
- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — running
  the settings schema in an action and showing its issues.
- [`@sdxc/dates`](/api/dates) — every boundary, grid and range helper, and the zone math
  underneath.
