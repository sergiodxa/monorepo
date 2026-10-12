# @sdxc/icalendar

Read and write iCalendar documents, with recurrence rules and time zones.

[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) iCalendar is the format every calendar client
subscribes to and imports. Events, alarms and time zones are typed; every other component and
property (`VTODO`, `VJOURNAL`, `X-` properties) is kept verbatim, so a calendar read and written
back loses nothing. The reader is lenient: structural errors fail with their line, while a missing
`UID` or an unreadable value becomes a warning and the property is kept as written. The writer
folds lines at 75 octets, escapes TEXT and parameters, and always writes `VERSION:2.0`.

| Import                     | What it holds                                                       |
| -------------------------- | ------------------------------------------------------------------- |
| `@sdxc/icalendar`          | parse and stringify, date helpers, the `text/calendar` response     |
| `@sdxc/icalendar/rrule`    | `RRULE` parse and stringify, and expansion into occurrences         |
| `@sdxc/icalendar/timezone` | a `VTIMEZONE` built from `Intl` for any IANA zone                   |
| `@sdxc/icalendar/itip`     | [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546) invites, replies |

## Installation

```sh
npm add @sdxc/icalendar
```

Fallible functions return a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result);
it installs alongside this package.

## Usage

### Serve a feed

A calendar of UTC date-times needs no `VTIMEZONE`. `utc()` turns an instant into one.

```typescript
import { calendarResponse, utc } from "@sdxc/icalendar";

export function feed(): Response {
	return calendarResponse({
		productId: "-//example//status//EN",
		name: "Maintenance windows",
		refreshInterval: { hours: 1 },
		timeZones: [],
		events: [
			{
				uid: "42@status.example.com",
				dtstamp: new Date(),
				start: utc(Date.UTC(2026, 8, 23, 10)),
				end: utc(Date.UTC(2026, 8, 23, 12)),
				summary: "Database upgrade",
				sequence: 1,
				properties: [],
			},
		],
		components: [],
		properties: [],
	});
}
```

The response is `text/calendar; charset=utf-8`, and `name` and `refreshInterval` are also written
as `X-WR-CALNAME` and `X-PUBLISHED-TTL` for clients that read only those. Use `stringify(calendar)`
for the text alone.

### Read a calendar

```typescript
import { parse, toInstant } from "@sdxc/icalendar";
import { isFailure } from "@sdxc/result";

let parsed = parse(await response.text());
if (isFailure(parsed)) throw parsed.error; // ICalendarParseError, with .line

let { calendar, warnings } = parsed.data;
for (let event of calendar.events) {
	let start = toInstant(event.start, calendar); // epoch ms, or null for a DATE or floating time
}
```

### Expand a recurrence

```typescript
import { occurrences } from "@sdxc/icalendar/rrule";
import { unwrap } from "@sdxc/result";

let now = Date.now();
let upcoming = unwrap(occurrences(event, { from: now, to: now + 30 * 86_400_000, calendar }));
// [{ start, end }, ...] in epoch ms, earliest first
```

Passing `calendar` resolves the event's `TZID`s through its `VTIMEZONE`s before `Intl`.

### Write a zoned recurring event

A rule that follows a zone's wall clock needs a `TZID` and its `VTIMEZONE`, or it drifts by an hour
across DST. `vtimezone()` builds one covering the dates the calendar writes.

```typescript
import { stringify } from "@sdxc/icalendar";
import { vtimezone } from "@sdxc/icalendar/timezone";
import { unwrap } from "@sdxc/result";

let zone = unwrap(
	vtimezone("Europe/Madrid", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2028, 0, 1) }),
);

let text = stringify({
	productId: "-//example//team//EN",
	timeZones: [zone],
	events: [
		{
			uid: "standup@example.com",
			dtstamp: new Date(),
			start: {
				type: "date-time",
				wall: { year: 2026, month: 1, day: 5, hour: 9, minute: 30, second: 0 },
				zone: { tzid: "Europe/Madrid" },
			},
			duration: { minutes: 15 },
			recurrence: { frequency: "WEEKLY", byDay: [{ weekday: "MO" }, { weekday: "WE" }] },
			alarms: [{ action: "DISPLAY", trigger: { before: { minutes: 5 } }, description: "Standup" }],
			properties: [],
		},
	],
	components: [],
	properties: [],
});
```

