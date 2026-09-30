# @sdxc/dates

Calendar operations over the platform `Date`, with every human-facing string formatted by `Intl` and every time zone passed in explicitly.

## Installation

```bash
npm add @sdxc/dates
```

Durations are expressed with [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration), and the parsers return the `Result` value from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result). Both install alongside this package.

## Usage

### Formatting For A Reader

Every formatter takes the locale, and every formatter that renders an instant takes the zone.

```typescript
import { formatDate, formatDateTime, formatRelative, formatTime } from "@sdxc/dates";

let publishedAt = new Date("2026-07-29T10:00:00Z");
let locale = "en-US";
let timeZone = "America/New_York";
let now = new Date("2026-08-01T10:00:00Z");

formatDate(publishedAt, { locale, timeZone }); // "Jul 29, 2026"
formatTime(publishedAt, { locale, timeZone }); // "6:00 AM"
formatDateTime(publishedAt, { locale, timeZone }); // "Jul 29, 2026 at 6:00 AM"
formatRelative(publishedAt, { locale, now }); // "3 days ago"
```

### Calendar Operations

Operations that answer a calendar question take the zone as a required argument, so the answer is always about a stated calendar.

```typescript
import {
	addMonths,
	diffInDays,
	eachDayOfInterval,
	isSameDay,
	startOfDay,
	startOfMonth,
	toDayKey,
} from "@sdxc/dates";

let timeZone = "America/New_York";

startOfDay(new Date(), timeZone);
startOfMonth(new Date(), timeZone);
addMonths(new Date("2026-01-31T15:00:00Z"), 1, timeZone); // 2026-02-28, same wall-clock time
isSameDay(a, b, timeZone);
diffInDays(b, a, timeZone);
eachDayOfInterval({ start, end }, timeZone);
toDayKey(new Date("2026-07-29T02:00:00Z"), timeZone); // "2026-07-28"
```

### Instant Arithmetic

Operations that move an instant by a fixed length take no zone, because a length of time is the same length everywhere.

```typescript
import { add, addDays, elapsed, subtract } from "@sdxc/dates";

let expiresAt = add(new Date(), "30 days");
let retryAt = add(new Date(), "250ms");
let cutoff = subtract(new Date(), "1 hour");
let lastWeek = addDays(new Date(), -7);

let startedAt = Date.now();
await fetchUser(id);
console.log("finished", elapsed(startedAt)); // milliseconds
```

### A Day Grid

```typescript
import { formatWeekday, groupByWeek, lastNDays } from "@sdxc/dates";

let timeZone = "America/New_York";

let days = lastNDays(90, { timeZone });
let weeks = groupByWeek(days, { weekStartsOn: 0, timeZone });
let headers = [0, 1, 2, 3, 4, 5, 6].map((weekday) => formatWeekday(weekday, { locale: "en-US" }));

for (let week of weeks) {
	for (let day of week) render(day.key, countsByDay.get(day.key));
}
```

## API

### Formatting

#### `formatDate(date: Date, options: FormatDateOptions): string`

Renders the calendar date an instant falls on, in a zone. `dateStyle` defaults to `"medium"`.

```typescript
formatDate(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026"
formatDate(date, { locale: "es-AR", timeZone: "UTC", dateStyle: "long" }); // "29 de julio de 2026"
```

```typescript
formatDate(date, { locale, timeZone });
// same as
new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium" }).format(date);
```

Every formatter below reuses one cached `Intl` instance per locale and options pair, so the shorthand also skips rebuilding the formatter on each call.

#### `formatTime(date: Date, options: FormatTimeOptions): string`

Renders the time of day an instant reads as on a clock in a zone. `timeStyle` defaults to `"short"`.

```typescript
formatTime(date, { locale, timeZone });
// same as
new Intl.DateTimeFormat(locale, { timeZone, timeStyle: "short" }).format(date);
```

#### `formatDateTime(date: Date, options: FormatDateTimeOptions): string`

Renders an instant as a date and a time of day, joined the way the locale joins them. `dateStyle` defaults to `"medium"` and `timeStyle` to `"short"`.

