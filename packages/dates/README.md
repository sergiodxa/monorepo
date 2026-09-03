# @sdxc/dates

Calendar operations over the platform `Date`, with every human-facing string formatted by `Intl` and every time zone passed in explicitly.

## Overview

Date code goes wrong in two places. The first is formatting: a library that ships its own locale data produces month names, orderings and separators that disagree with the platform's, and it costs bundle size to do it. Every formatter here is a thin wrapper over [`Intl`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl), so locale data comes from the runtime and there is no pattern language to learn — a layout `Intl` cannot express is composed from `formatParts()` output instead.

The second is time zones. "Which day is this" has a different answer in every zone, and on two days a year it has a different answer than the day before in the same zone. Operations that answer a calendar question — `startOfDay`, `startOfWeek`, `diffInDays`, `isSameDay`, `eachDayOfInterval`, `toDayKey` — take the zone as a required argument, so omitting it is a type error rather than a silent assumption of UTC or of whatever zone the server happens to run in. Operations that only move an instant by a fixed length — `addDays`, `add`, `subtract`, `elapsed` — take no zone, because a length of time is the same length everywhere.

Everything is a plain function over `Date`; there are no value types to convert to and from at boundaries. Durations are expressed with [`@sdxc/duration`](/packages/duration), the one dependency, so `add(date, "1 hour")` reads as written. Parsing and construction return a [`Result`](/packages/result) rather than an `Invalid Date`. When `Temporal` is available everywhere these functions run, it can back them without any signature changing.

## Usage

### Formatting For A Reader

```typescript
import { formatDate, formatDateTime, formatRelative, formatTime } from "@sdxc/dates";

let locale = "en-US";
let timeZone = "America/New_York";

formatDate(publishedAt, { locale, timeZone }); // "Jul 29, 2026"
formatTime(publishedAt, { locale, timeZone }); // "6:00 AM"
formatDateTime(publishedAt, { locale, timeZone }); // "Jul 29, 2026 at 6:00 AM"
formatRelative(publishedAt, { locale }); // "3 days ago"
```

### Calendar Operations

```typescript
import { diffInDays, eachDayOfInterval, isSameDay, startOfDay, toDayKey } from "@sdxc/dates";

let timeZone = "America/New_York";

startOfDay(new Date(), timeZone);
isSameDay(a, b, timeZone);
diffInDays(b, a, timeZone);
eachDayOfInterval({ start, end }, timeZone);
toDayKey(new Date(), timeZone); // "2026-07-29"

startOfDay(new Date()); // Type error: the zone is not optional
```

### Instant Arithmetic

```typescript
import { add, addDays, elapsed, subtract } from "@sdxc/dates";

let expiresAt = add(new Date(), "30 days");
let retryAt = add(new Date(), "250ms");
let cutoff = subtract(new Date(), "1 hour");
let window = addDays(new Date(), -7);

let startedAt = Date.now();
await work();
logger.info("finished", { ms: elapsed(startedAt) });
```

### A Day Grid

```typescript
import { daysOfYear, formatWeekday, groupByWeek, lastNDays } from "@sdxc/dates";

let timeZone = "America/New_York";

let days = lastNDays(90, { timeZone });
let weeks = groupByWeek(days, { weekStartsOn: 0, timeZone });
let headers = [0, 1, 2, 3, 4, 5, 6].map((weekday) => formatWeekday(weekday, { locale: "en-US" }));

for (let week of weeks) {
	for (let day of week) render(day.key, statusByDay.get(day.key));
}
```

## API

### Formatting

#### `formatDate(date: Date, options: FormatDateOptions): string`

Renders the calendar date an instant falls on, in a zone.

**Parameters:**

- `date`: Instant to render
- `options.locale`: Locale, or preference list, to take month and weekday names from
- `options.timeZone`: IANA zone whose calendar day the instant is rendered as
- `options.dateStyle?`: `"full" | "long" | "medium" | "short"`, defaults to `"medium"`

**Returns:**

- The localized date

**Example:**

