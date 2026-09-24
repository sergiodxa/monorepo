# ADR-091: iCalendar Package

## Status

**Proposed** - 2026-09-23

## Background

[RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) iCalendar is the one calendar format every
calendar client reads: Apple Calendar, Google Calendar, Outlook and Thunderbird all subscribe to
an `.ics` URL and re-fetch it on a schedule, and all open a downloaded `.ics` file as an event to
add. [RFC 5546](https://www.rfc-editor.org/rfc/rfc5546) (iTIP) layers invitations on top, and
[RFC 7265](https://www.rfc-editor.org/rfc/rfc7265) (jCal) maps the same model to JSON.

`apps/uptime` schedules maintenance windows (one-off and recurring), marks each as shown or hidden
on status pages, and lets customers publish public status pages. The people who care about a
maintenance window are the status page's readers, and the place they plan around one is their
calendar, yet nothing in the repo writes an `.ics`. `@sdxc/cron` already computes zone-aware
occurrences for cron expressions and `@sdxc/dates` converts wall clocks to instants across DST,
so the zone math iCalendar needs exists; the format does not.

## Context

### What uptime has

| Concept            | Where                                                                                        | Shape                                                                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintenance window | `database/schema.ts` `maintenanceWindows`, `app/data/maintenance-window.ts` (199 lines)      | `name`, `starts_at`, `ends_at`, `ended_early_at`, `suppress_alerts`, `show_on_status_page`, scope (`monitor_type`/`monitor_id`, both `null` for every monitor) |
| Recurrence         | `recurring_pattern` text, `parseRecurringPattern`, `isRecurringPatternActive`                | `daily:HH:MM-HH:MM`, `weekly:<weekday>:HH:MM-HH:MM`, `monthly:<day>:HH:MM-HH:MM`, UTC wall clock                                                               |
| Status page        | `statusPages`, `app/data/status-page.ts`, `app/http/controllers/status-page.tsx` (466 lines) | `slug`, `title`, `custom_domain`, `is_public`, attached monitors per type                                                                                      |
| Maintenance API    | `app/http/controllers/api/maintenance.ts`, `api/maintenance-window.ts`                       | CRUD plus `end` under `/api/v1/maintenance`                                                                                                                    |
| Incidents          | none                                                                                         | `alert_events` records notification deliveries per alert channel, not incidents                                                                                |
| Cron job monitors  | `cronJobs` with `cron_expression`, `timezone`                                                | expected pings through `@sdxc/cron`                                                                                                                            |

Four findings shape the adoption:

| Finding                                                                                                        | Consequence                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `show_on_status_page` is stored and edited, but `status-page.tsx` never reads maintenance windows              | the calendar feed is the first consumer of the flag; the page itself should list them too             |
| `isActiveAt` treats a recurring row as its one-off `starts_at`..`ends_at` range **or** an unbounded recurrence | a feed that says what uptime enforces publishes both, with no `UNTIL`                                 |
| `isRecurringPatternActive` requires `start <= now < end` on one day, so `daily:23:00-01:00` never matches      | an RRULE with a two-hour `DURATION` would announce a window uptime never applies                      |
| `monthly:31` clamps to the month's last day                                                                    | expressible as `BYMONTHDAY=28,29,30,31;BYSETPOS=-1`, not as `BYMONTHDAY=31`, which skips short months |

There is no incident model, so incidents cannot go in a feed until one exists.

### What `@sdxc/cron` and `@sdxc/dates` already cover

| Package       | What it has                                                                                         | Relation to iCalendar                                                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sdxc/cron`  | `Schedule` over cron expressions, `next`/`previous`/`isDue` in an IANA zone, its own `time-zone.ts` | a different grammar: no `INTERVAL`, `COUNT`, `UNTIL`, `BYSETPOS`, durations or exceptions                                                               |
| `@sdxc/dates` | `zone.ts`: `zonedParts`, `offsetMsAt`, `instantFromParts` (internal, not exported)                  | `instantFromParts` returns the earlier instant for a repeated hour and shifts a skipped one forward by the gap, which is exactly RFC 5545 §3.3.5's rule |

RRULE expansion needs the same wall-clock arithmetic cron does, but not cron's field matching.
The shared piece is the zone conversion, and `@sdxc/dates` has the version whose DST semantics
match RFC 5545.

### What the RFCs ask of a writer and a reader

| Rule                                                                                                          | Consequence for the package                                                                                |
| ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Content lines end in CRLF and fold at 75 octets, continuation lines start with one space (§3.1)               | the writer folds by UTF-8 bytes and never splits a multi-byte character; the reader unfolds before parsing |
| TEXT escapes `\\`, `\;`, `\,` and newlines as `\n` (§3.3.11)                                                  | escaping lives in one place; `\N` is accepted on read                                                      |
| Parameter values with `:`, `;` or `,` are quoted; RFC 6868 adds `^n`, `^^`, `^'`                              | the writer quotes and caret-encodes; the reader decodes both                                               |
| `VCALENDAR` requires `PRODID` and `VERSION:2.0` (§3.6)                                                        | the writer requires `productId`; `VERSION` is always written                                               |
| `VEVENT` requires `UID` and `DTSTAMP` (§3.6.1)                                                                | required in the writer's type; tolerated missing on read, since real feeds omit them                       |
| Without `METHOD`, `DTSTAMP` is when the event was last revised (§3.8.7.2)                                     | a feed sets `dtstamp` from the row's `updated_at`                                                          |
| `SEQUENCE` increases with each significant revision (§3.8.7.4)                                                | the writer takes it from the caller; uptime derives it from `updated_at`                                   |
| A `TZID` must name a `VTIMEZONE` in the same object (§3.2.19)                                                 | zoned date-times are only written with a matching `VTIMEZONE`; UTC needs none                              |
| A nonexistent local time uses the offset before the gap; a repeated one, the first (§3.3.5)                   | expansion uses `@sdxc/dates`' `instantFromParts`                                                           |
| RRULE: `FREQ`, `INTERVAL`, `COUNT` or `UNTIL`, `BYxxx` filters in a fixed order, `BYSETPOS`, `WKST` (§3.3.10) | a full RRULE value type; expansion is bounded by a window and a limit                                      |
| Media type `text/calendar`, with `method=` when iTIP (RFC 5545 §8.1, RFC 5546)                                | a response helper sets both, and `Content-Disposition` for downloads                                       |
| `REFRESH-INTERVAL`, `NAME`, `URL`, `COLOR` on the calendar (RFC 7986)                                         | calendar-level fields for subscription feeds                                                               |

## Decision

Add `@sdxc/icalendar`: parse and write RFC 5545 calendars with typed `VEVENT`, `VALARM` and
`VTIMEZONE`, a full RRULE value type with bounded expansion, `VTIMEZONE` generation from `Intl`,
and a `text/calendar` response helper. Uptime adopts it first, with a per-status-page maintenance
feed and a per-window download.

### Package name

| Name                  | Trade-off                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| **`@sdxc/icalendar`** | The RFC's own name for the format; unambiguous next to jCal and iTIP                                            |
| `@sdxc/ical`          | Shorter, and the name of Apple's app as much as of the format                                                   |
| `@sdxc/ics`           | The file extension; reads well in `import { stringify } from "@sdxc/ics"`, and says nothing about RRULE or iTIP |
| `@sdxc/calendar`      | Too broad: it reads as calendar UI or date grids, which `@sdxc/dates` and `@sdxc/ui` already cover              |

`@sdxc/icalendar` wins: the package is a format package, and format packages here are named for
the format (`@sdxc/opml`, `@sdxc/yaml`, `@sdxc/rss`).

### Scope

The package includes:

- `parse` and `stringify` for `VCALENDAR`, with typed `VEVENT`, `VALARM` and `VTIMEZONE`
- a generic component and property layer underneath, so `VTODO`, `VJOURNAL`, `VFREEBUSY` and
  `X-` properties survive a parse and stringify round trip untyped
- line folding and unfolding, TEXT escaping, RFC 6868 parameter encoding
- `DATE`, `DATE-TIME` (UTC, floating, `TZID`), `DURATION`, `PERIOD` and `RECUR` value types
- `./rrule`: parse and write RRULE, and expand an event's occurrences (RRULE, RDATE, EXDATE)
  within a window
- `./timezone`: build a `VTIMEZONE` for an IANA zone from `Intl`, and resolve a parsed `TZID`
- a `text/calendar` response helper for feeds and downloads

Decisions inside that scope:

- **Emit UTC by default.** A one-off event is written as `DTSTART:20260923T100000Z` and needs no
  `VTIMEZONE`. A recurring event whose wall clock follows a zone is the one case that needs
  `TZID` plus a `VTIMEZONE`, because a UTC RRULE drifts by an hour across DST. Uptime's
  recurrences are UTC wall clock, so its feed needs no `VTIMEZONE` at all.
- **Generated `VTIMEZONE`s list transitions, not rules.** `./timezone` probes `Intl` for the
  offset changes inside the span the calendar covers and writes one `STANDARD` or `DAYLIGHT`
  observance per transition with an explicit `DTSTART`. Every client reads that, and nothing has
  to reverse-engineer a yearly rule from `Intl`.
- **RRULE expansion is in scope, bounded.** Reading a `VTIMEZONE` from Outlook (Windows zone
  names, yearly `RRULE` observances) needs expansion anyway, and uptime's matcher can move onto it.
  Every expansion takes a window and a limit, so a `FREQ=SECONDLY` rule with no end cannot run
  unbounded.
- **Lenient reader, strict writer.** Missing `UID` or `DTSTAMP` on read is accepted and reported
  in `warnings`; the writer's types require them. Structural errors (an unmatched `END`, a line
  with no `:`) are failures.

Out of scope, and where each lives instead:

- Cron expressions live in `@sdxc/cron`; the two grammars stay separate
- Wall clock to instant conversion lives in `@sdxc/dates`, which exports `zone.ts` as
  `@sdxc/dates/zone` for this package
- Sending invitations lives in `@sdxc/mail`, which needs a `text/calendar` MIME part before iTIP
  can ship (Phase 4)
- jCal (RFC 7265) is left for a consumer that needs it: CalDAV, JMAP Calendars or a JSON API.
  The generic component layer maps one to one onto jCal's `[name, properties, components]`
  arrays, so it is a `./jcal` subpath of about a hundred lines when one appears
- CalDAV (RFC 4791) is a protocol over WebDAV, and lives in an app if one ever serves it

### Exports

#### `"."`

```ts
import type { Result } from "@sdxc/result";

export namespace ICalendar {
	export interface Calendar {
		productId: string; // PRODID, e.g. "-//sergiodxa//uptime//EN"
		method?: "PUBLISH" | "REQUEST" | "REPLY" | "CANCEL" | (string & {});
		name?: string; // RFC 7986 NAME, plus X-WR-CALNAME on write
		description?: string;
		url?: string;
		refreshInterval?: Duration; // RFC 7986 REFRESH-INTERVAL, plus X-PUBLISHED-TTL on write
		timeZones: TimeZone[];
		events: Event[];
		/** Components other than VEVENT and VTIMEZONE, kept verbatim. */
		components: Component[];
		/** Calendar properties this interface does not name, e.g. X- properties. */
		properties: Property[];
	}

	export type DateValue =
		| { type: "date"; year: number; month: number; day: number }
		| { type: "date-time"; wall: WallClock; zone: "utc" | "floating" | { tzid: string } };

	export interface WallClock {
		year: number;
		month: number;
		day: number;
		hour: number;
		minute: number;
		second: number;
	}

	export interface Duration {
		negative?: boolean;
		weeks?: number;
		days?: number;
		hours?: number;
		minutes?: number;
		seconds?: number;
	}

	export interface Event {
		uid: string;
		dtstamp: Date;
		start: DateValue;
		end?: DateValue; // END and DURATION are mutually exclusive
		duration?: Duration;
		summary?: string;
		description?: string;
		location?: string;
		url?: string;
		status?: "TENTATIVE" | "CONFIRMED" | "CANCELLED";
		transparency?: "OPAQUE" | "TRANSPARENT";
		sequence?: number;
		created?: Date;
		lastModified?: Date;
		categories?: string[];
		recurrence?: RecurrenceRule;
		recurrenceDates?: DateValue[]; // RDATE
		exceptionDates?: DateValue[]; // EXDATE
		recurrenceId?: DateValue;
		organizer?: CalendarUser;
		attendees?: Attendee[];
		alarms?: Alarm[];
		properties: Property[];
	}

	export interface RecurrenceRule {
		frequency: "SECONDLY" | "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
		interval?: number;
		count?: number; // COUNT and UNTIL are mutually exclusive
		until?: DateValue;
		bySecond?: number[];
		byMinute?: number[];
		byHour?: number[];
		byDay?: { weekday: Weekday; ordinal?: number }[];
		byMonthDay?: number[]; // negative counts from the month's end
		byYearDay?: number[];
		byWeekNumber?: number[];
		byMonth?: number[];
		bySetPosition?: number[];
		weekStart?: Weekday;
	}

	export type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

	export interface Alarm {
		action: "DISPLAY" | "AUDIO" | "EMAIL";
		trigger: { before: Duration; related?: "START" | "END" } | { at: Date };
		description?: string;
		summary?: string; // EMAIL only
		attendees?: CalendarUser[]; // EMAIL only
		repeat?: { count: number; every: Duration };
	}

	export interface CalendarUser {
		address: string; // mailto: URI
		name?: string; // CN
	}

	export interface Attendee extends CalendarUser {
		role?: "CHAIR" | "REQ-PARTICIPANT" | "OPT-PARTICIPANT" | "NON-PARTICIPANT";
		participation?: "NEEDS-ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE" | "DELEGATED";
		rsvp?: boolean;
	}

	export interface TimeZone {
		tzid: string;
		observances: {
			kind: "STANDARD" | "DAYLIGHT";
			start: WallClock;
			offsetFrom: number; // minutes east of UTC
			offsetTo: number;
			name?: string;
			recurrence?: RecurrenceRule;
		}[];
	}

	export interface Component {
		name: string; // upper-cased, e.g. "VTODO"
		properties: Property[];
		components: Component[];
	}

	export interface Property {
		name: string;
		parameters: Record<string, string[]>;
		value: string; // unescaped text of the value, before typing
	}

	export interface Parsed {
		calendar: Calendar;
		/** Recoverable departures from the RFC, e.g. a VEVENT without DTSTAMP. */
		warnings: string[];
	}
}

/** Structural failures: unmatched BEGIN/END, a content line without ":", no VCALENDAR. */
export class ICalendarParseError extends Error {
	override name = "ICalendarParseError";
	line: number;
}

/** Reads the first VCALENDAR in the text. */
export function parse(source: string): Result<ICalendar.Parsed, ICalendarParseError>;

/** Reads every VCALENDAR in the text, for files that concatenate several. */
export function parseAll(source: string): Result<ICalendar.Parsed[], ICalendarParseError>;

/** Writes CRLF lines folded at 75 octets; VERSION:2.0 is always written. */
export function stringify(calendar: ICalendar.Calendar): string;

/** The instant a DATE-TIME names; null for a floating time, or a TZID neither Intl nor the calendar's VTIMEZONEs resolve. */
export function toInstant(value: ICalendar.DateValue, calendar?: ICalendar.Calendar): number | null;

/** A UTC DATE-TIME for an instant, the form the writer prefers. */
export function utc(instant: number | Date): ICalendar.DateValue;

export const MEDIA_TYPE = "text/calendar";

/** A text/calendar response; `method` adds the iTIP parameter, `filename` makes it a download. */
export function calendarResponse(
	calendar: ICalendar.Calendar,
	init?: ResponseInit & { filename?: string },
): Response;
```

#### `"./rrule"`

```ts
import type { Result } from "@sdxc/result";
import type { ICalendar } from "@sdxc/icalendar";

export class RecurrenceRuleError extends Error {
	override name = "RecurrenceRuleError";
}

export function parseRecurrence(
	value: string,
): Result<ICalendar.RecurrenceRule, RecurrenceRuleError>;

/** Writes the parts in the RFC's order; FREQ first, then INTERVAL, COUNT/UNTIL, BYxxx, WKST. */
export function stringifyRecurrence(rule: ICalendar.RecurrenceRule): string;

export interface OccurrenceOptions {
	from: number; // epoch ms, inclusive
	to: number; // epoch ms, exclusive
	limit?: number; // @default 1_000
	calendar?: ICalendar.Calendar; // resolves TZIDs through its VTIMEZONEs
}

/** Occurrences of an event (RRULE + RDATE − EXDATE) overlapping the window, as instants. */
export function occurrences(
	event: ICalendar.Event,
	options: OccurrenceOptions,
): Result<{ start: number; end: number }[], RecurrenceRuleError>;
```

#### `"./timezone"`

```ts
import type { Result } from "@sdxc/result";
import type { ICalendar } from "@sdxc/icalendar";

export class TimeZoneError extends Error {
	override name = "TimeZoneError";
}

/** A VTIMEZONE for an IANA zone, with one observance per offset change between from and to. */
export function vtimezone(
	tzid: string,
	span: { from: number; to: number },
): Result<ICalendar.TimeZone, TimeZoneError>;
```

### Usage

#### Uptime: a maintenance feed per status page

A new route beside the status page, `statusPageCalendar: get("/status/:slug/maintenance.ics")`
in `routes/web.ts`, served by `app/http/controllers/status-page-calendar.ts`:

```ts
import { calendarResponse, utc } from "@sdxc/icalendar";

export default createAction(routes.statusPageCalendar, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let page = await StatusPage.findBySlugPublic(ctx.db, slug);
	if (!page) return notFound(ctx);

	let windows = await MaintenanceWindow.listForStatusPage(ctx.db, page);

	return calendarResponse({
		productId: "-//sergiodxa//uptime//EN",
		name: ctx.intl.t("statusPage.calendar.name", { title: page.title }),
		url: new URL(routes.statusPage.href({ slug }), ctx.url).toString(),
		refreshInterval: { hours: 1 },
		timeZones: [],
		events: windows.flatMap((window) => maintenanceEvents(window, ctx)),
		components: [],
		properties: [],
	});
});
```

`MaintenanceWindow.listForStatusPage` is new in `app/data/maintenance-window.ts`: the team's
windows with `show_on_status_page`, whose scope is every monitor or a monitor attached to the
page, and that are recurring or have not ended more than 30 days ago. `maintenanceEvents` maps one
row to what `isActiveAt` enforces:

| Row                                  | VEVENT                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| one-off range                        | `UID:<id>@uptime`, `DTSTART` = `starts_at`, `DTEND` = `ended_early_at ?? ends_at`, UTC                                |
| ended early                          | same `UID`, earlier `DTEND`, higher `SEQUENCE`                                                                        |
| `daily:02:00-04:00`                  | `UID:<id>-recurring@uptime`, `DTSTART` at the first 02:00 UTC after `created_at`, `DURATION:PT2H`, `RRULE:FREQ=DAILY` |
| `weekly:monday:...`                  | `RRULE:FREQ=WEEKLY;BYDAY=MO`                                                                                          |
| `monthly:N:...`, N ≤ 28              | `RRULE:FREQ=MONTHLY;BYMONTHDAY=N`                                                                                     |
| `monthly:N:...`, N > 28              | `RRULE:FREQ=MONTHLY;BYMONTHDAY=28,...,N;BYSETPOS=-1`, the last-day clamp uptime applies                               |
| pattern whose end is not after start | no recurring VEVENT, since uptime never activates it                                                                  |

`DTSTAMP` and `LAST-MODIFIED` are `updated_at`; `SEQUENCE` is `updated_at` minus `created_at` in
whole seconds, which increases on every edit without a new column. `SUMMARY` is the window's name,
and `DESCRIPTION` lists the affected monitors by their status-page display names, translated with
`ctx.intl.t`. A deleted window drops out of the feed, which subscribed clients treat as removal.

The status page (`status-page.tsx`) gains a "Subscribe to maintenance" link offering the
`webcal://` form of the feed URL, the plain `https://` URL to paste, and a Google Calendar
add-by-URL link. Custom-domain status pages serve the same path on their domain. The feed is
cached like the page, since clients poll it and `refreshInterval` asks for hourly at most.

#### Uptime: "add to calendar" for one window

`get("/status/:slug/maintenance/:windowId.ics")` returns a one-event calendar with
`calendarResponse(calendar, { filename: "maintenance.ics" })`, which sets
`Content-Disposition: attachment`. The same `UID` as the feed means a client holding both shows
one event. The status page and the maintenance emails, when uptime sends them, link it.

#### Uptime: one recurrence engine

Once `./rrule` ships, `isRecurringPatternActive` becomes "does `occurrences` return anything
covering now", fed the same RRULE the feed writes. The feed and the alert suppression then cannot
disagree, and the overnight-window gap closes in the one place.

#### Later: invitations through `@sdxc/mail`

iTIP (`METHOD:REQUEST`, `ORGANIZER`, `ATTENDEE`, `CANCEL` on delete) sent as a
`text/calendar; method=REQUEST` alternative part is what makes a maintenance email appear in the
recipient's calendar with accept and decline buttons. `@sdxc/mail`'s MIME writer
(`packages/mail/src/mime.ts`) writes `text/plain` and `text/html` parts only today, so this waits
for it to accept an extra alternative part.

## Consequences

### Positive

- **Status page readers plan around maintenance** - the window is in their calendar, updated when
  it moves or ends early, instead of on a page they have to revisit
- **`show_on_status_page` finally does something** - the flag customers set gets its first reader
- **One recurrence engine** - uptime's hand-rolled matcher can be replaced by RRULE expansion, and
  the overnight-window bug goes with it
- **Standard zone semantics** - DST gaps and repeats follow RFC 5545 through `@sdxc/dates`, the
  same conversion the repo already trusts
- **Round trips are lossless** - unknown components and properties survive, so a calendar read and
  written back keeps what it did not understand

### Negative

- **RRULE is a large grammar** - `BYSETPOS`, `BYWEEKNO` with `WKST`, and the expansion order in
  §3.3.10 are where implementations disagree, and the test suite has to be correspondingly large
- **A feed publishes semantics uptime has not settled** - the "one-off range or unbounded
  recurrence" reading of a recurring row is published as is; if uptime changes it, subscribers see
  the change on their next refresh
- **`@sdxc/dates` gains a public subpath** - `zone.ts` becomes API, with the stability that implies
- **Clients refresh on their own schedule** - Google Calendar in particular is reported to ignore
  `REFRESH-INTERVAL` and to show a moved window hours late, which no feed can fix

### Neutral

- **No incidents yet** - the feed carries maintenance only until uptime has an incident record;
  incidents would join it as events with `STATUS` and `SEQUENCE` changes on each update
- **`@sdxc/cron` is unchanged** - it keeps its own zone helpers; consolidating them onto
  `@sdxc/dates/zone` is possible and separate

## Implementation Plan

### Phase 1: Core format

**Priority:** High
**Estimated Effort:** 6 hours

1. Export `zone.ts` from `@sdxc/dates` as `./zone`
2. Write the tests first: the RFC's examples in §3.6 and §4; folding at exactly 75 octets with
   multi-byte characters on the boundary; TEXT escaping both ways; RFC 6868 caret encoding; UTC,
   floating and `TZID` date-times; `DURATION` and `PERIOD`; unknown components round-tripping;
   warnings for missing `UID`/`DTSTAMP`; structural failures with line numbers
3. Implement `parse`, `parseAll`, `stringify`, `toInstant`, `utc`, `calendarResponse`, and RRULE
   parse and stringify (the value type, without expansion)
4. README per the package documentation guide, root README table row

### Phase 2: Uptime maintenance feed and download

**Priority:** High
**Estimated Effort:** 4 hours

| File                                                    | Change                                                                       |
| ------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `routes/web.ts`                                         | `statusPageCalendar` and `statusPageMaintenanceEvent` routes                 |
| `app/data/maintenance-window.ts`                        | `listForStatusPage`; the row-to-RRULE mapping beside `parseRecurringPattern` |
| `app/http/controllers/status-page-calendar.ts`          | new: the feed                                                                |
| `app/http/controllers/status-page-maintenance-event.ts` | new: one-window download                                                     |
| `app/http/controllers/status-page.tsx`                  | subscribe links; an upcoming-maintenance list reading the same query         |
| `app/locales/*.ts`                                      | calendar name, description and link copy in all six locales                  |

Tests assert the feed against a parsed round trip of its own output, including the `monthly:31`
clamp and an overnight pattern producing no recurring event.

### Phase 3: Expansion and zones

**Priority:** Medium
**Estimated Effort:** 6 hours

1. `./rrule` `occurrences`, tested against the RFC's §3.8.5.3 examples and against a second
   implementation for randomized rules
2. `./timezone` `vtimezone` and `TZID` resolution through parsed `VTIMEZONE`s
3. Replace `isRecurringPatternActive` in uptime with `occurrences`, keeping
   `maintenance-window.test.ts` passing and adding a regression test for overnight windows

### Phase 4: Invitations

**Priority:** Low
**Estimated Effort:** 4 hours

1. Let `@sdxc/mail` accept a `text/calendar; method=...` alternative part
2. iTIP helpers for `REQUEST` and `CANCEL` in this package, then maintenance emails in uptime that
   carry them

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. `description`, `LICENSE.md`, `bun run release:bootstrap @sdxc/icalendar`, trusted publisher

## Alternatives Considered

### 1. Write the feed as a string template in uptime

**Rejected because**: folding by octets, escaping and RRULE clamping are exactly the details a
template gets wrong, and the second adopter (any app sending an invite) would copy it.

### 2. Use `ical.js` or `ical-generator`

`ical.js` (Mozilla) reads and writes the full format, including jCal; `ical-generator` only writes.

**Rejected because**: `ical.js` models time zones with its own database and mutable classes, throws
on invalid input, and brings a zone model separate from `@sdxc/dates`. `ical-generator` covers
writing only, and neither returns `Result`.

### 3. Leave RRULE expansion out

**Rejected because**: parsing a real-world `VTIMEZONE` needs it, and uptime's recurrence matcher,
which has a bug today, is the natural second user. Keeping it on a subpath means a writer-only
consumer never loads it.

### 4. Emit `TZID` plus `VTIMEZONE` for everything

**Rejected because**: a one-off event in UTC is exact and needs no zone data, and every generated
`VTIMEZONE` is data a client may interpret differently. Zones are written only when the wall clock
has to follow one.

## References

- [RFC 5545 - iCalendar](https://www.rfc-editor.org/rfc/rfc5545)
- [RFC 5546 - iTIP](https://www.rfc-editor.org/rfc/rfc5546)
- [RFC 6868 - Parameter Value Encoding in iCalendar and vCard](https://www.rfc-editor.org/rfc/rfc6868)
- [RFC 7265 - jCal](https://www.rfc-editor.org/rfc/rfc7265)
- [RFC 7986 - New Properties for iCalendar](https://www.rfc-editor.org/rfc/rfc7986)
- [RFC 4791 - CalDAV](https://www.rfc-editor.org/rfc/rfc4791)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)
- [ADR-090: One-click Unsubscribe in Mail](./ADR-090-one-click-unsubscribe-in-mail.md) (the other
  pending `@sdxc/mail` change)

## Current Progress

- [ ] Phase 1: Core format
- [ ] Phase 2: Uptime maintenance feed and download
- [ ] Phase 3: Expansion and zones
- [ ] Phase 4: Invitations
- [ ] Phase 5: Publish