```typescript
formatDateTime(date, { locale: "en-US", timeZone: "UTC" }); // "Jul 29, 2026 at 10:00 AM"
```

```typescript
formatDateTime(date, { locale, timeZone });
// same as
new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);
```

#### `formatRange(start: Date, end: Date, options: FormatRangeOptions): string`

Renders the span between two instants as one range, collapsing whatever the two ends share. The time half appears once `timeStyle` is given.

```typescript
formatRange(start, end, { locale: "en-US", timeZone: "UTC" }); // "Jul 29 – 31, 2026"
```

```typescript
formatRange(start, end, { locale, timeZone });
// same as
new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium" }).formatRange(start, end);
```

#### `formatRelative(date: Date, options: FormatRelativeOptions): string`

Words the distance from now to an instant, picking the largest unit that still rounds to a whole number. `now` defaults to the current time, `numeric` to `"auto"` so the locale may say "yesterday", and `style` to `"long"`.

```typescript
formatRelative(yesterday, { locale: "en-US", now }); // "yesterday"
formatRelative(yesterday, { locale: "en-US", now, numeric: "always" }); // "1 day ago"
```

`Intl` words a value and a unit you have already chosen; picking that pair from two instants is what this adds. Once it has them, the wording is `Intl`'s:

```typescript
formatRelative(threeDaysAgo, { locale, now });
// measures the distance, picks the unit, then words it as
new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "long" }).format(-3, "day");
```

#### `formatDuration(input: DurationInput, options: FormatDurationOptions): string`

Words a length of time, skipping zero-valued components. `style` defaults to `"long"`, and `maxUnits` keeps only that many components, largest first.

```typescript
formatDuration("90 minutes", { locale: "en-US" }); // "1 hour, 30 minutes"
formatDuration("90 minutes", { locale: "en-US", style: "short" }); // "1 hr, 30 min"
formatDuration(5_400_000, { locale: "en-US", maxUnits: 1 }); // "1 hour"
```

#### `formatParts(date: Date, options: FormatPartsOptions): Intl.DateTimeFormatPart[]`

Breaks an instant into its localized pieces, each tagged with what it is, for a layout composed by the caller. Beyond the required `locale` and `timeZone`, it accepts any `Intl.DateTimeFormatOptions` field, and the parts come back in the locale's own order.

```typescript
formatParts(date, { locale: "en-US", timeZone: "UTC", month: "long", day: "numeric" });
// [{ type: "month", value: "July" }, { type: "literal", value: " " }, { type: "day", value: "29" }]
```

```typescript
formatParts(date, { locale, timeZone, month: "long", day: "numeric" });
// same as
new Intl.DateTimeFormat(locale, { timeZone, month: "long", day: "numeric" }).formatToParts(date);
```

#### `formatWeekday(weekday: Weekday, options: FormatWeekdayOptions): string`

The localized name of a weekday on its own, for a grid header. `style` defaults to `"short"`.

```typescript
formatWeekday(1, { locale: "en-US" }); // "Mon"
formatWeekday(0, { locale: "es-AR", style: "long" }); // "domingo"
```

### Zoned Operations

#### `startOfDay(date: Date, timeZone: TimeZone): Date`

The first instant of the calendar day an instant falls on, in a zone. On a day whose DST transition skips midnight it is the first instant that exists that day.

```typescript
startOfDay(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // 2026-07-28T04:00:00Z
```

#### `endOfDay(date: Date, timeZone: TimeZone): Date`

The last instant of that calendar day, one millisecond before the next day starts, so it stays correct on days that are 23 or 25 hours long.

#### `startOfWeek(date: Date, timeZone: TimeZone, options: StartOfWeekOptions): Date`

The first instant of the week an instant falls in. `weekStartsOn` is required, `0` Sunday through `6` Saturday.

```typescript
startOfWeek(date, "UTC", { weekStartsOn: 1 }); // Monday-based week
```

#### `startOfMonth(date: Date, timeZone: TimeZone): Date`

The first instant of the calendar month an instant falls in, in a zone. When DST skips midnight on the 1st it is the first instant that exists that day.

