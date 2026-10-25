# @sdxc/jscalendar

Read, validate and write RFC 8984 JSCalendar events, tasks and groups, expand their recurrences, and convert them to and from iCalendar.

[JSCalendar](https://www.rfc-editor.org/rfc/rfc8984) is the JSON counterpart of iCalendar: the
same events, rules and alarms, as plain objects. The model is the JSON itself, so a parsed object
serializes back unchanged, and properties the model does not name (vendor extensions included)
are kept.

| Import                        | What it holds                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `@sdxc/jscalendar`            | parse and stringify, PatchObjects, value formats, the response helper                             |
| `@sdxc/jscalendar/recurrence` | expansion of recurrence rules and overrides into occurrences                                      |
| `@sdxc/jscalendar/icalendar`  | conversion to and from [`@sdxc/icalendar`](https://www.npmjs.com/package/@sdxc/icalendar)'s model |

## Installation

```sh
npm add @sdxc/jscalendar remix
```

Validation runs on `remix/data-schema`, and fallible functions return a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside.

## Usage

### Read and validate

```typescript
import { parse } from "@sdxc/jscalendar";
import { isFailure } from "@sdxc/result";

let parsed = parse(await request.text());
if (isFailure(parsed)) throw parsed.error; // JSCalendarParseError, with .issues and their paths

let object = parsed.data; // Event | Task | Group, discriminated by "@type"
```

`parse` also takes an already-parsed value. The schemas are exported (`EVENT_SCHEMA`,
`TASK_SCHEMA`, `GROUP_SCHEMA`, `OBJECT_SCHEMA`) for `remix/data-schema` or `@sdxc/validate`.

### Serve a feed

```typescript
import type { JSCalendar } from "@sdxc/jscalendar";

import { jscalendarResponse } from "@sdxc/jscalendar";

let group: JSCalendar.Group = {
	"@type": "Group",
	uid: "maintenance@status.example.com",
	title: "Maintenance windows",
	entries: [
		{
			"@type": "Event",
			uid: "42@status.example.com",
			title: "Database upgrade",
			start: "2026-09-23T10:00:00",
			timeZone: "Etc/UTC",
			duration: "PT2H",
		},
	],
};

return jscalendarResponse(group); // Content-Type: application/jscalendar+json; type=group
```

### Expand a recurrence

```typescript
import { occurrences } from "@sdxc/jscalendar/recurrence";
import { unwrap } from "@sdxc/result";

let now = Date.now();
for (let { recurrenceId, start, end, object } of unwrap(
	occurrences(event, { from: now, to: now + 30 * 86_400_000 }),
)) {
	// object is the instance: its override applied, recurrenceId set
}
```

### Convert from and to iCalendar

```typescript
import { parse as parseICalendar, stringify } from "@sdxc/icalendar";
import { fromICalendar, toICalendar } from "@sdxc/jscalendar/icalendar";
import { unwrap } from "@sdxc/result";

let group = fromICalendar(unwrap(parseICalendar(icsText)).calendar);
let icsAgain = stringify(unwrap(toICalendar(group)));
```

## API

### `@sdxc/jscalendar`

#### `parse(source: unknown): Result<JSCalendar.CalendarObject, JSCalendarParseError>`

Reads JSON text (or validates an already-parsed value) as an Event, Task or Group. It checks the
value formats, Id keys, nested `@type`s and the cross-property MUSTs: `count` beside `until`,
`recurrenceId` beside `recurrenceRules`, a recurring task without `start` or `due`.

#### `stringify(object: JSCalendar.CalendarObject, space?: number | string): string`

The object as JSON.

#### `jscalendarResponse(object, init?: ResponseInit): Response`, `contentType(object): string`

A response with `application/jscalendar+json; type=event|task|group`, the parameter RFC 8984
requires; headers in `init` win.

#### `applyPatch<T>(object: T, patch: JSCalendar.PatchObject): Result<T, PatchError>`

Applies a PatchObject to a copy: `null` removes, any other value sets. A pointer into a missing
parent, overlapping pointers, or adding or removing an array member fails the whole patch.

#### `parseDuration`, `formatDuration`, `parseLocalDateTime`, `formatLocalDateTime`, `parseUTCDateTime`, `formatUTCDateTime`, `isId`

The value formats: durations as `{ negative?, weeks?, days?, hours?, minutes?, seconds? }`,
date-times as wall-clock fields or epoch milliseconds, always written in their single
representation.

#### `MEDIA_TYPE`

`"application/jscalendar+json"`.

#### `JSCalendarParseError`, `PatchError`

The failures of `parse` (with `issues`, each a `path` and `message`) and `applyPatch` (with the
failing `pointer`).

### `@sdxc/jscalendar/recurrence`

#### `occurrences(object: Event | Task, options): Result<Occurrence[], RecurrenceError>`

The occurrences overlapping `[from, to)`, earliest first, each `{ recurrenceId?, start, end,
object }`. The union of `recurrenceRules`, minus what `excludedRecurrenceRules` generate, then
`recurrenceOverrides` add, exclude and patch instances. Nominal days keep their wall-clock time
across DST. An object without recurrence occurs once, as itself.

- `options.from`, `options.to`: epoch milliseconds
- `options.limit`: the most occurrences returned, `1_000` by default
- `options.timeZone`: the zone floating objects are read in, `"UTC"` by default

A rule with an `rscale` other than Gregorian, a leap month, or `skip` other than `omit` fails.

### `@sdxc/jscalendar/icalendar`

#### `fromICalendar(calendar: ICalendar.Calendar, options?: { uid?: string }): JSCalendar.Group`

Each `VEVENT` becomes an Event and each `VTODO` a Task; a recurrence override folds into its main
event as the patch that produces it. Map keys are the mapping draft's UUIDv5s (or a `JSID`
parameter), so converting the same calendar twice yields the same keys. What has no JSCalendar
property is kept in the object's `iCalendar` property and written back by `toICalendar`. The
group's `uid` comes from the calendar's `UID`, `options.uid`, or a UUIDv5 of its URL.

#### `toICalendar(object, options?: { productId?: string; now?: Date }): Result<ICalendar.Calendar, ConversionError>`

A Group, Event or Task as a calendar, with a `VTIMEZONE` for every `TZID` it uses. Overrides become
`RDATE`, `EXDATE` and `RECURRENCE-ID` components; `now` is the `DTSTAMP` of objects without
`updated`.

#### `eventFromICalendar(event, calendar)`, `taskFromICalendar(component, calendar)`

One component at a time, without folding overrides.

### Types

`JSCalendar` is a namespace of the model: `CalendarObject`, `Event`, `Task`, `Group`, `Entry`,
`Location`, `VirtualLocation`, `Link`, `Relation`, `Participant`, `Alert` with its triggers,
`RecurrenceRule`, `NDay`, `PatchObject`, and the mapping's `ICalComponent` and `ICalProperty`.

## Standards

The wire format is RFC 8984 (JSCalendar version 1.0), with its verified errata. Of the
[jscalendarbis](https://datatracker.ietf.org/doc/draft-ietf-calext-jscalendarbis/) draft (-22),
this package follows what reads RFC 8984 data the same way:

- nested objects may omit `@type` (a present one must still match);
- `roles` on a Participant is optional, and an unknown `privacy` value is kept and treated as
  `"private"`;
- a PatchObject may replace an existing array member;
- conversion never writes fractional seconds, which iCalendar cannot carry.

It does not yet write the 2.0 changes to the wire format: `recurrenceRule` (singular),
`organizerCalendarAddress`, `calendarAddress`, `endTimeZone`, `mainLocationId` and `version`. A
document carrying them reads fine, and the properties are kept as written. Custom `timeZones`,
which the draft obsoletes, are kept but not interpreted.

The iCalendar conversion follows
[draft-ietf-calext-jscalendar-icalendar](https://datatracker.ietf.org/doc/draft-ietf-calext-jscalendar-icalendar/)
(-28) in RFC 8984's properties: `ORGANIZER` is `replyTo` plus an owner Participant, `ATTENDEE` a
Participant with `sendTo`, and a `DTEND` in another zone a Location with `relativeTo: "end"`.

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
		"@sdxc/jscalendar": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