```typescript
formatDate(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026"
formatDate(date, { locale: "es-AR", timeZone: "UTC", dateStyle: "long" }); // "29 de julio de 2026"
```

#### `formatTime(date: Date, options: FormatTimeOptions): string`

Renders the time of day an instant reads as on a clock in a zone.

**Parameters:**

- `date`: Instant to render
- `options.locale`: Locale, or preference list, to take clock conventions from
- `options.timeZone`: IANA zone whose clock the instant is rendered as
- `options.timeStyle?`: `"full" | "long" | "medium" | "short"`, defaults to `"short"`

**Returns:**

- The localized time of day

**Example:**

```typescript
formatTime(date, { locale: "en-US", timeZone: "America/New_York" }); // "6:00 AM"
```

#### `formatDateTime(date: Date, options: FormatDateTimeOptions): string`

Renders an instant as a date and a time of day, joined the way the locale joins them.

**Parameters:**

- `date`: Instant to render
- `options.locale`: Locale, or preference list
- `options.timeZone`: IANA zone whose clock and calendar the instant is rendered as
- `options.dateStyle?`: Length of the date half, defaults to `"medium"`
- `options.timeStyle?`: Length of the time half, defaults to `"short"`

**Returns:**

- The localized date and time

**Example:**

```typescript
formatDateTime(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026 at 10:00 AM"
```

#### `formatRange(start: Date, end: Date, options: FormatRangeOptions): string`

Renders the span between two instants as one range, collapsing whatever the two ends share, through `Intl.DateTimeFormat#formatRange`. The time half is off unless a `timeStyle` is given, because a range of days is the common case.

**Parameters:**

- `start`: First instant of the span
- `end`: Last instant of the span
- `options.locale`: Locale, or preference list
- `options.timeZone`: IANA zone both ends are rendered in
- `options.dateStyle?`: Length of the date half, defaults to `"medium"`
- `options.timeStyle?`: Length of the time half, omitted entirely when left out

**Returns:**

- The localized range, or a single date when both ends collapse onto one

**Example:**

```typescript
formatRange(start, end, { locale: "en-US", timeZone: "UTC" }); // "Jul 29 – 31, 2026"
```

#### `formatRelative(date: Date, options: FormatRelativeOptions): string`

Words the distance from now to an instant with `Intl.RelativeTimeFormat`, in the largest unit that reads as a whole number of that unit. Future instants read as "in ..." and past ones as "... ago".

The unit is chosen by rounding, and a distance that rounds up to a full unit carries into the next one, so nothing ever reads as "in 60 seconds".

**Parameters:**

- `date`: Instant to describe
- `options.locale`: Locale, or preference list, to take the phrasing from
- `options.now?`: Instant to measure against, defaults to the current time
- `options.numeric?`: `"auto"` (default) lets the locale say "yesterday" or "now"; `"always"` forces "1 day ago"
- `options.style?`: `"long"` (default), `"short"` or `"narrow"`

**Returns:**

- The localized relative phrase

**Example:**

```typescript
formatRelative(date, { locale: "en-US", now }); // "3 days ago"
formatRelative(date, { locale: "en-US", now }); // "yesterday"
formatRelative(date, { locale: "en-US", now, numeric: "always" }); // "1 day ago"
```

#### `formatDuration(input: DurationInput, options: FormatDurationOptions): string`

Words a length of time rather than an instant, rendering each component as an `Intl.NumberFormat` unit and joining them with `Intl.ListFormat`. Components that are zero are skipped, and a length under a second reads in milliseconds.

**Parameters:**

- `input`: A duration string, or a number of milliseconds
- `options.locale`: Locale, or preference list, to take unit names and joining from
- `options.style?`: `"long"` (default), `"short"` or `"narrow"`
- `options.maxUnits?`: How many components to keep, largest first; all non-zero components by default

**Returns:**

- The localized length; a negative length carries its sign on the largest component, and a zero length reads as zero seconds

**Example:**

```typescript
formatDuration("90 minutes", { locale: "en-US" }); // "1 hour, 30 minutes"
formatDuration("90 minutes", { locale: "en-US", style: "short" }); // "1 hr, 30 min"
formatDuration("90 minutes", { locale: "en-US", maxUnits: 1 }); // "1 hour"
```

