---
title: Publish calendar feeds
description: Serve your events as an iCalendar feed people subscribe to, with time zones and recurrence, and read uploaded .ics files back.
section:
    title: Content & feeds
    order: 8
order: 4
lastUpdated: 2026-10-25
outcomes:
    - "How to serve your events as an iCalendar feed people subscribe to"
    - "How to describe a weekly series in a time zone and offer a single event as a download"
    - "How to read an uploaded `.ics` file back into your database"
---

A calendar feed keeps people coming to your events: they subscribe once from Apple Calendar,
Google Calendar or Outlook, and every change you make shows up on the next poll. This guide
serves your app's meetups as an iCalendar feed and as single-event downloads, writes a weekly
series that stays at 19:00 local time across daylight saving changes, and reads an uploaded
`.ics` file back into your database. It uses [`@sdxc/icalendar`](/api/icalendar) for the
format; the meetups come from your own `Meetups` model.

```bash
npm add @sdxc/http @sdxc/icalendar @sdxc/result remix
```

## Give the feed a route

A calendar client subscribes to a URL, so the feed needs a stable one. Declare it next to the
pages it mirrors, with a download per event and an endpoint that accepts uploads:

```typescript {% title="routes/web.ts" %}
import { get, post, route } from "remix/routes";

export default route({
	events: {
		index: get("/events"),
		show: get("/events/:id"),
		download: get("/events/:id/calendar.ics"),
		feed: get("/events.ics"),
		import: post("/events/import"),
	},
});
```

## Turn a meetup into an event

A client decides what to do with an event by two fields. `UID` identifies it, and `SEQUENCE`
says which revision is newer. Derive both from the row:

> [!WARNING]
> Keep `UID` fixed for the same meetup and let `SEQUENCE` only grow. A client that sees a new
> `UID` adds a second event, and one that sees a lower `SEQUENCE` ignores the change.

```typescript {% title="app/services/calendar/events.ts" %}
import type { ICalendar } from "@sdxc/icalendar";

import { utc } from "@sdxc/icalendar";

import type { Meetup } from "~/app/models/meetup";

export function calendarEvent(meetup: Meetup, url: string): ICalendar.Event {
	return {
		uid: `${meetup.id}@events.example.com`,
		dtstamp: new Date(meetup.updatedAt),
		lastModified: new Date(meetup.updatedAt),
		sequence: Math.floor((meetup.updatedAt - meetup.createdAt) / 1000),
		start: utc(meetup.startsAt),
		end: utc(meetup.endsAt),
		summary: meetup.title,
		location: meetup.venue,
		url,
		status: meetup.cancelledAt === null ? "CONFIRMED" : "CANCELLED",
		properties: [],
	};
}
```

The seconds between creation and the last edit only ever grow, which makes them a `SEQUENCE`
with no extra column. `utc()` turns an epoch timestamp into a UTC date-time, which needs no time
zone definition. A cancelled meetup stays in the feed with `STATUS:CANCELLED`, so subscribers
see it cancelled instead of watching it vanish.

## Serve the feed

`calendarResponse` writes the calendar and answers with
`Content-Type: text/calendar; charset=utf-8`, which is what a client checks before it accepts a
subscription:

```typescript {% title="app/http/controllers/events/feed.ts" %}
import { policy } from "@sdxc/http/cache";
import { calendarResponse } from "@sdxc/icalendar";
import { createAction } from "remix/router";

import { calendarEvent } from "~/app/services/calendar/events";
import Meetups from "~/app/models/meetup";
import routes from "~/routes/web";

export default createAction(routes.events.feed, async (ctx) => {
	let meetups = await Meetups.listRecent(ctx.db);
	let events = meetups.map((meetup) => {
		let url = new URL(routes.events.show.href({ id: meetup.id }), ctx.url).href;
		return calendarEvent(meetup, url);
	});

	let cacheControl = policy({ visibility: "public", maxAge: "5 minutes" });
	return calendarResponse(
		{
			productId: "-//example//events//EN",
			name: "Example meetups",
			url: new URL(routes.events.index.href(), ctx.url).href,
			refreshInterval: { hours: 1 },
			timeZones: [],
			events,
			components: [],
			properties: [],
		},
		{ headers: { "Cache-Control": cacheControl.toString() } },
	);
});
```

> [!WARNING]
> Include meetups that ended in the last few weeks as well as the upcoming ones. A client that
> stops seeing an event removes it, so a feed of only future events empties people's history as
> it goes.

`name` is the title the client gives the subscription, and `refreshInterval` asks it to poll
hourly. For a one-click subscription, link to the feed with `webcal:` in place of `https:`.

## A weekly series in a time zone

A one-off event is an instant, and UTC describes it exactly. A series is different: "every
Thursday at 19:00 in Madrid" is a wall-clock time, and the UTC instant under it shifts by an
hour twice a year. Write that start in its zone, and ship the zone's rules with it:

```typescript {% title="app/services/calendar/series.ts" %}
import type { ICalendar } from "@sdxc/icalendar";

import { vtimezone } from "@sdxc/icalendar/timezone";
import { isFailure, success } from "@sdxc/result";

const TIME_ZONE = "Europe/Madrid";
const YEAR_MS = 365 * 86_400_000;

function at(day: [number, number, number]): ICalendar.DateValue {
	let [year, month, date] = day;
	let wall = { year, month, day: date, hour: 19, minute: 0, second: 0 };
	return { type: "date-time", wall, zone: { tzid: TIME_ZONE } };
}

export function weeklyMeetup(now: number) {
	let zone = vtimezone(TIME_ZONE, { from: now - YEAR_MS, to: now + 2 * YEAR_MS });
	if (isFailure(zone)) return zone;

	let event: ICalendar.Event = {
		uid: "thursday-meetup@events.example.com",
		dtstamp: new Date(now),
		start: at([2026, 1, 8]),
		duration: { hours: 2 },
		recurrence: { frequency: "WEEKLY", byDay: [{ weekday: "TH" }] },
		exceptionDates: [at([2026, 4, 2])],
		summary: "Thursday meetup",
		properties: [],
	};
	return success({ zone: zone.data, event });
}
```