```typescript
startOfMonth(new Date("2026-07-01T02:00:00Z"), "UTC"); // 2026-07-01T00:00:00Z
startOfMonth(new Date("2026-07-01T02:00:00Z"), "America/New_York"); // 2026-06-01T04:00:00Z
```

#### `endOfMonth(date: Date, timeZone: TimeZone): Date`

The last instant of that calendar month, one millisecond before the next month starts, the same closed-range convention as `endOfDay`.

```typescript
endOfMonth(new Date("2026-02-10T12:00:00Z"), "America/New_York"); // 2026-03-01T04:59:59.999Z
```

#### `startOfQuarter(date: Date, timeZone: TimeZone): Date`

The first instant of the calendar quarter an instant falls in: the start of January, April, July or October in that zone.

```typescript
startOfQuarter(new Date("2026-08-15T12:00:00Z"), "UTC"); // 2026-07-01T00:00:00Z
```

#### `endOfQuarter(date: Date, timeZone: TimeZone): Date`

The last instant of that calendar quarter, one millisecond before the next quarter starts.

```typescript
endOfQuarter(new Date("2026-08-15T12:00:00Z"), "America/New_York"); // 2026-10-01T03:59:59.999Z
```

#### `addMonths(date: Date, count: number, timeZone: TimeZone): Date`

Moves an instant by calendar months in a zone, keeping its wall-clock time of day. The day clamps to the target month's last day, so January 31st plus one month is February 28th or 29th, and negative counts move back. A time DST skips or repeats on the target day resolves as `instantFromParts` does.

```typescript
addMonths(new Date("2026-01-31T15:00:00Z"), 1, "America/New_York"); // 2026-02-28T15:00:00Z
addMonths(new Date("2026-03-01T15:00:00Z"), 1, "America/New_York"); // 2026-04-01T14:00:00Z, still 10:00 local
```

#### `daysInMonth(year: number, month: number): number`

How many days a month has, `month` counted `1` through `12`. It takes no zone, reads years 0 to 99 literally, and returns `NaN` for a month outside the calendar.

```typescript
daysInMonth(2024, 2); // 29
daysInMonth(2026, 2); // 28
```

```typescript
daysInMonth(year, month);
// same as, for years from 100 on
new Date(Date.UTC(year, month, 0)).getUTCDate();
```

#### `isValidTimeZone(timeZone: string): boolean`

Whether the runtime's `Intl` accepts a zone name. Every function here that takes a zone lets `Intl` throw a `RangeError` for one it rejects, so check a zone from a cookie, header or form once at the boundary. Answers are cached per name.

```typescript
isValidTimeZone("America/New_York"); // true
isValidTimeZone("Mars/Olympus_Mons"); // false
```

#### `diffInDays(a: Date, b: Date, timeZone: TimeZone): number`

Calendar days from `b` to `a`: the count of day boundaries crossed, positive when `a` is on a later day.

```typescript
diffInDays(new Date("2026-07-30T01:00:00Z"), new Date("2026-07-29T23:00:00Z"), "UTC"); // 1
```

#### `isSameDay(a: Date, b: Date, timeZone: TimeZone): boolean`

Whether two instants fall on the same year, month and day in a zone. The same pair can be one day in one zone and two in another.

#### `eachDayOfInterval(interval: Interval, timeZone: TimeZone): Date[]`

Every calendar day touched by an inclusive interval, as the instant each day starts at. Returns an empty array when `end` falls on a day before `start`.

### Instant Arithmetic

#### `addDays(date: Date, count: number): Date`

Moves an instant forward by whole 24-hour days, returning a new `Date`. Negative counts move back.

```typescript
addDays(date, 3);
// same as
new Date(date.getTime() + 3 * 86_400_000);
```

#### `subDays(date: Date, count: number): Date`

Moves an instant back by whole 24-hour days, with the same instant semantics as `addDays`.

```typescript
subDays(date, 3);
// same as
new Date(date.getTime() - 3 * 86_400_000);
```

#### `add(date: Date, duration: DurationInput): Date`

Moves an instant forward by a duration string or a number of milliseconds.

```typescript
add(new Date("2026-07-29T10:00:00Z"), "90 minutes"); // 2026-07-29T11:30:00Z
```

```typescript
add(date, "90 minutes");
// same as
new Date(date.getTime() + 90 * 60 * 1000);
```