#### `formatParts(date: Date, options: FormatPartsOptions): Intl.DateTimeFormatPart[]`

Breaks an instant into its localized pieces, each tagged with what it is, for layouts `Intl` cannot express on its own. Accepts any `Intl.DateTimeFormat` option on top of the required locale and zone; with none, the platform falls back to a numeric year, month and day, so name the fields the layout needs.

**Parameters:**

- `date`: Instant to break down
- `options.locale`: Locale, or preference list
- `options.timeZone`: IANA zone the instant is broken down in
- Any other `Intl.DateTimeFormat` option

**Returns:**

- The parts in the locale's own order, literals included

**Example:**

```typescript
let parts = formatParts(date, { locale: "en-US", timeZone: "UTC", month: "long", day: "numeric" });
// [{ type: "month", value: "July" }, { type: "literal", value: " " }, { type: "day", value: "29" }]
```

#### `formatWeekday(weekday: Weekday, options: FormatWeekdayOptions): string`

The localized name of a weekday with no date attached: the label a day grid puts above its columns. The index follows `Date#getDay` and `weekStartsOn`, so `0` is always Sunday, and no zone is involved.

**Parameters:**

- `weekday`: Weekday index, `0` Sunday through `6` Saturday
- `options.locale`: Locale, or preference list
- `options.style?`: `"long"`, `"short"` (default) or `"narrow"`

**Returns:**

- The localized weekday name

**Example:**

```typescript
formatWeekday(1, { locale: "en-US" }); // "Mon"
formatWeekday(0, { locale: "es-AR", style: "long" }); // "domingo"
```

### Zoned Operations

#### `startOfDay(date: Date, timeZone: TimeZone): Date`

The first instant of the calendar day an instant falls on, in a zone. On a day whose DST transition skips midnight, this is the first instant that exists that day rather than a time that never happened.

**Parameters:**

- `date`: Any instant on the day of interest
- `timeZone`: IANA zone whose calendar day to open

**Returns:**

- The day's first instant

**Example:**

```typescript
startOfDay(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // 2026-07-28T04:00:00Z
```

#### `endOfDay(date: Date, timeZone: TimeZone): Date`

The last instant of the calendar day an instant falls on, in a zone: one millisecond before the next day starts. Derived from the next day's start, so it stays correct on days that are 23 or 25 hours long.

**Example:**

```typescript
endOfDay(new Date("2026-03-08T12:00:00Z"), "America/New_York"); // 2026-03-09T03:59:59.999Z
```

#### `startOfWeek(date: Date, timeZone: TimeZone, options: StartOfWeekOptions): Date`

The first instant of the week an instant falls in, in a zone.

**Parameters:**

- `date`: Any instant in the week of interest
- `timeZone`: IANA zone whose calendar week to open
- `options.weekStartsOn`: Weekday a week begins on, `0` Sunday through `6` Saturday

**Returns:**

- The week's first instant, at the start of its first day

**Example:**

```typescript
startOfWeek(date, "UTC", { weekStartsOn: 1 }); // Monday-based week
```

#### `diffInDays(a: Date, b: Date, timeZone: TimeZone): number`

Calendar days from `b` to `a` in a zone: how many day boundaries separate them, not how many 24-hour spans fit between them. Two instants an hour apart return `1` when a midnight sits between them, and instants 23 or 25 hours apart across a DST transition still return `1`.

**Returns:**

- Whole days, positive when `a` is on a later day than `b`

**Example:**

```typescript
diffInDays(new Date("2026-07-30T01:00:00Z"), new Date("2026-07-29T23:00:00Z"), "UTC"); // 1
```

#### `isSameDay(a: Date, b: Date, timeZone: TimeZone): boolean`

Whether two instants fall on the same calendar day in a zone. The same pair can be one day in one zone and two in another, which is why the zone cannot be defaulted.

**Example:**

