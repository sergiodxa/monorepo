---
title: Publish calendar feeds
description: Serve your events as an iCalendar feed people subscribe to, with time zones and recurrence, and read uploaded .ics files back.
section:
    title: Content & feeds
    order: 7
order: 4
lastUpdated: 2026-09-29
---

A calendar feed is the lowest-effort way to keep people coming to your events. They subscribe
once from Apple Calendar, Google Calendar or Outlook, and every change you make afterwards shows
up in their calendar on the next poll: a moved start time, a new venue, a cancellation. This
guide serves your app's meetups as an iCalendar feed and as single-event downloads, writes a
weekly series that stays at 19:00 local time across daylight saving changes, and reads an
uploaded `.ics` file back into your database.

It uses [`@sdxc/icalendar`](/api/icalendar) for the format, [`@sdxc/http`](/api/http) for
the cache and error responses, and [`@sdxc/result`](/api/result) for the parts that can fail.
The meetups come from your own `Meetups` model.

```bash
npm add @sdxc/icalendar @sdxc/http @sdxc/result remix
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

The `.ics` extension is for whoever saves the file. A client goes by the `Content-Type` the
response carries, which the next sections set.

## Turn a meetup into an event

A client decides what to do with an event by two fields. `UID` identifies it, so it must
never change for the same meetup, and `SEQUENCE` says which revision is newer, so it must only
grow. Derive both from the row:

```typescript {% title="app/calendar/events.ts" %}
import type { ICalendar } from "@sdxc/icalendar";

import { utc } from "@sdxc/icalendar";

import type { Meetup } from "~/app/data/meetup";

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
with no extra column. `utc()` turns an epoch timestamp into a UTC date-time, the form that
needs no time zone definition, and drops the milliseconds the format has no room for. A
cancelled meetup stays in the feed with `STATUS:CANCELLED`, so subscribers see it cancelled
instead of watching it vanish. `properties` holds any property the typed fields don't name,
and is empty here.

## Serve the feed

`calendarResponse` writes the calendar and answers with
`Content-Type: text/calendar; charset=utf-8`, which is what a client checks before it accepts a
subscription:

```typescript {% title="app/http/controllers/events/feed.ts" %}
import { policy } from "@sdxc/http/cache";
import { calendarResponse } from "@sdxc/icalendar";
import { createAction } from "remix/router";

import { calendarEvent } from "~/app/calendar/events";
import Meetups from "~/app/data/meetup";
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

`listRecent` is your own query. Include meetups that ended in the last few weeks as well as the
upcoming ones: a client that stops seeing an event removes it, so a feed of only future events
empties people's history as it goes.

`name` is the title the client gives the subscription, and `refreshInterval` asks it to poll
hourly. Both are written twice, once under the RFC 7986 name and once under the older `X-WR-`
and `X-PUBLISHED-TTL` names some clients still read. Clients treat the interval as a hint and
poll on their own schedule; the five-minute `max-age` keeps a busy feed cheap without holding a
change back for long.

To offer a one-click subscription, link to the feed with `webcal:` in place of `https:`. Most
operating systems hand that scheme to the default calendar app, which subscribes instead of
downloading.

## A weekly series in a time zone

A one-off event is an instant, and UTC describes it exactly. A series is different: "every
Thursday at 19:00 in Madrid" is a wall-clock time, and the UTC instant under it shifts by an
hour twice a year. Write that start in its zone, and ship the zone's rules with it:

```typescript {% title="app/calendar/series.ts" %}
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
		alarms: [
			{
				action: "DISPLAY",
				trigger: { before: { minutes: 30 } },
				description: "Thursday meetup starts in 30 minutes",
			},
		],
		properties: [],
	};
	return success({ zone: zone.data, event });
}
```

Add `zone` to the feed's `timeZones` and `event` to its `events`. The writer puts
`TZID=Europe/Madrid` on the start and a `VTIMEZONE` block in the calendar, so a client in any
zone sees 19:00 Madrid time in January and in June alike.

`vtimezone` builds that block from the runtime's `Intl` data, as one observance per offset
change inside the span. Past the span the last offset holds, so make it cover every date the
series will be read for, and rebuild it as time moves: here it runs from a year back to two
years ahead of each request. An unknown zone name fails with a `TimeZoneError`, which makes the
same call a good check on a zone a person picked in a form.

The rest reads as the format does. `byDay` lists the weekdays, and `exceptionDates` removes
the Thursday before Easter, written with the same wall time as the start so it matches that
occurrence. `duration` gives every occurrence its length: hours and minutes are exact, while
days and weeks are nominal and keep their local time across a change. The alarm is written as
`TRIGGER:-PT30M`, half an hour before each occurrence.

## Show the next sessions on your pages

Your own pages need the dates too, and computing them separately is how a page and a calendar
end up disagreeing. `occurrences` expands the same event the feed publishes:

```typescript {% title="app/calendar/next-sessions.ts" %}
import type { ICalendar } from "@sdxc/icalendar";

