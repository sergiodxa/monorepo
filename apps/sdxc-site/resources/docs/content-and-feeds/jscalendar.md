---
title: Model events and tasks as JSCalendar
description: Store and serve events and tasks as RFC 8984 JSCalendar JSON, expand their recurrences into an agenda, edit them with PatchObjects, and convert them to and from iCalendar.
section:
    title: Content & feeds
    order: 8
order: 36
lastUpdated: 2026-10-25
outcomes:
    - "How to validate JSCalendar events and tasks from a request with `@sdxc/jscalendar`"
    - "How to expand recurring events into an agenda and edit one occurrence with a PatchObject"
    - "When to convert JSCalendar to iCalendar, and how to import an `.ics` file into it"
---

An event people actually schedule repeats every Monday in Madrid, skips a holiday, moves one
week to 11:00 and reminds everyone five minutes before. [JSCalendar](https://www.rfc-editor.org/rfc/rfc8984)
is that whole event as one JSON object: the iCalendar model as data you store in a column and
accept in an API body. This guide keeps a team agenda as JSCalendar events and tasks, serves it
as JSON, expands its recurrences, lets a client edit an entry with a PatchObject, and converts
it to and from iCalendar with [`@sdxc/jscalendar`](/api/jscalendar) and
[`@sdxc/icalendar`](/api/icalendar).

```bash
npm add @sdxc/http @sdxc/icalendar @sdxc/jscalendar @sdxc/result @sdxc/validate remix
```

## Declare the agenda's routes

The agenda takes entries and edits as JSON, serves the collection as JSCalendar and as an
iCalendar feed, and accepts an uploaded `.ics` file:

```typescript {% title="routes/web.ts" %}
import { get, patch, post, route } from "remix/routes";

export default route({
	agenda: {
		show: get("/agenda"),
		json: get("/agenda.json"),
		feed: get("/agenda.ics"),
		create: post("/agenda/entries"),
		update: patch("/agenda/entries/:uid"),
		import: post("/agenda/import"),
	},
});
```

## Accept an event or a task

`parse` reads JSON text as an Event, a Task or a Group, discriminated by `@type`, and checks
every value format and the rules that span properties:

```typescript {% title="app/http/controllers/agenda/create.ts" %}
import { created, unprocessableEntity } from "@sdxc/http/response/json";
import { parse } from "@sdxc/jscalendar";
import { toICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { Entries } from "~/app/models/entries";
import routes from "~/routes/web";

export default createAction(routes.agenda.create, async (ctx) => {
	let parsed = parse(await ctx.request.text());
	if (isFailure(parsed))
		return unprocessableEntity({ issues: parsed.error.issues });

	let entry = parsed.data;
	if (entry["@type"] === "Group") {
		return unprocessableEntity({ error: "Send one Event or Task at a time." });
	}

	let convertible = toICalendar(entry);
	if (isFailure(convertible))
		return unprocessableEntity({ error: convertible.error.message });

	await Entries.save(ctx.db, entry);
	return created({ uid: entry.uid });
});
```

A failure carries `issues`, each a `path` and a `message`.

> [!WARNING]
> The iCalendar feed converts every entry at once, and one that iCalendar cannot express, such as
> a rule with a non-Gregorian `rscale`, fails the whole conversion. Checking `toICalendar` on write
> keeps such an entry out, so the feed always converts.

`Entries` is your own model. Store `stringify(entry)` from `@sdxc/jscalendar` in a text column
keyed by `uid` and read it back through `parse`, so a row is the same object that came in.

## Serve the agenda as JSCalendar

A collection is a Group whose `entries` are the events and tasks. `jscalendarResponse` writes
it with the `application/jscalendar+json; type=group` content type RFC 8984 requires:

```typescript {% title="app/http/controllers/agenda/json.ts" %}
import type { JSCalendar } from "@sdxc/jscalendar";

import { jscalendarResponse } from "@sdxc/jscalendar";
import { createAction } from "remix/router";

import { Entries } from "~/app/models/entries";
import routes from "~/routes/web";

export default createAction(routes.agenda.json, async (ctx) => {
	let group: JSCalendar.Group = {
		"@type": "Group",
		uid: "agenda@example.com",
		title: "Team agenda",
		entries: await Entries.all(ctx.db),
	};
	return jscalendarResponse(group);
});
```

## Expand recurrences into an agenda

A page shows occurrences, not rules. `occurrences` from `@sdxc/jscalendar/recurrence` expands
an event or task over a window, applying its overrides. Merge every entry's occurrences and sort
them:

```typescript {% title="app/services/agenda/upcoming.ts" %}
import type { JSCalendar } from "@sdxc/jscalendar";
import type { Occurrence } from "@sdxc/jscalendar/recurrence";

import { occurrences } from "@sdxc/jscalendar/recurrence";
import { isFailure, success } from "@sdxc/result";

const LOOKAHEAD_MS = 14 * 86_400_000;

export function upcoming(entries: JSCalendar.Entry[], now: number, timeZone: string) {
	let all: Occurrence[] = [];
	for (let entry of entries) {
		let range = { from: now, to: now + LOOKAHEAD_MS, timeZone };
		let expanded = occurrences(entry, range);
		if (isFailure(expanded)) return expanded;
		all.push(...expanded.data);
	}
	return success(all.sort((a, b) => a.start - b.start));
}
```

Each occurrence is `{ recurrenceId, start, end, object }`, with `start` and `end` in epoch
milliseconds and `object` the instance with its override applied. `timeZone` is the zone an
entry without its own is read in: pass the viewer's.

> [!NOTE]
> One call returns at most `limit` occurrences, `1_000` by default, earliest first. A rule with an
> `rscale` other than Gregorian, a leap month, or a `skip` other than `omit` fails with a
> `RecurrenceError` rather than producing the wrong dates.

## Edit an entry with a PatchObject

JSCalendar edits are PatchObjects: keys are JSON Pointers without the leading `/`, a value sets
the property and `null` removes it. `applyPatch` applies one to a copy, all or nothing, and
`parse` checks the result is still a valid object:

```typescript {% title="app/services/agenda/edit.ts" %}
import type { JSCalendar, JSCalendarParseError, PatchError } from "@sdxc/jscalendar";
import type { Result } from "@sdxc/result";

import { applyPatch, parse } from "@sdxc/jscalendar";
import { isFailure } from "@sdxc/result";

export function editEntry(
	entry: JSCalendar.Entry,
	patch: JSCalendar.PatchObject,
): Result<JSCalendar.CalendarObject, PatchError | JSCalendarParseError> {
	let patched = applyPatch(entry, patch);
	if (isFailure(patched)) return patched;
	return parse(patched.data);
}
```

```typescript {% title="app/http/controllers/agenda/update.ts" %}
import { notFound, unprocessableEntity } from "@sdxc/http/response/json";
import { jscalendarResponse } from "@sdxc/jscalendar";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { Entries } from "~/app/models/entries";
import { editEntry } from "~/app/services/agenda/edit";
import routes from "~/routes/web";

const PATCH = s.record(s.string(), s.any());

export default createAction(routes.agenda.update, async (ctx) => {
	let { uid } = s.parse(s.object({ uid: s.string() }), ctx.params);
	let entry = await Entries.find(ctx.db, uid);
	if (entry === null) return notFound({ error: "No such entry." });

	let patch = await validate(ctx.request, PATCH);
	if (isFailure(patch)) return unprocessableEntity({ issues: patch.error.issues });

	let edited = editEntry(entry, patch.data);
	if (isFailure(edited))
		return unprocessableEntity({ error: edited.error.message });
	if (edited.data["@type"] === "Group") {
		return unprocessableEntity({ error: "An entry stays an Event or a Task." });
	}

	await Entries.save(ctx.db, edited.data);
	return jscalendarResponse(edited.data);
});
```

A single occurrence is edited through `recurrenceOverrides`, keyed by the `recurrenceId` the
expansion reported. `{ "recurrenceOverrides/2026-03-30T09:30:00": { "excluded": true } }`
cancels that Monday, and `{ "start": "2026-03-30T11:00:00" }` in its place moves it.

> [!NOTE]
> A pointer must land in an existing parent, so for an event's first override send the map whole:
> `{ "recurrenceOverrides": { "2026-03-30T09:30:00": { "excluded": true } } }`.

## Publish and import iCalendar

Calendar apps subscribe to iCalendar, so the same agenda goes out as a feed. `toICalendar`
turns a Group, Event or Task into `@sdxc/icalendar`'s model, time zones and overrides included:

```typescript {% title="app/http/controllers/agenda/feed.ts" %}
import { internalServerError } from "@sdxc/http/response/html";
import { calendarResponse } from "@sdxc/icalendar";
import { toICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { Entries } from "~/app/models/entries";
import routes from "~/routes/web";

export default createAction(routes.agenda.feed, async (ctx) => {
	let calendar = toICalendar(
		{
			"@type": "Group",
			uid: "agenda@example.com",
			title: "Team agenda",
			entries: await Entries.all(ctx.db),
		},
		{ productId: "-//example//agenda//EN" },
	);
	if (isFailure(calendar)) return internalServerError(calendar.error.message);

	return calendarResponse(calendar.data);
});
```

Importing runs the other way. `fromICalendar` reads a parsed calendar into a Group: each
`VEVENT` an Event, each `VTODO` a Task, with its overrides folded back in:

```typescript {% title="app/http/controllers/agenda/import.ts" %}
import { redirect } from "@sdxc/http/response";
import { badRequest } from "@sdxc/http/response/html";
import { parse } from "@sdxc/icalendar";
import { fromICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { Entries } from "~/app/models/entries";
import routes from "~/routes/web";

export default createAction(routes.agenda.import, async (ctx) => {
	let file = ctx.formData.get("calendar");
	if (!(file instanceof File)) return badRequest("Choose an .ics file to import.");

	let parsed = parse(await file.text());
	if (isFailure(parsed)) return badRequest(parsed.error.message);

	let group = fromICalendar(parsed.data.calendar);
	for (let entry of group.entries) await Entries.save(ctx.db, entry);

	return redirect(routes.agenda.show.href(), { status: redirect.Status.SeeOther });
});
```

An iCalendar property with no JSCalendar counterpart is kept and written back by `toICalendar`,
so an import followed by a feed loses nothing. Save by `uid`, and a second import updates rows
instead of duplicating them.

## Test the agenda

Test `upcoming` across a daylight saving change: Madrid moves its clocks on 29 March 2026, so
the 09:30 standup starts at 08:30 UTC before it and 07:30 after. A second test checks a moved
occurrence survives a trip through iCalendar:

```typescript {% title="app/services/agenda/upcoming.test.ts" %}
import type { JSCalendar } from "@sdxc/jscalendar";

import { parse as parseICalendar, stringify } from "@sdxc/icalendar";
import { fromICalendar, toICalendar } from "@sdxc/jscalendar/icalendar";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { upcoming } from "~/app/services/agenda/upcoming";

const STANDUP: JSCalendar.Event = {
	"@type": "Event",
	uid: "standup@example.com",
	title: "Standup",
	start: "2026-03-23T09:30:00",
	timeZone: "Europe/Madrid",
	duration: "PT15M",
	recurrenceRules: [{ frequency: "weekly", byDay: [{ day: "mo" }] }],
};

test("keeps 09:30 Madrid time across the daylight saving change", () => {
	let found = unwrap(upcoming([STANDUP], Date.UTC(2026, 2, 22), "UTC"));

	expect(found.map((occurrence) => occurrence.start)).toEqual([
		Date.UTC(2026, 2, 23, 8, 30),
		Date.UTC(2026, 2, 30, 7, 30),
	]);
});

test("moves one occurrence and keeps the move through iCalendar", () => {
	let moved: JSCalendar.Event = {
		...STANDUP,
		recurrenceOverrides: {
			"2026-03-30T09:30:00": { start: "2026-03-30T11:00:00" },
		},
	};
	let ics = stringify(unwrap(toICalendar(moved)));
	let [back] = fromICalendar(unwrap(parseICalendar(ics)).calendar).entries;

	expect(back?.recurrenceOverrides).toEqual(moved.recurrenceOverrides);
	let [, second] = unwrap(upcoming([moved], Date.UTC(2026, 2, 22), "UTC"));
	expect(second?.start).toBe(Date.UTC(2026, 2, 30, 9));
});
```

## Where to go next

- [Publish calendar feeds](/docs/content-and-feeds/calendar-feeds): the iCalendar side in
  depth, with subscriptions and time zone blocks.
- [JMAP](/docs/data-and-background-work/jmap): the protocol that carries these objects
  between a calendar server and its clients.
- [`@sdxc/jscalendar`](/api/jscalendar): every value format, the conversion options and the
  standards it follows.
