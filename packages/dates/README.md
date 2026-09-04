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
import { diffInDays, eachDayOfInterval, isSameDay, startOfDay, toDayKey } from "@sdxc/dates";

let timeZone = "America/New_York";

startOfDay(new Date(), timeZone);
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