## API

### `@sdxc/icalendar`

#### `parse(source: string): Result<ICalendar.Parsed, ICalendarParseError>`

Reads the first `VCALENDAR` into a typed `calendar` and its `warnings`, each prefixed with its line.
`VEVENT`s with a readable `DTSTART` land in `events`, readable `VTIMEZONE`s in `timeZones`, every
other component in `components`, and properties the model does not name (or whose value does not
parse) in the owner's `properties`.

#### `parseAll(source: string): Result<ICalendar.Parsed[], ICalendarParseError>`

Every `VCALENDAR` in the text, for files that concatenate several.

#### `stringify(calendar: ICalendar.Calendar): string`

The calendar as CRLF lines. Every `TZID` a date-time uses needs its `VTIMEZONE` in `timeZones`; an
event with both `end` and `duration` writes `DTEND`.

#### `toInstant(value: ICalendar.DateValue, calendar?: ICalendar.Calendar): number | null`

The epoch milliseconds a `DATE-TIME` names. A `TZID` resolves through the calendar's `VTIMEZONE`
first and `Intl` second; a `DATE`, a floating time or an unresolvable `TZID` gives `null`.

#### `utc(instant: number | Date): ICalendar.DateValue`

A UTC `DATE-TIME`, truncated to whole seconds.

#### `calendarResponse(calendar: ICalendar.Calendar, init?: ResponseInit & { filename?: string }): Response`

A `text/calendar; charset=utf-8` response, with `; method=…` when `calendar.method` is set.
`filename` makes it an attachment download. Headers in `init` win.

#### `escapeText(text: string): string`, `unescapeText(value: string): string`

TEXT escaping (`\\`, `\;`, `\,`, `\n`), for untyped `Property` values, which are stored as written.

#### `MEDIA_TYPE`

`"text/calendar"`.

#### `ICalendarParseError`

A structural failure (an unmatched `BEGIN`/`END`, a line without `:`, no `VCALENDAR`), with the
1-based `line` it starts on.

### `@sdxc/icalendar/rrule`

#### `parseRecurrence(value: string): Result<ICalendar.RecurrenceRule, RecurrenceRuleError>`

Reads an `RRULE` value, case-insensitively. An unknown or repeated part, an out-of-range number, or
`COUNT` beside `UNTIL` fails.

#### `stringifyRecurrence(rule: ICalendar.RecurrenceRule): string`

The `RRULE` value for a rule.

#### `occurrences(event: ICalendar.Event, options: OccurrenceOptions): Result<Occurrence[], RecurrenceRuleError>`

The occurrences overlapping `[from, to)`, earliest first: `DTSTART`, the rule's instances and the
`RDATE`s, minus every `EXDATE`. Each lasts as long as the event: `DTEND` gives an exact length,
`DURATION` a nominal one (a day across DST keeps its local time), and an all-day event one day. It
fails for a `TZID` nothing resolves or a rule with out-of-range parts.

- `options.from`: epoch ms, inclusive; occurrences still running then are included
- `options.to`: epoch ms, exclusive
- `options.limit`: the most occurrences returned, `1_000` by default
- `options.calendar`: resolves `TZID`s through its `VTIMEZONE`s before `Intl`
- `options.timeZone`: the IANA zone floating times and `DATE`s are read in, `"UTC"` by default

#### `RecurrenceRuleError`

An `RRULE` that does not parse, carries out-of-range parts, or cannot be expanded.

### `@sdxc/icalendar/timezone`

#### `vtimezone(tzid: string, span: { from: number; to: number }): Result<ICalendar.TimeZone, TimeZoneError>`