```typescript
isSameDay(a, b, "UTC"); // true
isSameDay(a, b, "America/New_York"); // false
```

#### `eachDayOfInterval(interval: Interval, timeZone: TimeZone): Date[]`

Every calendar day touched by an interval, as the instant each day starts at in the zone. Both ends are inclusive and the step is one calendar day, so a 23-hour or 25-hour day still produces exactly one entry.

**Parameters:**

- `interval.start`: First instant of the range
- `interval.end`: Last instant of the range
- `timeZone`: IANA zone whose calendar days to enumerate

**Returns:**

- Day starts in chronological order, or an empty array when `end` falls on a day before `start`

**Example:**

```typescript
eachDayOfInterval({ start, end }, "America/New_York");
```

### Instant Arithmetic

#### `addDays(date: Date, count: number): Date`

Moves an instant forward by whole 24-hour days. This is instant arithmetic, not calendar arithmetic: across a DST transition the result lands an hour off the original wall clock, which is correct for "24 hours later" and wrong for "the same time tomorrow".

**Example:**

```typescript
addDays(new Date("2026-07-29T10:00:00Z"), 3); // 2026-08-01T10:00:00Z
```

#### `subDays(date: Date, count: number): Date`

Moves an instant back by whole 24-hour days, with the same instant semantics as `addDays`.

#### `add(date: Date, duration: DurationInput): Date`

Moves an instant forward by a duration, written with its unit at the call site.

**Example:**

```typescript
add(new Date(), "90 minutes");
add(new Date(), "30 days");
add(new Date(), 1500); // a bare number is milliseconds
```

#### `subtract(date: Date, duration: DurationInput): Date`

Moves an instant back by a duration.

**Example:**

```typescript
subtract(new Date(), "1 hour");
```

#### `elapsed(since: Date | number, now?: Date | number): number`

Milliseconds between an instant and now, positive once the instant is in the past. The current time is an argument with a default, so measuring real elapsed time costs nothing extra and a test passes both ends instead of freezing the clock.

**Parameters:**

- `since`: The earlier instant, as a `Date` or a timestamp
- `now?`: The instant to measure to, defaults to the current time

**Returns:**

- Elapsed milliseconds, negative when `since` is in the future

**Example:**

```typescript
let startedAt = Date.now();
logger.info("done", { ms: elapsed(startedAt) });
elapsed(new Date("2026-07-29T10:00:00Z"), new Date("2026-07-29T10:00:05Z")); // 5000
```

### Day Grids

#### `daysOfYear(year: number, timeZone: TimeZone): Day[]`

Every day of a calendar year, January 1st through December 31st, in a zone. Leap years produce 366 entries.

**Example:**

```typescript
daysOfYear(2024, "UTC").length; // 366
```

#### `lastNDays(count: number, options: LastNDaysOptions): Day[]`

A rolling window of the last `count` calendar days, ending on the day `from` falls on and including it. Counting calendar days rather than 24-hour spans keeps the window exactly `count` entries long across a DST transition.

**Parameters:**

- `count`: Days the window covers, including its last day
- `options.from?`: Last day of the window, inclusive, defaults to the current instant
- `options.timeZone`: IANA zone whose calendar days the window is counted in

**Returns:**

- Day descriptors in chronological order, empty when `count` is under `1`

**Example:**

```typescript
lastNDays(90, { timeZone: "America/New_York" });
lastNDays(7, { from: reportedAt, timeZone: "UTC" });
```

#### `groupByWeek(days: Day[], options: GroupByWeekOptions): Day[][]`

Buckets a chronological day list into weeks, one array per week, for a grid that lays weeks out as columns. Partial weeks are kept as they are at both ends: nothing is padded and no day is dropped.

**Parameters:**

- `days`: Days to bucket, in chronological order
- `options.weekStartsOn`: Weekday a week begins on, `0` Sunday through `6` Saturday
- `options.timeZone`: IANA zone whose calendar weeks the days are grouped by

**Returns:**

- Week buckets in the order their days appeared

**Example:**

```typescript
groupByWeek(daysOfYear(2026, "UTC"), { weekStartsOn: 0, timeZone: "UTC" }).length; // 53
```

