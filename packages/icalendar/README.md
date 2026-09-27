# @sdxc/icalendar

Read and write iCalendar documents, with recurrence rules and time zones.

## Overview

[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) iCalendar is the format every calendar client subscribes to and imports. This package reads and writes it with typed `VEVENT`, `VALARM` and `VTIMEZONE` components over a generic component and property layer, so `VTODO`, `VJOURNAL`, `VFREEBUSY` and `X-` properties survive a parse and stringify round trip untouched.

The reader is lenient and the writer strict. Structural errors (an unmatched `END`, a line with no `:`, no `VCALENDAR`) fail with the physical line they start on; a missing `UID` or `DTSTAMP`, or a value that does not parse, becomes a warning and the property is kept verbatim. The writer folds at 75 octets without splitting a UTF-8 character, escapes TEXT, quotes and caret-encodes parameters ([RFC 6868](https://www.rfc-editor.org/rfc/rfc6868)), and always writes `VERSION:2.0`.

Four entry points keep a writer-only consumer small:

| Import                     | What it holds                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------- |
| `@sdxc/icalendar`          | `parse`, `parseAll`, `stringify`, `toInstant`, `utc`, `calendarResponse`, the `ICalendar` types |
| `@sdxc/icalendar/rrule`    | `parseRecurrence`, `stringifyRecurrence`, `occurrences`                                         |
| `@sdxc/icalendar/timezone` | `vtimezone`, a `VTIMEZONE` built from `Intl`                                                    |
| `@sdxc/icalendar/itip`     | `request`, `cancel`, `reply`, `readReply`, `nextSequence`, `calendarPart` (RFC 5546)            |

Zone conversion comes from `@sdxc/dates/zone`, whose DST rule (a repeated hour resolves to its first instant, a skipped one is read with the offset before the gap) is the one RFC 5545 §3.3.5 prescribes.

## Usage

### Write a feed

UTC date-times need no `VTIMEZONE`, so a feed of one-off events is just events.

```ts
import { calendarResponse, utc } from "@sdxc/icalendar";

return calendarResponse({
	productId: "-//example//status//EN",
	name: "Example status: maintenance",
	url: "https://status.example.com/",
	refreshInterval: { hours: 1 },
	timeZones: [],
	events: [
		{
			uid: "42@status.example.com",
			dtstamp: new Date(row.updatedAt),
			start: utc(row.startsAt),
			end: utc(row.endsAt),
			summary: "Database upgrade",
			sequence: 3,
			properties: [],
		},
	],
	components: [],
	properties: [],
});
```

```text
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//example//status//EN
NAME:Example status: maintenance
X-WR-CALNAME:Example status: maintenance
URL:https://status.example.com/
REFRESH-INTERVAL;VALUE=DURATION:PT1H
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:42@status.example.com
DTSTAMP:20260920T081500Z
DTSTART:20260923T100000Z
DTEND:20260923T120000Z
SUMMARY:Database upgrade
SEQUENCE:3
END:VEVENT
END:VCALENDAR
```

### Read a calendar

```ts
import { parse, toInstant } from "@sdxc/icalendar";
import { isFailure } from "@sdxc/result";

let parsed = parse(await response.text());
if (isFailure(parsed)) return parsed; // ICalendarParseError with .line

let { calendar, warnings } = parsed.data;
for (let event of calendar.events) {
	let start = toInstant(event.start, calendar); // null for DATE or floating values
}
```

### Expand a recurrence

```ts
import { occurrences } from "@sdxc/icalendar/rrule";

let result = occurrences(event, {
	from: Date.now(),
	to: Date.now() + 30 * 86_400_000,
	calendar, // resolves TZIDs through its VTIMEZONEs
});
// { status: "success", data: [{ start, end }, ...] }
```

### Write a zoned recurring event

A rule whose wall clock follows a zone needs `TZID` plus a `VTIMEZONE`, or it drifts by an hour across DST.

```ts
import { stringify } from "@sdxc/icalendar";
import { vtimezone } from "@sdxc/icalendar/timezone";
import { unwrap } from "@sdxc/result";

let zone = unwrap(
	vtimezone("Europe/Madrid", { from: Date.UTC(2026, 0, 1), to: Date.UTC(2028, 0, 1) }),
);

stringify({
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

Reads the first `VCALENDAR`. CRLF, LF and CR line endings are accepted and a byte order mark is skipped. Returns the typed `calendar` and `warnings`, each prefixed with its line (`"Line 2: VEVENT has no DTSTAMP"`).

What the reader types, and what it keeps verbatim:

| Input                                                                     | Result                                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `VEVENT` with a readable `DTSTART`                                        | `calendar.events`                                                      |
| `VEVENT` without one                                                      | `calendar.components`, with a warning unless `METHOD` lets it go¹      |
| `VTIMEZONE` with a `TZID` and readable observances                        | `calendar.timeZones`                                                   |
| any other component                                                       | `calendar.components`                                                  |
| a property the model does not name                                        | the owner's `properties`                                               |
| a known property whose value does not parse (`STATUS:MAYBE`)              | the owner's `properties`, with a warning                               |
| missing `UID` / `DTSTAMP`                                                 | `uid: ""` / an invalid `dtstamp`, with a warning; written back missing |
| `ATTENDEE`/`ORGANIZER` parameters beyond `CN`, `ROLE`, `PARTSTAT`, `RSVP` | the user's `parameters`                                                |
| `X-WR-CALNAME`, `X-WR-CALDESC`, `X-PUBLISHED-TTL`                         | `name`, `description`, `refreshInterval` when RFC 7986's are absent    |

¹ RFC 5546 lets a `REPLY`, `CANCEL`, `REFRESH` or `DECLINECOUNTER` identify its event by `UID` alone; `readReply` reads such an event from `components`.

Typed text properties keep only the parameters their field models; `SUMMARY;LANGUAGE=en` reads as its text.

#### `parseAll(source: string): Result<ICalendar.Parsed[], ICalendarParseError>`

Every `VCALENDAR` in the text, for files that concatenate several.

#### `stringify(calendar: ICalendar.Calendar): string`

CRLF lines folded at 75 octets, `VERSION` and `PRODID` first, then the RFC 7986 fields each followed by its `X-WR-`/`X-PUBLISHED-TTL` alias, the calendar's untyped properties, the time zones, the events and the untyped components. Every `TZID` a date-time uses needs its `VTIMEZONE` in `timeZones`. An event with both `end` and `duration` writes `DTEND`. `RDATE`/`EXDATE` values sharing their parameters share a line.

#### `toInstant(value: ICalendar.DateValue, calendar?: ICalendar.Calendar): number | null`

The instant a `DATE-TIME` names. A `TZID` resolves through the calendar's `VTIMEZONE` of that name first, expanding its observance rules, and through `Intl` second. A `DATE`, a floating time, or a `TZID` neither resolves gives `null`.

#### `utc(instant: number | Date): ICalendar.DateValue`

A UTC `DATE-TIME`, whole seconds.

#### `calendarResponse(calendar, init?: ResponseInit & { filename?: string }): Response`

`Content-Type: text/calendar; charset=utf-8`, plus `; method=REQUEST` (or whatever `calendar.method` is). `filename` adds `Content-Disposition: attachment`, with an RFC 8187 `filename*` for names outside ASCII. Headers in `init` are kept and win.

#### `escapeText(text: string): string`, `unescapeText(value: string): string`

TEXT escaping (`\\`, `\;`, `\,`, `\n`; `\N` accepted on read), for untyped `Property` values, which are stored as written.

#### `MEDIA_TYPE`

`"text/calendar"`.

#### `ICalendarParseError`

The structural failure, with the 1-based physical `line` it starts on.

#### `ICalendar` types

| Type                     | Shape                                                                                                                                                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Calendar`               | `productId`, `method?`, `name?`, `description?`, `url?`, `refreshInterval?`, `timeZones`, `events`, `components`, `properties`                                                                                                     |
| `Event`                  | `uid`, `dtstamp`, `start`, `end?` or `duration?`, text fields, `status?`, `transparency?`, `sequence?`, `recurrence?`, `recurrenceDates?`, `exceptionDates?`, `recurrenceId?`, `organizer?`, `attendees?`, `alarms?`, `properties` |
| `DateValue`              | `{ type: "date", year, month, day }` or `{ type: "date-time", wall, zone: "utc" \| "floating" \| { tzid } }`                                                                                                                       |
| `Period`                 | `{ type: "period", start, end?, duration? }`, an `RDATE;VALUE=PERIOD`                                                                                                                                                              |
| `Duration`               | `negative?`, `weeks?`, `days?` (nominal), `hours?`, `minutes?`, `seconds?` (exact)                                                                                                                                                 |
| `RecurrenceRule`         | `frequency`, `interval?`, `count?` or `until?`, `bySecond?` … `bySetPosition?`, `weekStart?`                                                                                                                                       |
| `Alarm`                  | `action`, `trigger: { before, related? } \| { at }`, `description?`, `summary?`, `attendees?`, `repeat?`, `properties?`                                                                                                            |
| `TimeZone`, `Observance` | `tzid`, observances with `kind`, local `start`, `offsetFrom`/`offsetTo` in minutes, `name?`, `recurrence?`, `recurrenceDates?`                                                                                                     |
| `Component`, `Property`  | the generic layer: `name`, `properties`, `components`; `name`, `parameters`, `value` as written                                                                                                                                    |

An alarm's `trigger.before` is the time before the start (or end): `{ minutes: 15 }` is written `TRIGGER:-PT15M`, and a `negative` one fires after.

### `@sdxc/icalendar/rrule`

#### `parseRecurrence(value: string): Result<ICalendar.RecurrenceRule, RecurrenceRuleError>`

Reads an `RRULE` value, case-insensitively. An unknown or repeated part, an out-of-range number, or `COUNT` beside `UNTIL` fails.

#### `stringifyRecurrence(rule: ICalendar.RecurrenceRule): string`

`FREQ`, `INTERVAL`, `COUNT`/`UNTIL`, `BYSECOND` through `BYSETPOS`, `WKST`.

#### `occurrences(event, options): Result<{ start: number; end: number }[], RecurrenceRuleError>`

The occurrences overlapping `[from, to)`, earliest first, at most `limit` (default 1,000): `DTSTART`, which RFC 5545 counts as the first instance, the rule's instances, and the `RDATE`s, minus every `EXDATE`. Each occurrence lasts as long as the event: a `DTEND` gives an exact length, a `DURATION` a nominal one (a day across DST keeps its local time), and neither gives a `DATE` one day.

| Option     | Meaning                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| `from`     | epoch ms, inclusive; occurrences still running then are included         |
| `to`       | epoch ms, exclusive                                                      |
| `limit`    | most occurrences returned, `1_000` by default                            |
| `calendar` | resolves `TZID`s through its `VTIMEZONE`s before `Intl`                  |
| `timeZone` | the IANA zone floating times and `DATE`s are read in, `"UTC"` by default |

Expansion jumps straight to the window for rules without `COUNT`, stops at `to`, `UNTIL`, `COUNT` or `limit`, and fails rather than walking more than 500,000 periods. It fails as well for a `TZID` nothing resolves and for a typed rule with out-of-range parts.

### `@sdxc/icalendar/timezone`

#### `vtimezone(tzid: string, span: { from: number; to: number }): Result<ICalendar.TimeZone, TimeZoneError>`

A `VTIMEZONE` for an IANA zone: the transition in force when the span starts, then one observance per offset change until it ends, each with an explicit onset and no rule. `DAYLIGHT` marks an offset above the year's standard one, in either hemisphere; names come from `Intl` (`EST`, `GMT+9`). Past the span the last observance's offset holds, so the span should cover every date-time the calendar writes in that zone.

### `@sdxc/icalendar/itip`

iTIP ([RFC 5546](https://www.rfc-editor.org/rfc/rfc5546)) scheduling messages for one event. Each builder returns a calendar with its `METHOD` set, ready for `stringify` or `calendarPart`, or an `ITipError` naming the constraint the event breaks.

#### `request(event, options: ITip.Options): Result<ICalendar.Calendar, ITipError>`

`METHOD:REQUEST`, inviting the attendees or sending them a revision. The event needs a `UID`, an `organizer` and at least one attendee, and cannot be `CANCELLED`. An attendee with neither `participation` nor `rsvp` gets `PARTSTAT=NEEDS-ACTION` and `RSVP=TRUE` (`FALSE` for a `NON-PARTICIPANT`); a missing `SUMMARY` is written empty, as the method requires. `SEQUENCE` is sent as given; derive it with `nextSequence`.

#### `cancel(event, options: ITip.CancelOptions): Result<ICalendar.Calendar, ITipError>`

`METHOD:CANCEL`, with `SEQUENCE` one past the event's. Without `options.attendees` it cancels the whole event for every attendee with `STATUS:CANCELLED`; with them it uninvites just those addresses (compared case-insensitively, `mailto:` optional) and writes no status. Attendees lose `PARTSTAT` and `RSVP`, and alarms are dropped.

#### `reply(event, options: ITip.ReplyOptions): Result<ICalendar.Calendar, ITipError>`

`METHOD:REPLY` from `options.attendee` with `options.participation`, echoing the request's `UID`, `SEQUENCE` and `RECURRENCE-ID` unchanged. The attendee keeps the name and parameters the request gave them; an address the request did not invite replies as itself. `options.comment` becomes `COMMENT`.

#### `readReply(source: string | ICalendar.Calendar): Result<ITip.Reply[], ITipError>`

One `{ uid, sequence, dtstamp, recurrenceId?, organizer?, attendee }` per `VEVENT` of a `METHOD:REPLY`, typed or without `DTSTART`. A missing `SEQUENCE` reads as `0`. Text that does not parse (the `ICalendarParseError` is the `cause`), another method, no `VEVENT`, or a `VEVENT` without exactly one `ATTENDEE` or without a `UID` fail.

#### `nextSequence(previous: ICalendar.Event, next: ICalendar.Event): number`

The §2.1.4 rule: one more than `previous.sequence` when `start`, `end`, `duration`, `recurrence`, `recurrenceDates`, `exceptionDates` or `status` changed by value, the same otherwise. A change the organizer judges significant too, like a new `location` far away, is theirs to bump.

#### `calendarPart(calendar, options?: { filename?: string }): ITip.CalendarPart`

`{ method, content, filename? }` for a mailer: the calendar's method (`PUBLISH` when unset) and its text. The shape is what `@sdxc/mail`'s `calendar` option takes, written as a `text/calendar; method=…` alternative part.

| Type                 | Shape                                                                   |
| -------------------- | ----------------------------------------------------------------------- |
| `ITip.Options`       | `productId`, `dtstamp?` (now by default), `timeZones?`                  |
| `ITip.CancelOptions` | `Options` plus `attendees?`, the addresses to uninvite                  |
| `ITip.ReplyOptions`  | `Options` plus `attendee`, `participation`, `comment?`                  |
| `ITip.Reply`         | `uid`, `sequence`, `dtstamp`, `recurrenceId?`, `organizer?`, `attendee` |
| `ITip.CalendarPart`  | `method`, `content`, `filename?`                                        |

## Patterns

### Pattern: invite, update, cancel by mail

```ts
import { utc } from "@sdxc/icalendar";
import { calendarPart, cancel, nextSequence, request } from "@sdxc/icalendar/itip";
import { unwrap } from "@sdxc/result";

let productId = "-//example//ops//EN";
let invitation = unwrap(request(event, { productId }));
await mailer.send({
	to,
	subject,
	html,
	calendar: calendarPart(invitation, { filename: "invite.ics" }),
});

let moved = { ...event, start: utc(newStart), end: utc(newEnd) };
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

The recipient's client matches the three messages by `UID`, and the higher `SEQUENCE` of the move and the cancellation replaces what it holds.

### Pattern: record an attendee's answer

```ts
import { readReply } from "@sdxc/icalendar/itip";
import { isFailure } from "@sdxc/result";

let replies = readReply(await attachment.text());
if (isFailure(replies)) return replies;
for (let { uid, sequence, attendee } of replies.data) {
	await saveAnswer(uid, attendee.address, attendee.participation, sequence);
}
```

A reply to an older `SEQUENCE` answers a revision the attendee has since been sent again; compare it with the current one before trusting it.

### Pattern: a status page's maintenance feed

```ts
import { calendarResponse, utc } from "@sdxc/icalendar";

let events = windows.map((window) => ({
	uid: `${window.id}@status`,
	dtstamp: new Date(window.updatedAt),
	lastModified: new Date(window.updatedAt),
	sequence: Math.floor((window.updatedAt - window.createdAt) / 1000),
	start: utc(window.startsAt),
	end: utc(window.endedEarlyAt ?? window.endsAt),
	summary: window.name,
	properties: [],
}));

return calendarResponse({
	productId: "-//example//status//EN",
	timeZones: [],
	events,
	components: [],
	properties: [],
});
```

A single-window download is the same calendar with one event and `{ filename: "maintenance.ics" }`.

### Pattern: "last day of the month" recurrences

`BYMONTHDAY=31` skips short months. The clamp is a set position over the candidate days:

```ts
let rule = { frequency: "MONTHLY", byMonthDay: [28, 29, 30, 31], bySetPosition: [-1] } as const;
```

### Pattern: is anything active now

```ts
import { occurrences } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";

let now = Date.now();
let result = occurrences(event, { from: now, to: now + 1, limit: 1 });
let active = isSuccess(result) && result.data.length > 0;
```

## Related Packages

- [`@sdxc/dates`](../dates/README.md) - the `./zone` subpath this package converts wall clocks with
- [`@sdxc/cron`](../cron/README.md) - cron expressions, a separate grammar with its own schedules
- [`@sdxc/result`](../result/README.md) - the `Result` every fallible function returns

## Tips

- Prefer UTC. A one-off event in UTC is exact and needs no `VTIMEZONE`; reach for `TZID` only when a recurrence must follow a zone's wall clock.
- Derive `SEQUENCE` from something that only grows, like seconds since creation of the last edit, so clients replace their copy on every change.
- Keep `UID`s stable across the feed and single-event downloads, so a client holding both shows one event.
- Read `warnings` when importing third-party feeds; they point at the properties that stayed untyped.
