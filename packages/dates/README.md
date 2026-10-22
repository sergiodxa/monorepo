# @sdxc/dates

Zone-aware date operations over the platform `Date`, with every human-facing string formatted by `Intl`.

Every operation that answers a calendar question takes its time zone as an argument, and every formatter takes its locale, so a result is always about a stated reader rather than the server's clock.

## Installation

```sh
npm add @sdxc/dates
```

Durations are written with [`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration), and the parsers return a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result); both install alongside this package.

## Usage

### Format for a reader

```typescript
import { formatDate, formatDateTime, formatRelative, formatTime } from "@sdxc/dates";

let publishedAt = new Date("2026-07-29T10:00:00Z");
let now = new Date("2026-08-01T10:00:00Z");
let locale = "en-US";
let timeZone = "America/New_York";

formatDate(publishedAt, { locale, timeZone }); // "Jul 29, 2026"
formatTime(publishedAt, { locale, timeZone }); // "6:00 AM"
formatDateTime(publishedAt, { locale, timeZone }); // "Jul 29, 2026 at 6:00 AM"
formatRelative(publishedAt, { locale, now }); // "3 days ago"
```

### Ask a calendar question in a zone

```typescript
import { addMonths, diffInDays, isSameDay, startOfDay, toDayKey } from "@sdxc/dates";

let timeZone = "America/New_York";
let instant = new Date("2026-07-29T02:00:00Z");

toDayKey(instant, timeZone); // "2026-07-28", the day a New York clock shows
startOfDay(instant, timeZone); // 2026-07-28T04:00:00Z
addMonths(new Date("2026-01-31T15:00:00Z"), 1, timeZone); // 2026-02-28T15:00:00Z
isSameDay(instant, new Date("2026-07-28T12:00:00Z"), timeZone); // true
diffInDays(new Date("2026-07-30T12:00:00Z"), instant, timeZone); // 2
```

### Move an instant by a length of time

A length of time is the same everywhere, so these take no zone.

```typescript
import { add, addDays, elapsed, subtract, toUnixSeconds } from "@sdxc/dates";

let expiresAt = add(new Date(), "30 days");
let cutoff = subtract(new Date(), "1 hour");
let lastWeek = addDays(new Date(), -7);
let exp = toUnixSeconds(expiresAt); // a JWT `exp` claim

let startedAt = Date.now();
await doWork();
let tookMs = elapsed(startedAt);
```

### Read untrusted input

Parsers return a `Result` instead of throwing or producing an `Invalid Date`.

```typescript
import { fromDayKey, isValidTimeZone, parseDate } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";

function readInput(input: { day: string; sentAt: string; timeZone: string }) {
	let timeZone = isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";

	let day = fromDayKey(input.day, timeZone); // "2026-07-29" → the day's first instant
	if (isFailure(day)) return day; // day.error.text is the rejected key

	let sentAt = parseDate(input.sentAt);
	if (isFailure(sentAt)) return sentAt;

	return { day: day.data, sentAt: sentAt.data };
}
```

## API

### Formatting

Formatters reuse one cached `Intl` instance per locale and options.

#### `formatDate(date: Date, options: FormatDateOptions): string`

The calendar date an instant falls on in `options.timeZone`; `dateStyle` defaults to `"medium"`.

```typescript
formatDate(date, { locale, timeZone });
// same as
new Intl.DateTimeFormat(locale, { timeZone, dateStyle: "medium" }).format(date);
```

#### `formatTime(date: Date, options: FormatTimeOptions): string`

The time of day a clock in the zone shows; `timeStyle` defaults to `"short"`.

#### `formatDateTime(date: Date, options: FormatDateTimeOptions): string`

A date and a time joined the way the locale joins them; `dateStyle` defaults to `"medium"`, `timeStyle` to `"short"`.

#### `formatRange(start: Date, end: Date, options: FormatRangeOptions): string`

The span between two instants, collapsing what both ends share (`"Jul 29 – 31, 2026"`), through `Intl.DateTimeFormat#formatRange`. The time half appears when `timeStyle` is given.

#### `formatRelative(date: Date, options: FormatRelativeOptions): string`

Words the distance from `now` (default: the current time) to `date`, picking the largest unit that rounds to a whole number, then wording it with `Intl.RelativeTimeFormat`. `numeric` defaults to `"auto"` (so "yesterday"; `"always"` gives "1 day ago") and `style` to `"long"`.

#### `formatDuration(input: DurationInput, options: FormatDurationOptions): string`

Words a duration string or millisecond count, skipping zero components. `style` is `"long"` (default), `"short"` or `"narrow"`; `maxUnits` keeps that many components, largest first.

```typescript
formatDuration("90 minutes", { locale: "en-US" }); // "1 hour, 30 minutes"
formatDuration(5_400_000, { locale: "en-US", style: "short", maxUnits: 1 }); // "1 hr"
```

#### `formatParts(date: Date, options: FormatPartsOptions): Intl.DateTimeFormatPart[]`

The localized pieces of an instant, tagged and in the locale's order, for a layout the caller composes. Takes `locale`, `timeZone` and any other `Intl.DateTimeFormatOptions` field.

#### `formatWeekday(weekday: Weekday, options: FormatWeekdayOptions): string`

A weekday's localized name, for a grid header; `style` defaults to `"short"` (`formatWeekday(1, { locale: "en-US" })` is `"Mon"`).

### Calendar operations

All take the zone whose calendar the answer is about. A day, month or quarter ends one millisecond before the next one starts, so a closed range stays exact on 23- and 25-hour days, and a start falls on the first instant that exists when DST skips midnight.

#### `startOfDay(date, timeZone)`, `endOfDay(date, timeZone)`

The first and last instant of the calendar day `date` falls on.

#### `startOfWeek(date: Date, timeZone: TimeZone, options: StartOfWeekOptions): Date`

The first instant of the week `date` falls in; `options.weekStartsOn` is required.

#### `startOfMonth(date, timeZone)`, `endOfMonth(date, timeZone)`

The first and last instant of the calendar month `date` falls in.

#### `startOfQuarter(date, timeZone)`, `endOfQuarter(date, timeZone)`

The first and last instant of the calendar quarter, which opens in January, April, July or October.

#### `addMonths(date: Date, count: number, timeZone: TimeZone): Date`

Moves by calendar months keeping the wall-clock time, clamping the day to the target month (January 31st plus one is February 28th or 29th). Negative counts move back.

#### `diffInDays(a: Date, b: Date, timeZone: TimeZone): number`

Calendar day boundaries crossed from `b` to `a`, positive when `a` is on a later day.

#### `isSameDay(a: Date, b: Date, timeZone: TimeZone): boolean`

Whether both instants fall on the same calendar day in the zone.

#### `eachDayOfInterval(interval: Interval, timeZone: TimeZone): Date[]`

The start of every day an inclusive interval touches, or `[]` when `end` is on an earlier day than `start`.

#### `daysInMonth(year: number, month: number): number`

Days in a month counted `1` through `12`, with no zone involved.

### Instant arithmetic

#### `add(date: Date, duration: DurationInput): Date`, `subtract(date, duration)`

Moves an instant by a duration string (`"90 minutes"`) or a millisecond count.

#### `addDays(date: Date, count: number): Date`, `subDays(date, count)`

Moves an instant by whole 24-hour days: `new Date(date.getTime() + count * 86_400_000)`.

#### `elapsed(since: Date | number, now?: Date | number): number`

Milliseconds from `since` to `now` (default: the current time), positive once `since` is past.

#### `toUnixSeconds(date: Date | number): number`, `fromUnixSeconds(seconds: number): Date`

Whole seconds since the epoch, floored, as JWT `iat` and `exp` claims carry them, and back.

### Day grids

A `Day` carries its key, weekday, first instant and zone, resolved once for a renderer.

#### `daysOfYear(year: number, timeZone: TimeZone): Day[]`

Every day of a calendar year, in order.

#### `lastNDays(count: number, options: LastNDaysOptions): Day[]`

The last `count` days ending on, and including, the day `options.from` (default: now) falls on.

#### `groupByWeek(days: Day[], options: GroupByWeekOptions): Day[][]`

Buckets a chronological day list into weeks starting on `options.weekStartsOn`; the first and last weeks stay short when the list starts or ends mid-week.

#### `monthGrid(date: Date, options: GroupByWeekOptions): MonthGridDay[][]`

The month of `date` as six full weeks, padded with neighbouring days marked `inMonth: false`, so every month renders at the same height.

### Day keys and parsing

#### `toDayKey(date: Date, timeZone: TimeZone): string`

The `"YYYY-MM-DD"` key of the day an instant falls on: the value to group, join and put in URLs.

#### `parseDayKey(key: string): Result<CalendarDay, InvalidDayKeyError>`

A day key read into its calendar fields; a day the month lacks fails.

#### `fromDayKey(key: string, timeZone: TimeZone): Result<Date, InvalidDayKeyError>`

The first instant of a day key's day in the zone, the inverse of `toDayKey`.

#### `parseDate(input: string | number): Result<Date, InvalidDateError>`

Text or a millisecond timestamp read into a `Date`. A date-only string reads as UTC midnight, so use `fromDayKey()` for a calendar day.

#### `toDateTimeLocal(date: Date, timeZone: TimeZone): string`

The `"YYYY-MM-DDTHH:mm"` value an `<input type="datetime-local">` takes, as a clock in the zone reads the instant.

#### `parseDateTimeLocal(value: string, timeZone: TimeZone): Result<Date, InvalidDateTimeLocalError>`

A submitted `datetime-local` value read as the instant it names in the zone. Seconds and fractions are accepted; impossible days and times fail.

### Day ranges

A `DayRange` is two inclusive day keys, so it travels through a URL or form as written.

#### `monthRange(date, timeZone)`, `quarterRange(date, timeZone)`, `yearToDateRange(date, timeZone)`

The calendar month or quarter `date` falls in, or January 1st through the day `date` falls on.

#### `lastNDaysRange(count: number, options: LastNDaysOptions): DayRange`

The same window as `lastNDays()`, as a range.

#### `dayRangeLength(range: DayRange): number`

Days covered, both ends counted, or `NaN` when an end names no real day.

#### `isWholeMonth(range: DayRange): boolean`

Whether the range is exactly one month, first day through last.

#### `validateDayRange(range: DayRange, options?: ValidateDayRangeOptions): Result<DayRange, InvalidDayRangeError>`

Fails with the first rule the range breaks on `error.problem`: `"invalid"` (an end is not an exact day key), `"reversed"`, `"tooLate"` (`to` after `options.latest`, a day key) or `"tooLong"` (more than `options.maxDays` days).

### Time zones

#### `isValidTimeZone(timeZone: string): boolean`

Whether `Intl` accepts the zone name. Every function taking a zone throws a `RangeError` on one it rejects, so check zones from cookies, headers or forms once.

#### `supportedTimeZones(): readonly TimeZone[]`

The runtime's IANA zones from `Intl.supportedValuesOf("timeZone")`, `"UTC"` first and always present.

#### `isSupportedTimeZone(value: string): boolean`

Whether a value is in `supportedTimeZones()`. Aliases such as `"Etc/UTC"` fail, so a stored zone keeps one spelling.

#### `timeZonesByRegion(): readonly TimeZoneGroup[]`

The supported zones grouped by IANA area (`"America"`, `"Europe"`, ...); `"UTC"` sits in no group.

#### `systemTimeZone(): TimeZone`

The runtime clock's zone: the browser's setting on a page, usually `"UTC"` on a server.

### Errors

`InvalidDateError` (rejected value on `error.input`), `InvalidDayKeyError` and `InvalidDateTimeLocalError` (on `error.text`), and `InvalidDayRangeError` (`error.problem` and `error.range`) are the classes the parsers return inside a failure.

### `@sdxc/dates/zone`

The wall-clock math the operations above are built on, for code that reads or writes wall clocks directly. It also exports `daysInMonth`, `isValidTimeZone`, and the `CalendarDay`, `TimeZone` and `Weekday` types.

- `zonedParts(instant: number, timeZone): ZonedParts`: the wall clock a zone shows at an instant.
- `instantFromParts(parts: ZonedParts, timeZone): number`: the instant a wall clock names. A repeated hour resolves to its earlier instant; a skipped one reads with the offset before the gap (RFC 5545). `addMonths()` and `parseDateTimeLocal()` resolve the same way.
- `offsetMsAt(instant: number, timeZone): number`: the offset to add to UTC, negative west of Greenwich.
- `utcFromParts(parts: ZonedParts): number`: wall-clock fields read as UTC.
- `calendarDayAt(instant: number, timeZone): CalendarDay` and `startOfDayInstant(day: CalendarDay, timeZone): number`.
- `epochDayOf(day: CalendarDay): number` and `calendarDayFromEpochDay(epochDay: number): CalendarDay`: days since 1970-01-01, for DST-proof differences.
- `shiftCalendarDay(day, count)` and `shiftCalendarMonth(day, count)`: move a `CalendarDay`, the month shift clamping the day.
- `weekdayOf(day: CalendarDay): Weekday`.
- `DAY_MS`: `86_400_000`.

### Types

- `TimeZone`: an IANA zone name, `string`.
- `Locale`: `string | readonly string[]`, passed straight to `Intl`.
- `Weekday`: `0 | 1 | 2 | 3 | 4 | 5 | 6`, Sunday first, matching `Date#getDay`.
- `CalendarDay`: `{ year, month, day }`, `month` counted `1` through `12`.
- `Day`: a `CalendarDay` plus `date` (its first instant), `key`, `weekday` and `timeZone`.
- `MonthGridDay`: a `Day` plus `inMonth`.
- `ZonedParts` (from `./zone`): a `CalendarDay` plus `hour`, `minute`, `second` and `millisecond`.
- `Interval`: `{ start: Date; end: Date }`, both inclusive.
- `DayRange`: `{ from: string; to: string }`, inclusive day keys.
- `DayRangeProblem`: `"invalid" | "reversed" | "tooLate" | "tooLong"`.
- `TimeZoneGroup`: `{ region: string; zones: readonly TimeZone[] }`.
- `DateStyle`, `TimeStyle`: `"full" | "long" | "medium" | "short"`.
- Every options interface named in a signature above is exported.

## Pattern: Activity Per Day Over A Week Grid

Bucket rows on the reader's day key, then lay the window out as weeks with localized headers.

```typescript
import type { Weekday } from "@sdxc/dates";

import { formatWeekday, groupByWeek, lastNDays, toDayKey } from "@sdxc/dates";

function activityGrid(events: { at: Date }[], locale: string, timeZone: string) {
	let counts = new Map<string, number>();
	for (let event of events) {
		let key = toDayKey(event.at, timeZone);
		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	let order: Weekday[] = [1, 2, 3, 4, 5, 6, 0];
	let days = lastNDays(90, { timeZone });

	return {
		headers: order.map((weekday) => formatWeekday(weekday, { locale })),
		weeks: groupByWeek(days, { weekStartsOn: 1, timeZone }).map((week) =>
			week.map((day) => ({ key: day.key, count: counts.get(day.key) ?? 0 })),
		),
	};
}
```

## Pattern: A Month Calendar

Page through months with `addMonths()` and render each as the same six-week grid.

```typescript
import { addMonths, formatDate, monthGrid, toDayKey } from "@sdxc/dates";

function calendar(month: Date, offset: number, locale: string, timeZone: string) {
	let shown = addMonths(month, offset, timeZone);
	let today = toDayKey(new Date(), timeZone);

	return {
		title: formatDate(shown, { locale, timeZone, dateStyle: "long" }),
		weeks: monthGrid(shown, { weekStartsOn: 0, timeZone }).map((week) =>
			week.map((day) => ({
				key: day.key,
				label: day.day,
				muted: !day.inMonth,
				today: day.key === today,
			})),
		),
	};
}
```

## Pattern: Querying One Day's Rows

Turn a day key from a URL into the closed pair of instants a query filters on: a row at 23:59 local is in, one at the next midnight is out.

```typescript
import { endOfDay, fromDayKey } from "@sdxc/dates";
import { isFailure, success } from "@sdxc/result";

function dayBounds(key: string, timeZone: string) {
	let start = fromDayKey(key, timeZone);
	if (isFailure(start)) return start;
	return success({ from: start.data, to: endOfDay(start.data, timeZone) });
}
```

## Pattern: A datetime-local Field In The Reader's Zone

The input holds a wall clock with no zone, so fill it and read it back in the zone the reader sees.

```typescript
import { formatDateTime, isValidTimeZone, parseDateTimeLocal, toDateTimeLocal } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";

function startsAtValue(startsAt: Date, timeZone: string) {
	return toDateTimeLocal(startsAt, timeZone); // the input's value attribute
}

function readStartsAt(form: FormData, cookieZone: string, locale: string) {
	let timeZone = isValidTimeZone(cookieZone) ? cookieZone : "UTC";
	let startsAt = parseDateTimeLocal(String(form.get("startsAt") ?? ""), timeZone);
	if (isFailure(startsAt)) return { error: "Pick a valid date and time" };

	return {
		startsAt: startsAt.data,
		confirmation: formatDateTime(startsAt.data, { locale, timeZone }),
	};
}
```

## Pattern: A Report Range From The Query String

Offer presets over completed days and hold a hand-picked range to the same limits. Data that rolls up nightly is complete through yesterday.

```typescript
import type { DayRange } from "@sdxc/dates";

import {
	addMonths,
	formatDate,
	formatRange,
	fromDayKey,
	isWholeMonth,
	lastNDaysRange,
	monthRange,
	quarterRange,
	subDays,
	toDayKey,
	validateDayRange,
	yearToDateRange,
} from "@sdxc/dates";
import { isSuccess, success } from "@sdxc/result";

let timeZone = "UTC";

function presetRange(preset: string, now: Date): DayRange {
	let yesterday = subDays(now, 1);
	if (preset === "lastMonth") return monthRange(addMonths(now, -1, timeZone), timeZone);
	if (preset === "lastQuarter") return quarterRange(addMonths(now, -3, timeZone), timeZone);
	if (preset === "yearToDate") return yearToDateRange(yesterday, timeZone);
	return lastNDaysRange(30, { from: yesterday, timeZone });
}

function readRange(url: URL, now = new Date()) {
	let from = url.searchParams.get("from");
	let to = url.searchParams.get("to");
	if (from === null || to === null) {
		return success(presetRange(url.searchParams.get("preset") ?? "", now));
	}

	let latest = toDayKey(subDays(now, 1), timeZone);
	return validateDayRange({ from, to }, { latest, maxDays: 366 }); // failure.error.problem says why
}

function rangeLabel(range: DayRange, locale: string) {
	let from = fromDayKey(range.from, timeZone);
	let to = fromDayKey(range.to, timeZone);
	if (!isSuccess(from) || !isSuccess(to)) return "";
	if (isWholeMonth(range)) return formatDate(from.data, { locale, timeZone, dateStyle: "long" });
	return formatRange(from.data, to.data, { locale, timeZone });
}
```

## Pattern: A Time-Zone Picker

List UTC first and the areas as option groups, then validate the submission against the same list.

```typescript
import { isSupportedTimeZone, systemTimeZone, timeZonesByRegion } from "@sdxc/dates";

function timeZoneOptions(selected = systemTimeZone()) {
	return [
		{ label: "UTC", options: [{ value: "UTC", selected: selected === "UTC" }] },
		...timeZonesByRegion().map((group) => ({
			label: group.region,
			options: group.zones.map((zone) => ({ value: zone, selected: zone === selected })),
		})),
	];
}

function readTimeZone(form: FormData) {
	let value = String(form.get("timeZone") ?? "UTC");
	return isSupportedTimeZone(value) ? value : null;
}
```

## Pattern: A Stacked Date Badge

When a design puts the month and day in their own elements, read them from `formatParts()` so each locale supplies its own names.

```typescript
import { formatParts } from "@sdxc/dates";

function badge(date: Date, locale: string, timeZone: string) {
	let parts = formatParts(date, { locale, timeZone, month: "short", day: "numeric" });
	let read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
	return { month: read("month"), day: read("day") };
}
```

## Pattern: Wall Clocks In A Calendar Feed

A recurring event stored as a local time keeps that local time across DST; the `./zone` subpath turns each occurrence's wall clock into an instant.

```typescript
import { instantFromParts, shiftCalendarDay, zonedParts } from "@sdxc/dates/zone";

function weeklyOccurrences(first: Date, count: number, timeZone: string) {
	let clock = zonedParts(first.getTime(), timeZone);
	let occurrences: Date[] = [];
	for (let week = 0; week < count; week++) {
		let day = shiftCalendarDay(clock, week * 7);
		occurrences.push(new Date(instantFromParts({ ...clock, ...day }, timeZone)));
	}
	return occurrences;
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