A `VTIMEZONE` for an IANA zone: the observance in force when the span starts, then one per offset
change until it ends. Past the span the last offset holds, so the span should cover every date-time
the calendar writes in that zone.

#### `TimeZoneError`

A zone `Intl` does not know, or a span that ends before it starts.

### `@sdxc/icalendar/itip`

Each builder returns a calendar with its `METHOD` set, ready for `stringify` or `calendarPart`, or an
`ITipError` naming the constraint the event breaks.

#### `request(event: ICalendar.Event, options: ITip.Options): Result<ICalendar.Calendar, ITipError>`

`METHOD:REQUEST`, inviting the attendees or sending a revision. The event needs a `UID`, an
`organizer` and at least one attendee. Attendees without `participation` or `rsvp` are asked to
reply; `SEQUENCE` is sent as given, so derive it with `nextSequence`.

#### `cancel(event: ICalendar.Event, options: ITip.CancelOptions): Result<ICalendar.Calendar, ITipError>`

`METHOD:CANCEL`, with `SEQUENCE` one past the event's. Without `options.attendees` it cancels the
event for everyone; with them it uninvites just those addresses.

#### `reply(event: ICalendar.Event, options: ITip.ReplyOptions): Result<ICalendar.Calendar, ITipError>`

`METHOD:REPLY` from `options.attendee` with `options.participation` (and an optional `comment`),
echoing the request's `UID`, `SEQUENCE` and `RECURRENCE-ID`.

#### `readReply(source: string | ICalendar.Calendar): Result<ITip.Reply[], ITipError>`

One entry per `VEVENT` of a `METHOD:REPLY`, so a reply to several instances lists each with its
`recurrenceId`. Another method, or a `VEVENT` without a `UID` or exactly one `ATTENDEE`, fails.

#### `nextSequence(previous: ICalendar.Event, next: ICalendar.Event): number`

One more than `previous.sequence` when the start, end, duration, recurrence, `RDATE`, `EXDATE` or
status changed, the same otherwise.

#### `calendarPart(calendar: ICalendar.Calendar, options?: { filename?: string }): ITip.CalendarPart`