Add `zone` to the feed's `timeZones` and `event` to its `events`. The writer puts
`TZID=Europe/Madrid` on the start and a `VTIMEZONE` block, built from the runtime's `Intl`
data, in the calendar, so a client in any zone sees 19:00 Madrid time all year.

> [!WARNING]
> Past the span the last offset holds, so make it cover every date the series will be read for,
> and rebuild it as time moves: here it runs from a year back to two years ahead of each request.

`exceptionDates` removes the Thursday before Easter, written with the same wall time as the
start so it matches that occurrence.

## Show the next sessions on your pages

Your pages need the dates too, and `occurrences` expands the same event the feed publishes, so
the two never disagree:

```typescript {% title="app/services/calendar/next-sessions.ts" %}
import type { ICalendar } from "@sdxc/icalendar";

import { occurrences } from "@sdxc/icalendar/rrule";

const LOOKAHEAD_MS = 60 * 86_400_000;

export function nextSessions(event: ICalendar.Event, now: number) {
	return occurrences(event, { from: now, to: now + LOOKAHEAD_MS, limit: 3 });
}
```

It returns a `Result` holding `{ start, end }` pairs in epoch milliseconds, earliest first,
with each exception left out.

## Offer a single event as a download

An "Add to calendar" button is the same calendar with one event, served as an attachment:

```typescript {% title="app/http/controllers/events/download.ts" %}
import { notFound } from "@sdxc/http/response/html";
import { calendarResponse } from "@sdxc/icalendar";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { calendarEvent } from "~/app/services/calendar/events";
import Meetups from "~/app/models/meetup";
import routes from "~/routes/web";

export default createAction(routes.events.download, async (ctx) => {
	let { id } = s.parse(s.object({ id: s.string() }), ctx.params);
	let meetup = await Meetups.find(ctx.db, id);
	if (meetup === null) return notFound("Not Found");

	let url = new URL(routes.events.show.href({ id }), ctx.url).href;
	return calendarResponse(
		{
			productId: "-//example//events//EN",
			timeZones: [],
			events: [calendarEvent(meetup, url)],
			components: [],
			properties: [],
		},
		{ filename: "meetup.ics" },
	);
});
```

`filename` adds `Content-Disposition: attachment`. The event carries the feed's `UID`, so someone
who downloads it and later subscribes sees one event, not two.

## Read an uploaded calendar

Importing goes the other way: a person uploads an `.ics` file exported from somewhere else.
`parse` reads it leniently and fails only on structure:

```typescript {% title="app/http/controllers/events/import.ts" %}
import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/html";
import { parse, toInstant } from "@sdxc/icalendar";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Meetups from "~/app/models/meetup";
import routes from "~/routes/web";

export default createAction(routes.events.import, async (ctx) => {
	let file = ctx.formData.get("calendar");
	if (!(file instanceof File)) return badRequest("Choose an .ics file to import.");

	let parsed = parse(await file.text());
	if (isFailure(parsed)) return badRequest(parsed.error.message);

	let { calendar, warnings } = parsed.data;
	let counts = { events: calendar.events.length, warnings: warnings.length };
	ctx.log.set({ calendarImport: counts });

	for (let event of calendar.events) {
		let startsAt = toInstant(event.start, calendar);
		if (startsAt === null) continue;
		let title = event.summary ?? "Untitled";
		await Meetups.importEvent(ctx.db, { uid: event.uid, title, startsAt });
	}

	return redirect(routes.events.index.href(), { status: redirect.Status.SeeOther });
});
```

A structural failure is an `ICalendarParseError` whose message starts with the line number, so
show it as it is; anything recoverable becomes a warning instead. `toInstant` returns `null`
for an all-day date or a floating time, which this import skips. Upsert on `event.uid`, so a
second import of the same file updates rows instead of duplicating them.

## Test the series

The series is where a calendar goes wrong quietly, so test it through `nextSessions`: January
and June sessions both start at 19:00 in Madrid (18:00 and 17:00 UTC), and the excluded
Thursday is skipped:

```typescript {% title="app/services/calendar/series.test.ts" %}
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { nextSessions } from "~/app/services/calendar/next-sessions";
import { weeklyMeetup } from "~/app/services/calendar/series";

test("keeps 19:00 Madrid time across the daylight saving change", () => {
	let { event } = unwrap(weeklyMeetup(Date.UTC(2026, 0, 1)));

	let [january] = unwrap(nextSessions(event, Date.UTC(2026, 0, 1)));
	let [june] = unwrap(nextSessions(event, Date.UTC(2026, 5, 1)));

	expect(january?.start).toBe(Date.UTC(2026, 0, 8, 18));
	expect(june?.start).toBe(Date.UTC(2026, 5, 4, 17));
});

test("skips the Thursday before Easter", () => {
	let { event } = unwrap(weeklyMeetup(Date.UTC(2026, 2, 1)));

	let [next] = unwrap(nextSessions(event, Date.UTC(2026, 2, 30)));

	expect(next?.start).toBe(Date.UTC(2026, 3, 9, 17));
});
```

## Where to go next

- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds): the other feeds
  a site publishes, with the same caching concerns.
- [Model events and tasks as JSCalendar](/docs/content-and-feeds/jscalendar): store imported
  events whole, as JSON, and write them back to this feed.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers): keep a busy
  feed cheap without delaying a change.