#### `subtract(date: Date, duration: DurationInput): Date`

Moves an instant back by a duration string or a number of milliseconds.

```typescript
subtract(date, "30 minutes");
// same as
new Date(date.getTime() - 30 * 60 * 1000);
```

#### `elapsed(since: Date | number, now?: Date | number): number`

Milliseconds between an instant and now, positive once the instant is in the past. `now` defaults to the current time, and a test supplies both ends.

```typescript
elapsed(new Date("2026-07-29T10:00:00Z"), new Date("2026-07-29T10:00:05Z")); // 5000
```

```typescript
let startedAt = Date.now();
elapsed(startedAt);
// same as
Date.now() - startedAt;
```

#### `toUnixSeconds(date: Date | number): number`

Whole seconds since the epoch, floored toward the past: the NumericDate a JWT's `iat` and `exp` claims carry.

```typescript
toUnixSeconds(new Date("2026-07-29T10:00:00.999Z")); // 1785319200
```

```typescript
toUnixSeconds(date);
// same as
Math.floor(date.getTime() / 1000);
```

#### `fromUnixSeconds(seconds: number): Date`

The instant a count of seconds since the epoch names, the inverse of `toUnixSeconds`.

```typescript
fromUnixSeconds(seconds);
// same as
new Date(seconds * 1000);
```

### Day Grids

#### `daysOfYear(year: number, timeZone: TimeZone): Day[]`

Every day of a calendar year in a zone, in chronological order.

```typescript
daysOfYear(2024, "UTC").length; // 366
```

#### `lastNDays(count: number, options: LastNDaysOptions): Day[]`

A rolling window of the last `count` calendar days, ending on the day `from` falls on and including it. `from` defaults to the current instant, and the window stays exactly `count` entries long across a DST transition.

#### `groupByWeek(days: Day[], options: GroupByWeekOptions): Day[][]`

Buckets a chronological day list into weeks, one array per week. The first and last buckets stay short when the range starts or ends mid-week.

```typescript
groupByWeek(daysOfYear(2026, "UTC"), { weekStartsOn: 0, timeZone: "UTC" }).length; // 53
```

### Day Keys

#### `toDayKey(date: Date, timeZone: TimeZone): string`

The `"YYYY-MM-DD"` key for the calendar day an instant falls on in a zone, zero padded. Group and join aggregations on it.

```typescript
toDayKey(new Date("2026-07-29T02:00:00Z"), "UTC"); // "2026-07-29"
toDayKey(new Date("2026-07-29T02:00:00Z"), "America/New_York"); // "2026-07-28"
```

#### `parseDayKey(key: string): Result<CalendarDay, InvalidDayKeyError>`

Reads a day key into its calendar fields, with no zone involved. A day that does not exist on its month is rejected.

```typescript
parseDayKey("2026-07-29"); // { status: "success", data: { year: 2026, month: 7, day: 29 } }
parseDayKey("2026-02-30"); // { status: "failure", error: InvalidDayKeyError }
```

#### `fromDayKey(key: string, timeZone: TimeZone): Result<Date, InvalidDayKeyError>`

The instant a day key's day starts at in a zone, the inverse of `toDayKey`.

```typescript
fromDayKey("2026-07-29", "America/New_York"); // { status: "success", data: 2026-07-29T04:00:00Z }
```

#### `parseDate(input: string | number): Result<Date, InvalidDateError>`

Reads text or a millisecond timestamp into a `Date`, failing rather than producing an `Invalid Date`. A date-only string is read as UTC midnight; use `fromDayKey()` when the input names a calendar day.

```typescript
parseDate("2026-07-29T10:00:00Z"); // { status: "success", data: Date }
parseDate("not a date"); // { status: "failure", error: InvalidDateError }
```

#### `InvalidDayKeyError`

The error `parseDayKey()` and `fromDayKey()` report, with the rejected text on `error.text`.

#### `InvalidDateError`

The error `parseDate()` reports, with the rejected value on `error.input`.

### Form Values

#### `toDateTimeLocal(date: Date, timeZone: TimeZone): string`