`{ method, content, filename? }`: the calendar's method (`PUBLISH` when unset) and its text, the
shape [`@sdxc/mail`](https://www.npmjs.com/package/@sdxc/mail)'s `calendar` option takes.

#### `ITipError`

An event that cannot carry the method asked of it, or a message that is not a `REPLY`.

### Types

#### `ICalendar`

A namespace of the model's types, exported from `@sdxc/icalendar`:

- `Calendar`: `productId`, `method?`, `name?`, `description?`, `url?`, `refreshInterval?`,
  `timeZones`, `events`, `components`, `properties`
- `Event`: `uid`, `dtstamp`, `start`, `end?` or `duration?`, `summary?`, `description?`,
  `location?`, `url?`, `status?`, `transparency?`, `sequence?`, `created?`, `lastModified?`,
  `categories?`, `recurrence?`, `recurrenceDates?`, `exceptionDates?`, `recurrenceId?`,
  `organizer?`, `attendees?`, `alarms?`, `properties`
- `DateValue`: `{ type: "date", year, month, day }` or `{ type: "date-time", wall, zone }`, where
  `zone` is `"utc"`, `"floating"` or `{ tzid }`; `WallClock` holds the `wall` fields
- `Period`: `{ type: "period", start, end?, duration? }`, an `RDATE` with its own length
- `Duration`: `negative?`, `weeks?`, `days?` (nominal), `hours?`, `minutes?`, `seconds?` (exact)
- `RecurrenceRule`: `frequency`, `interval?`, `count?` or `until?`, `bySecond?` through
  `bySetPosition?`, `weekStart?`; `Weekday` is `"MO"` through `"SU"`
- `Alarm`: `action`, `trigger` (`{ before, related? }` or `{ at }`), `description?`, `summary?`,
  `attendees?`, `repeat?`, `properties?`; `before: { minutes: 15 }` fires 15 minutes early
- `CalendarUser`, `Attendee`: `address` (a `mailto:` URI), `name?`, `parameters?`; an attendee adds
  `role?`, `participation?`, `rsvp?`
- `TimeZone`, `Observance`: `tzid` and its observances, each with `kind`, local `start`,
  `offsetFrom`/`offsetTo` in minutes, `name?`, `recurrence?`, `recurrenceDates?`
- `Component`, `Property`: the generic layer, `{ name, properties, components }` and
  `{ name, parameters, value }` with the value as written
- `Parsed`: `{ calendar, warnings }`

#### `OccurrenceOptions`, `Occurrence`

The options of `occurrences()` and each `{ start, end }` it returns, from `@sdxc/icalendar/rrule`.

#### `ITip`

From `@sdxc/icalendar/itip`: `Options` (`productId`, `dtstamp?`, `timeZones?`), `CancelOptions`
(adds `attendees?`), `ReplyOptions` (adds `attendee`, `participation`, `comment?`), `Reply`
(`uid`, `sequence`, `dtstamp`, `recurrenceId?`, `organizer?`, `attendee`) and `CalendarPart`.

## Pattern: Invite, Reschedule and Cancel by Mail

Each message is a `request` or `cancel` sent as a calendar part; the recipient's client matches
them by `UID` and keeps the highest `SEQUENCE`.

```typescript
import type { ICalendar } from "@sdxc/icalendar";

import { utc } from "@sdxc/icalendar";
import { calendarPart, cancel, nextSequence, request } from "@sdxc/icalendar/itip";
import { unwrap } from "@sdxc/result";

let productId = "-//example//meetings//EN";
let event: ICalendar.Event = {
	uid: "review-7@example.com",
	dtstamp: new Date(),
	start: utc(Date.UTC(2026, 9, 20, 15)),
	end: utc(Date.UTC(2026, 9, 20, 16)),
	summary: "Design review",
	sequence: 0,
	organizer: { address: "mailto:host@example.com", name: "Host" },
	attendees: [{ address: "mailto:guest@example.com", role: "REQ-PARTICIPANT" }],
	properties: [],
};

await mailer.send({
	to,
	subject,
	html,
	calendar: calendarPart(unwrap(request(event, { productId }))),
});

let moved = {
	...event,
	start: utc(Date.UTC(2026, 9, 21, 15)),
	end: utc(Date.UTC(2026, 9, 21, 16)),
};
moved.sequence = nextSequence(event, moved);
await mailer.send({
	to,
	subject,
	html,
	calendar: calendarPart(unwrap(request(moved, { productId }))),
});

await mailer.send({
	to,
	subject,
	html,
	calendar: calendarPart(unwrap(cancel(moved, { productId }))),
});
```

## Pattern: Answer an Invitation and Record the Answer

The attendee's side builds a `reply` from the event it received; the organizer's side reads it back.

```typescript
import { parse, stringify } from "@sdxc/icalendar";
import { readReply, reply } from "@sdxc/icalendar/itip";
import { isFailure, unwrap } from "@sdxc/result";

let [invitation] = unwrap(parse(await attachment.text())).calendar.events;
let answer = unwrap(
	reply(invitation, {
		productId: "-//example//client//EN",
		attendee: "mailto:guest@example.com",
		participation: "ACCEPTED",
		comment: "See you there",
	}),
);
let text = stringify(answer);

let replies = readReply(text);
if (isFailure(replies)) throw replies.error;
for (let { uid, sequence, attendee } of replies.data) {
	await saveAnswer(uid, attendee.address, attendee.participation, sequence);
}
```

A reply whose `sequence` is lower than the event's current one answers a revision the attendee has
since been sent again; compare the two before trusting it.

## Pattern: A Feed and a Single-Event Download

Both serve the same events with the same `UID`s, so a client holding the feed and the download shows
one event. A `SEQUENCE` that only grows makes clients replace their copy on every edit.

```typescript
import type { ICalendar } from "@sdxc/icalendar";

import { calendarResponse, utc } from "@sdxc/icalendar";

interface Window {
	id: string;
	name: string;
	startsAt: number;
	endsAt: number;
	createdAt: number;
	updatedAt: number;
}

function toEvent(window: Window): ICalendar.Event {
	return {
		uid: `${window.id}@status.example.com`,
		dtstamp: new Date(window.updatedAt),
		lastModified: new Date(window.updatedAt),
		sequence: Math.floor((window.updatedAt - window.createdAt) / 1000),
		start: utc(window.startsAt),
		end: utc(window.endsAt),
		summary: window.name,
		properties: [],
	};
}

function calendarOf(events: ICalendar.Event[]): ICalendar.Calendar {
	return {
		productId: "-//example//status//EN",
		timeZones: [],
		events,
		components: [],
		properties: [],
	};
}

export function feed(windows: Window[]): Response {
	return calendarResponse(calendarOf(windows.map(toEvent)));
}

export function download(window: Window): Response {
	return calendarResponse(calendarOf([toEvent(window)]), { filename: "maintenance.ics" });
}
```

## Pattern: The Last Day of Every Month

`BYMONTHDAY=31` skips short months; a set position over the candidate days picks each month's last.

```typescript
import type { ICalendar } from "@sdxc/icalendar";

import { occurrences, parseRecurrence, stringifyRecurrence } from "@sdxc/icalendar/rrule";
import { unwrap } from "@sdxc/result";

let rule: ICalendar.RecurrenceRule = {
	frequency: "MONTHLY",
	byMonthDay: [28, 29, 30, 31],
	bySetPosition: [-1],
};
stringifyRecurrence(rule); // "FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1"
unwrap(parseRecurrence("freq=monthly;bymonthday=-1")); // the same days, written as one negative day

let closing: ICalendar.Event = {
	uid: "close-books@example.com",
	dtstamp: new Date(),
	start: { type: "date", year: 2026, month: 1, day: 31 },
	recurrence: rule,
	properties: [],
};
let dates = unwrap(
	occurrences(closing, {
		from: Date.UTC(2026, 0, 1),
		to: Date.UTC(2027, 0, 1),
		timeZone: "America/New_York",
	}),
);
```

All-day dates are read in `timeZone`, so each occurrence runs from local midnight to the next.

## Pattern: Is Anything Active Now

A one-millisecond window with `limit: 1` answers whether any occurrence, recurring or not, is running.

```typescript
import type { ICalendar } from "@sdxc/icalendar";

import { occurrences } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";

function isActive(event: ICalendar.Event, calendar: ICalendar.Calendar, now = Date.now()): boolean {
	let result = occurrences(event, { from: now, to: now + 1, limit: 1, calendar });
	return isSuccess(result) && result.data.length > 0;
}
```

## Pattern: Edit a Calendar Without Losing What It Holds

Components and properties outside the typed model ride along in `components` and `properties`, so a
read, edit and write keeps them. Untyped values are stored as written; `unescapeText` reads them.

```typescript
import { escapeText, parse, stringify, unescapeText } from "@sdxc/icalendar";
import { unwrap } from "@sdxc/result";

let { calendar } = unwrap(parse(source));

let todos = calendar.components.filter((component) => component.name === "VTODO");
let timeZone = calendar.properties.find((property) => property.name === "X-WR-TIMEZONE");

calendar.properties.push({ name: "X-EXAMPLE-NOTE", parameters: {}, value: escapeText("a, b; c") });
calendar.events = calendar.events.map((event) => ({
	...event,
	sequence: (event.sequence ?? 0) + 1,
}));

let text = stringify(calendar); // VTODOs, X-WR-TIMEZONE and the note written back
let note = unescapeText(calendar.properties.at(-1)?.value ?? ""); // "a, b; c"
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/icalendar": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