### Day Keys

#### `toDayKey(date: Date, timeZone: TimeZone): string`

The `"YYYY-MM-DD"` key for the calendar day an instant falls on in a zone. The same instant yields different keys in different zones, which is the point: the key names a day on someone's calendar, not a moment in time.

**Example:**

```typescript
toDayKey(new Date("2026-07-29T02:00:00Z"), "UTC"); // "2026-07-29"
toDayKey(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // "2026-07-28"
```

#### `parseDayKey(key: string): Result<CalendarDay, InvalidDayKeyError>`

Reads a day key into its calendar fields, with no zone involved. Days that do not exist are rejected, so `"2026-02-30"` is a failure rather than a silent rollover into March.

**Returns:**

- A `Success<CalendarDay>` with `year`, `month` (1-12) and `day`, or a `Failure<InvalidDayKeyError>`

**Example:**

```typescript
let result = parseDayKey(params.day);
if (isFailure(result)) return badRequest();
```

#### `fromDayKey(key: string, timeZone: TimeZone): Result<Date, InvalidDayKeyError>`

The instant a day key's day starts at in a zone, the inverse of `toDayKey`. It returns a `Result` because the key is usually untrusted input, and a malformed one must not become an `Invalid Date`.

**Example:**

```typescript
let result = fromDayKey("2026-07-29", "America/New_York"); // 2026-07-29T04:00:00Z
```

#### `parseDate(input: string | number): Result<Date, InvalidDateError>`

Reads text or a timestamp into a `Date`, failing instead of producing an `Invalid Date`. Parsing is the platform's, so prefer full ISO 8601 input; other formats are implementation defined.

A date-only string such as `"2026-07-29"` is read as UTC midnight, which is a different instant in every other zone. Use `fromDayKey()` when the input names a day on someone's calendar.

**Example:**

```typescript
let result = parseDate(url.searchParams.get("from") ?? "");
if (isFailure(result)) return badRequest();
```

#### `InvalidDayKeyError`

Error describing text that is not a `"YYYY-MM-DD"` day key, either because the shape is wrong or because it names a day that does not exist. Returned inside a `Failure` and never thrown.

**Properties:**

- `text`: `string` - The rejected text, kept verbatim and untrimmed for diagnostics
- `name`: `string` - Always `"InvalidDayKeyError"`
- `message`: `string` - `Invalid day key: "<text>"`

#### `InvalidDateError`

Error describing input that does not name an instant. Returned inside a `Failure` and never thrown.

**Properties:**

- `input`: `string | number` - The rejected input, kept verbatim for diagnostics
- `name`: `string` - Always `"InvalidDateError"`
- `message`: `string` - `Invalid date: "<input>"`

### Types

#### `TimeZone`

```typescript
type TimeZone = string;
```

An IANA time zone name, e.g. `"America/New_York"` or `"UTC"`.

#### `Locale`

```typescript
type Locale = string | readonly string[];
```

A BCP 47 locale, or a preference list the platform resolves in order. Passed straight to `Intl`.

#### `Weekday`

```typescript
type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
```

A weekday index, `0` Sunday through `6` Saturday, matching `Date#getDay`. Used both for `weekStartsOn` and for the weekday a day falls on, so the two never need translating.

#### `CalendarDay`

```typescript
interface CalendarDay {
	year: number;
	month: number; // 1-12, not zero-based
	day: number;
}
```

A calendar day with no zone and no time attached: what a human reads off a wall calendar.

#### `Day`

```typescript
interface Day extends CalendarDay {
	date: Date; // the day's first instant in timeZone
	key: string; // "YYYY-MM-DD"
	weekday: Weekday;
	timeZone: TimeZone;
}
```

One cell of a day grid, with everything zone-dependent resolved once so a renderer never recomputes it.

#### `Interval`

```typescript
interface Interval {
	start: Date;
	end: Date;
}
```

A closed range of instants. Both ends are inclusive for day enumeration.

## Pattern: One Zone Per Request