The value an `<input type="datetime-local">` takes, `"YYYY-MM-DDTHH:mm"`, as a clock in the zone reads the instant. Seconds are dropped to match the input's default one-minute step.

```typescript
toDateTimeLocal(new Date("2026-07-29T14:30:00Z"), "America/New_York"); // "2026-07-29T10:30"
```

#### `parseDateTimeLocal(value: string, timeZone: TimeZone): Result<Date, InvalidDateTimeLocalError>`

Reads a submitted `datetime-local` value as the instant it names in a zone. Optional seconds and a one-to-three-digit fraction are accepted, since browsers submit them when `step` is below a minute. A day the month lacks or a time past `23:59:59` is rejected, and a time DST skips or repeats resolves as `instantFromParts` does.

```typescript
parseDateTimeLocal("2026-07-29T10:30", "America/New_York"); // { status: "success", data: 2026-07-29T14:30:00Z }
parseDateTimeLocal("2026-02-30T10:00", "UTC"); // { status: "failure", error: InvalidDateTimeLocalError }
```

#### `InvalidDateTimeLocalError`

The error `parseDateTimeLocal()` reports, with the rejected text on `error.text`.

### Zone Math

The conversions every operation above is built on, on their own subpath for code that works with wall clocks directly, such as a calendar format reader.

```typescript
import { instantFromParts, zonedParts } from "@sdxc/dates/zone";

zonedParts(Date.UTC(2026, 6, 29, 2), "America/New_York"); // { year: 2026, month: 7, day: 28, hour: 22, ... }
instantFromParts(
	{ year: 2026, month: 3, day: 8, hour: 2, minute: 30, second: 0, millisecond: 0 },
	"America/New_York",
); // 2026-03-08T07:30:00Z, the skipped 02:30 read with the offset before the gap
```

#### `zonedParts(instant: number, timeZone: TimeZone): ZonedParts`

The wall clock a zone shows at an instant: calendar day, hour, minute, second and millisecond.

#### `instantFromParts(parts: ZonedParts, timeZone: TimeZone): number`

The instant a wall clock names in a zone. A repeated hour resolves to its earlier instant, and a skipped one is read with the offset before the gap, which moves it forward by the gap's length: the rule RFC 5545 gives for local times.

#### `offsetMsAt(instant: number, timeZone: TimeZone): number`

The zone's offset from UTC at an instant, in milliseconds to add to UTC; negative west of Greenwich.

#### `utcFromParts(parts: ZonedParts): number`

Wall-clock fields read as if they were UTC, with years 0 to 99 kept literal.

#### `calendarDayAt(instant: number, timeZone: TimeZone): CalendarDay`

The calendar day an instant falls on in a zone.

#### `startOfDayInstant(day: CalendarDay, timeZone: TimeZone): number`

The first instant of a calendar day in a zone: midnight, or the first instant that exists when DST skips midnight.

#### `epochDayOf(day: CalendarDay): number`, `calendarDayFromEpochDay(epochDay: number): CalendarDay`

A calendar day as whole days since 1970-01-01 and back, for DST-proof day differences and iteration.

#### `shiftCalendarDay(day: CalendarDay, count: number): CalendarDay`

A calendar day moved by whole days, rolling over months and years.

#### `shiftCalendarMonth(day: CalendarDay, count: number): CalendarDay`

A calendar day moved by whole months, rolling over years and clamping the day to the target month's last day.

```typescript
shiftCalendarMonth({ year: 2024, month: 1, day: 31 }, 1); // { year: 2024, month: 2, day: 29 }
```

#### `weekdayOf(day: CalendarDay): Weekday`

The weekday a calendar day falls on, `0` Sunday through `6` Saturday.

#### `DAY_MS`

`86_400_000`, one exact 24-hour day in milliseconds.

#### `ZonedParts`

```typescript
interface ZonedParts extends CalendarDay {
	hour: number; // 0-23
	minute: number;
	second: number;
	millisecond: number;
}
```

The subpath also exports `daysInMonth` and `isValidTimeZone`, and re-exports `CalendarDay`, `TimeZone` and `Weekday`.

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

A weekday index, `0` Sunday through `6` Saturday, matching `Date#getDay`. Used both for `weekStartsOn` and for the weekday a day falls on.

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