import { occurrences } from "@sdxc/icalendar/rrule";

const LOOKAHEAD_MS = 60 * 86_400_000;

export function nextSessions(event: ICalendar.Event, now: number) {
	return occurrences(event, { from: now, to: now + LOOKAHEAD_MS, limit: 3 });
}
```

It returns a `Result` holding `{ start, end }` pairs in epoch milliseconds, earliest first.
The event's own start counts as the first occurrence, as the format says, and each exception
is left out.
A session running at `now` is included, which is what a "happening now" badge wants. A `TZID`
resolves through `Intl` here; pass `calendar` in the options to resolve it through that
calendar's own `VTIMEZONE`s first, which matters for files you did not write.

## Offer a single event as a download

An "Add to calendar" button is the same calendar with one event, served as an attachment:

```typescript {% title="app/http/controllers/events/download.ts" %}
import { notFound } from "@sdxc/http/response/html";
import { calendarResponse } from "@sdxc/icalendar";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { calendarEvent } from "~/app/calendar/events";
import Meetups from "~/app/data/meetup";
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

`filename` adds `Content-Disposition: attachment`, with an encoded `filename*` when the name
has characters outside ASCII. The event comes from the same `calendarEvent`, so it carries the
feed's `UID`: someone who downloads it and later subscribes sees one event, not two.

## Read an uploaded calendar

Importing goes the other way: a person uploads an `.ics` file exported from somewhere else.
`parse` reads it leniently and fails only on structure:

```typescript {% title="app/http/controllers/events/import.ts" %}
import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/html";
import { parse, toInstant } from "@sdxc/icalendar";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import Meetups from "~/app/data/meetup";
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

`ctx.formData` and `ctx.log` come from the form-data and [`@sdxc/logger`](/api/logger)
middleware your router already runs. A structural failure, such as an unmatched `BEGIN` or a
line with no `:`, is an `ICalendarParseError` whose message starts with the line number, so it
is worth showing as it is. Everything recoverable becomes a warning instead, like a missing `UID`
or a `STATUS:MAYBE`, and the property is kept verbatim. Each warning is a string starting with
its line, so count them in the log, or show them beside the result, rather than rejecting the
file.

`toInstant` resolves a start through the file's own `VTIMEZONE`s and then `Intl`. It returns
`null` for an all-day `DATE` and for a floating time with no zone, since neither names one
instant; this import skips them, and yours could store the date alone. A recurring event in the
file expands with `occurrences(event, { from, to, calendar })`, passing the parsed `calendar`
so its time zones are the ones the file defined. Store `event.uid` and upsert on it, so a second
import of the same file updates rows instead of duplicating them.

## Invite people by email

A feed publishes; an invitation asks for an answer. `@sdxc/icalendar/itip` builds the RFC 5546
messages for one event: `request` to invite or send a revision, `cancel` to call it off, and
`readReply` to read what an attendee answered. `calendarPart` turns one into the shape
[`@sdxc/mail`](/api/mail) accepts as its `calendar` option, and `nextSequence` decides whether
a change is significant enough to bump `SEQUENCE`.

## Where to go next

- [Publish RSS, Atom and JSON feeds](/docs/content-and-feeds/publish-feeds): the other feeds
  a site publishes, with the same caching concerns.
- [Send email](/docs/data-and-background-work/send-email): the mailer an iTIP invitation goes
  out through.
- [Cache on Cloudflare Workers](/docs/data-and-background-work/cache-on-workers): keep a busy
  feed cheap without delaying a change.
- [Write executable specs](/docs/operations-and-testing/executable-specs): check from outside
  the app that the feed answers with a calendar.