Resolve the reader's zone once, at the edge, and pass it down. Every call site then reads as a statement about that reader's calendar instead of the server's.

```typescript
import { formatDate, lastNDays, toDayKey } from "@sdxc/dates";

function buildDashboard(preferences: { locale: string; timeZone: string }) {
	let { locale, timeZone } = preferences;

	return {
		today: toDayKey(new Date(), timeZone),
		heading: formatDate(new Date(), { locale, timeZone, dateStyle: "full" }),
		window: lastNDays(30, { timeZone }),
	};
}
```

## Pattern: Aggregating By Day

Group rows on the day key rather than on a truncated timestamp, so the aggregation is done in the reader's zone and the grid can look each day up in constant time.

```typescript
import { lastNDays, toDayKey } from "@sdxc/dates";

function summarize(events: { at: Date; ok: boolean }[], timeZone: string) {
	let failures = new Map<string, number>();

	for (let event of events) {
		if (event.ok) continue;
		let key = toDayKey(event.at, timeZone);
		failures.set(key, (failures.get(key) ?? 0) + 1);
	}

	return lastNDays(90, { timeZone }).map((day) => ({
		key: day.key,
		weekday: day.weekday,
		failures: failures.get(day.key) ?? 0,
	}));
}
```

## Pattern: Querying One Day's Rows

Turn a day into the half-open instant range a query needs, so a row at 23:59 local is included and a row at the next midnight is not.

```typescript
import { endOfDay, fromDayKey, startOfDay } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";

function dayRange(key: string, timeZone: string) {
	let result = fromDayKey(key, timeZone);
	if (isFailure(result)) return result;

	return {
		from: startOfDay(result.data, timeZone),
		to: endOfDay(result.data, timeZone),
	};
}
```

## Pattern: A Layout Intl Will Not Produce

When a design needs the pieces of a date in their own elements, compose `formatParts()` output instead of reaching for a pattern string. The order still comes from the locale, so it stays correct where the day precedes the month.

```typescript
import { formatParts } from "@sdxc/dates";

function dateCell(date: Date, locale: string, timeZone: string) {
	let parts = formatParts(date, { locale, timeZone, month: "short", day: "numeric" });
	let read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

	return { month: read("month"), day: read("day") };
}
```

## Related Packages

- [`@sdxc/duration`](/packages/duration) - The `DurationInput` type `add()`, `subtract()` and `formatDuration()` accept, and the conversion behind them
- [`@sdxc/result`](/packages/result) - The `Result` type the parsers return, and the `isFailure`/`unwrap` helpers for reading it

## Tips

1. **Pass the zone from the reader, not from the server** - A required argument only helps if the value is right; resolve the zone once per request and thread it through.
2. **Group on `toDayKey()`, never on a sliced ISO string** - `toISOString().slice(0, 10)` is the UTC day, which is the wrong day for most readers for part of every day.
3. **Reach for the zoned operation, not `addDays`, when you mean a calendar day** - `addDays` moves 24 hours; the day after a spring-forward Sunday is 23 hours away.
4. **Keep `weekStartsOn` a product decision** - It is a parameter because the locale's answer and the product's answer disagree often enough that inferring it produces the wrong grid.
5. **Format durations, not instants, with `formatDuration()`** - It words a length; `formatRelative()` words a distance from now, and mixing them up reads as "in 90 minutes" where "1 hour, 30 minutes" was meant.
6. **Pass `now` to `formatRelative()` and `elapsed()` in tests** - Both take the comparison instant as an argument, which is cheaper and clearer than freezing the clock.
7. **Compose `formatParts()` rather than asking for a pattern** - Anything `Intl` cannot express is a layout question, and layouts belong to the view rather than to this package.
8. **Let the parsers guard the boundary** - `parseDayKey()`, `fromDayKey()` and `parseDate()` return a `Result` so untrusted input becomes a failure at the edge instead of an `Invalid Date` that spreads `NaN`.
9. **Formatter instances are cached for you** - Every formatter here reuses one `Intl` object per locale and options pair, so calling them in a loop is fine; building your own inside a render is not.