#### `DateStyle`, `TimeStyle`

The `dateStyle` and `timeStyle` lengths from `Intl.DateTimeFormat`: `"full" | "long" | "medium" | "short"`.

#### Options

`FormatDateOptions`, `FormatTimeOptions`, `FormatDateTimeOptions`, `FormatRangeOptions`, `FormatRelativeOptions`, `FormatDurationOptions`, `FormatPartsOptions`, `FormatWeekdayOptions`, `StartOfWeekOptions`, `LastNDaysOptions` and `GroupByWeekOptions` are exported for callers that pass options through their own signatures.

#### Errors

`InvalidDateError`, `InvalidDayKeyError` and `InvalidDateTimeLocalError` are the classes the parsers return inside a `Failure`, each carrying the rejected input.

## Pattern: One Zone Per Request

Resolve the reader's zone once, at the edge, and pass it down. Every call site below then reads as a statement about that reader's calendar instead of the server's.

```typescript
import { formatDate, lastNDays, toDayKey } from "@sdxc/dates";

function buildView(preferences: { locale: string; timeZone: string }) {
	let { locale, timeZone } = preferences;

	return {
		today: toDayKey(new Date(), timeZone),
		heading: formatDate(new Date(), { locale, timeZone, dateStyle: "full" }),
		window: lastNDays(30, { timeZone }),
	};
}
```

## Pattern: Aggregating By Day

Group rows on the day key rather than on a truncated timestamp, so the buckets land on the reader's calendar and the grid looks each day up in constant time.

```typescript
import { lastNDays, toDayKey } from "@sdxc/dates";

function ordersPerDay(orders: { placedAt: Date }[], timeZone: string) {
	let counts = new Map<string, number>();

	for (let order of orders) {
		let key = toDayKey(order.placedAt, timeZone);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return lastNDays(90, { timeZone }).map((day) => ({
		key: day.key,
		weekday: day.weekday,
		orders: counts.get(day.key) ?? 0,
	}));
}
```

## Pattern: Querying One Day's Rows

Turn a day into the pair of instants a query filters on. The range is closed: `endOfDay()` is the day's last millisecond in that zone, so a row at 23:59 local is included and one at the next midnight is not. `fromDayKey()` returns a `Result` because a key usually arrives from a URL.

```typescript
import { endOfDay, fromDayKey, startOfDay } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";

function boundsForDate(date: Date, timeZone: string) {
	return { from: startOfDay(date, timeZone), to: endOfDay(date, timeZone) };
}

function boundsForKey(key: string, timeZone: string) {
	let start = fromDayKey(key, timeZone);
	if (isFailure(start)) return start;
	return { from: start.data, to: endOfDay(start.data, timeZone) };
}
```

## Pattern: A datetime-local Field In The Reader's Zone

The input shows and submits a wall clock with no zone, so pre-fill it and read it back in the same zone the reader sees. The zone usually comes from a cookie, so it is checked before use, and `parseDateTimeLocal()` returns a `Result` because the value arrives from a form.

```typescript
import { isValidTimeZone, parseDateTimeLocal, toDateTimeLocal } from "@sdxc/dates";

function eventFormValues(event: { startsAt: Date }, timeZone: string) {
	return { startsAt: toDateTimeLocal(event.startsAt, timeZone) }; // the input's value attribute
}

function readEventForm(form: FormData, timeZone: string) {
	let zone = isValidTimeZone(timeZone) ? timeZone : "UTC";
	return parseDateTimeLocal(String(form.get("startsAt") ?? ""), zone);
}
```

## Pattern: A Layout Intl Will Not Produce

When a design needs the pieces of a date in their own elements, compose `formatParts()` output instead of reaching for a pattern string. Each part is tagged with what it is, and they arrive in the locale's own order, so rendering them in order stays correct where the day precedes the month.

```typescript
import { formatParts } from "@sdxc/dates";

function stackedDate(date: Date, locale: string, timeZone: string) {
	let parts = formatParts(date, { locale, timeZone, month: "short", day: "numeric" });
	let read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

	return { month: read("month"), day: read("day") };
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/dates": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
