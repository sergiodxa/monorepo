# @pkg/cron

Cron expression parsing and time-zone-aware occurrence computation, with `Result`
failures and descriptions an app can translate.

## Overview

Cron expressions are user input: someone types `*/15 * * * *` into a form and the
product has to say whether it is valid, when the next run is, and what it means. This
package models that as a `Schedule` value object. Parsing returns a
[`Result`](/packages/result) carrying the offending field and character index instead
of throwing, so validation composes with the rest of the repository's error handling.

Every occurrence query names its time zone explicitly. A schedule is stored with the
zone the user configured it in, evaluation happens in that zone, and the return value
is an instant, which is what keeps a daily 09:00 job at 09:00 local when the offset
changes underneath it. There is no ambient clock either: `from` and `now` are always
arguments, so results are reproducible in a test.

Descriptions are structured data, never text. `describe()` returns shapes like
`{ kind: "daily", at: [{ hour: 9, minute: 0 }] }` and the app maps `kind` to an i18n
key, so nothing user-facing ships from this package. Only the five standard fields are
supported: seconds and the non-standard extensions (`L`, `W`, `#`, `?`) are rejected
rather than half-implemented.

## Usage

### Validating input

```typescript
import { Schedule } from "@pkg/cron";
import { isFailure } from "@pkg/result";

let result = Schedule.parse("*/15 * * * *");
if (isFailure(result)) {
	// result.error.reason  -> "out-of-range"
	// result.error.field   -> "hour"
	// result.error.position -> index inside the text the user typed
	return validationError(result.error);
}

let schedule = result.data;
```

### Computing occurrences

```typescript
let from = new Date();

schedule.next({ from, timeZone: "America/New_York" }); // Date
schedule.next({ from, timeZone: "America/New_York", count: 5 }); // Date[]
schedule.prev({ from, timeZone: "America/New_York" }); // Date
schedule.matches(from, { timeZone: "America/New_York" }); // boolean
```

### Describing a schedule

```typescript
import { unwrap } from "@pkg/result";

let descriptor = unwrap(Schedule.parse("0 9 * * 1-5")).describe();
// { kind: "weekly", weekdays: [1, 2, 3, 4, 5], at: [{ hour: 9, minute: 0 }] }

if (descriptor.kind === "expression") {
	// No concise shape fits: show the raw expression.
}
```

### Asking whether a run is late

```typescript
schedule.expectedBy(lastPing, { timeZone, grace: "5 minutes" }); // Date
schedule.isDue(lastPing, { now: new Date(), timeZone, grace: "5 minutes" }); // boolean
```

## API

### `Schedule.parse(expression: string): Result<Schedule, InvalidCronExpression>`

Parses a cron expression. Never throws, for any input.

**Parameters:**

- `expression`: The expression as written, whitespace and case as typed

**Returns:**

- A `Success<Schedule>`, or a `Failure<InvalidCronExpression>` naming the field and
  index a validation message should point at

**Example:**

```typescript
let result = Schedule.parse("0 9 * * 1-5");
```

### `schedule.next(options): Date | Date[]`

The next occurrence strictly after `options.from`. An instant that is itself an
occurrence is treated as past, matching a daemon that has already run it.

**Parameters:**

- `options.from`: Where the search starts, exclusive
- `options.timeZone`: IANA zone the schedule is evaluated in
- `options.count`: How many occurrences to collect; omit for a single `Date`

**Returns:**

- A `Date` when `count` is omitted, or a `Date[]` of that length. An unknown time zone
  yields an invalid `Date` (and an empty array), never a throw

**Example:**

```typescript
let upcoming = schedule.next({ from: new Date(), timeZone: "Europe/Madrid", count: 3 });
```

### `schedule.prev(options): Date`

The last occurrence strictly before `options.from`, so `next` and `prev` never report
the same instant for the same input.

**Parameters:**

- `options.from`: Where the search starts, exclusive
- `options.timeZone`: IANA zone the schedule is evaluated in

**Returns:**

- A `Date`, or an invalid `Date` for an unknown zone

### `schedule.matches(date: Date, options): boolean`

Whether the minute `date` falls in is one the schedule fires in. Seconds are ignored,
because cron resolves to minutes.

**Parameters:**

- `date`: The instant to test
- `options.timeZone`: IANA zone whose wall clock the fields are read against

**Returns:**

- `true` when every field matches; `false` for an unknown zone or an invalid date

### `schedule.describe(): ScheduleDescriptor`

A structured description, for an app to render in the user's language. The same frozen
object on every call.

**Returns:**

- One of the descriptors below, or `{ kind: "expression" }` when nothing concise fits

**Example:**

```typescript
let descriptor = schedule.describe(); // { kind: "interval", unit: "minute", every: 15 }
```

### `schedule.toString(): string`

The normalized expression: macros expanded, names resolved to numbers, values sorted
and deduplicated, runs collapsed to ranges. For storage and logs, not for display.

**Returns:**

- The five fields separated by single spaces

**Example:**

```typescript
unwrap(Schedule.parse("@weekly")).toString(); // "0 0 * * 0"
unwrap(Schedule.parse("5/10 * * * *")).toString(); // "5,15,25,35,45,55 * * * *"
```

### `schedule.expectedBy(lastRun: Date, options): Date`

The instant the run following `lastRun` must have arrived by: the next occurrence after
it, plus the grace period.

**Parameters:**

- `lastRun`: When the schedule last ran, e.g. the last ping received
- `options.timeZone`: IANA zone the schedule is evaluated in
- `options.grace`: A [`DurationInput`](/packages/duration) tolerance; omit for none

**Returns:**

- The deadline, or an invalid `Date` for an unknown zone

### `schedule.isDue(lastRun: Date, options): boolean`

Whether a run is overdue: the occurrence following `lastRun`, plus its grace period, is
at or before `now`.

**Parameters:**

- `lastRun`: When the schedule last ran
- `options.now`: The instant being judged; always explicit, never `Date.now()`
- `options.timeZone`: IANA zone the schedule is evaluated in
- `options.grace`: A `DurationInput` tolerance; omit for none

**Returns:**

- `true` once the deadline has been reached, `false` while there is still time and for
  an unknown zone

### `InvalidCronExpression`

The failure `parse()` returns. An `Error` subclass whose message is diagnostic only:
the wording a user reads comes from the app, keyed on `reason`.

**Properties:**

- `expression`: `string` - the rejected text, verbatim, so `position` lines up with it
- `reason`: `InvalidCronReason` - machine-readable cause
- `field`: `CronFieldName | null` - the field at fault, or `null` for the whole
  expression
- `position`: `number` - zero-based index into `expression`

**Reasons:**

| `reason`                | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `empty`                 | No fields at all                                         |
| `field-count`           | Not the five standard fields                             |
| `seconds-not-supported` | Six fields, i.e. a seconds-first expression              |
| `unknown-macro`         | An `@` shorthand outside the supported set               |
| `syntax`                | A field that is not a list of values, ranges, or steps   |
| `unknown-name`          | A month or weekday name that is not a known abbreviation |
| `out-of-range`          | A numeric value outside the field's bounds               |
| `reversed-range`        | A range whose start is greater than its end              |
| `invalid-step`          | A step that is missing, not a number, or zero            |
| `impossible-date`       | A day-of-month and month pair no calendar year contains  |

### Types

#### `ScheduleDescriptor`

```typescript
type ScheduleDescriptor =
	| { kind: "interval"; unit: "minute" | "hour"; every: number }
	| { kind: "hourly"; minutes: readonly number[] }
	| { kind: "daily"; at: readonly TimeOfDay[] }
	| { kind: "weekly"; weekdays: readonly number[]; at: readonly TimeOfDay[] }
	| { kind: "monthly"; days: readonly number[]; at: readonly TimeOfDay[] }
	| { kind: "yearly"; months: readonly number[]; days: readonly number[]; at: readonly TimeOfDay[] }
	| { kind: "expression" };

interface TimeOfDay {
	hour: number;
	minute: number;
}
```

Weekdays are numbered with `0` for Sunday and months from `1` for January, the same as
the cron fields, so an app can index its own translated names directly.

`{ kind: "expression" }` is the fallback and is expected: it covers schedules that
restrict both day fields (the either-or rule below cannot be phrased as one shape),
schedules with more times of day than a sentence should list, and anything else with no
concise shape. Show `toString()` in that case.

## Supported syntax

| Shape           | Example                                           | Notes                                      |
| --------------- | ------------------------------------------------- | ------------------------------------------ |
| Value           | `30 9 * * *`                                      |                                            |
| List            | `0,15,30,45 * * * *`                              | Sorted and deduplicated                    |
| Range           | `0 9-17 * * *`                                    | Inclusive; a reversed range is rejected    |
| Step on a star  | `*/15 * * * *`                                    |                                            |
| Step on a range | `0 9-17/4 * * *`                                  |                                            |
| Step on a value | `5/10 * * * *`                                    | Runs from the value to the field's maximum |
| Month names     | `0 0 1 JAN *`, `0 0 * jan-mar *`                  | Three letters, any case                    |
| Weekday names   | `0 9 * * MON-FRI`                                 | Three letters, any case                    |
| Sunday as seven | `0 0 * * 7`                                       | Folded onto `0`                            |
| Macros          | `@hourly` `@daily` `@weekly` `@monthly` `@yearly` | `@annually` is `@yearly`                   |

Field bounds are minute `0-59`, hour `0-23`, day of month `1-31`, month `1-12`, and day
of week `0-7`.

Rejected on purpose: seconds fields (a sub-minute schedule is a promise a worker runtime
cannot keep), `@reboot` (no schedule of its own), and the non-standard `L`, `W`, `#` and
`?`. Accepting that syntax without honoring its semantics is worse than refusing it.

### The day-of-month and day-of-week rule

When **both** day fields are restricted, a date matches if **either** matches. When only
one is restricted, the other is open and matches everything.

```typescript
// The 13th of any month, and every Friday.
Schedule.parse("0 0 13 * 5");

// Only Mondays: the day-of-month field is open, so both fields must agree.
Schedule.parse("0 0 * * 1");
```

Only a bare `*` leaves a field open. `*/2` names specific days, so `0 0 */2 * 1` fires
on odd days of the month **and** on Mondays. This is also why `toString()` prints a day
field covering every day as `1-31` or `0-6` rather than `*`: turning it into a star
would quietly switch the rule off.

An expression whose day of month can never occur in any month it names, such as
`0 0 30 2 *`, is rejected at parse time with `impossible-date`, so occurrence queries
always have an answer. With a restricted day of week the same expression is accepted,
because the weekday side can still put it on the calendar.

## Daylight saving time

A schedule means one of two things, and which one it means decides what happens at a
transition:

- **Pinned to hours** (`0 9 * * *`, `30 2 * * *`): an appointment. It is followed on the
  zone's wall clock, so 09:00 stays 09:00 local and the instant moves by an hour.
- **Fires every hour** (`*/15 * * * *`, `0 * * * *`, `@hourly`): an interval. It is
  followed on absolute time, so the spacing is what is preserved.

At the two awkward moments:

| Situation                                   | Behavior                                                           |
| ------------------------------------------- | ------------------------------------------------------------------ |
| Wall time happens twice (clock set back)    | The **first** pass is the occurrence, so an appointment fires once |
| Wall time never happens (clock set forward) | The run is **carried forward** to the instant just after the jump  |
| Interval through a repeated hour            | Fires in **both** passes, keeping its spacing                      |
| Interval through a skipped hour             | Loses the runs in it, because that hour did not exist              |

Concretely, in `America/New_York` around 2026-03-08, when 02:00 EST becomes 03:00 EDT:

```typescript
let daily = unwrap(Schedule.parse("0 9 * * *"));
daily.next({ from: new Date("2026-03-07T12:00:00Z"), timeZone: "America/New_York", count: 2 });
// 2026-03-07T14:00Z and 2026-03-08T13:00Z — both 09:00 local

let skipped = unwrap(Schedule.parse("30 2 * * *"));
skipped.next({ from: new Date("2026-03-07T12:00:00Z"), timeZone: "America/New_York" });
// 2026-03-08T07:30Z — 03:30 EDT, the run carried past the jump
```

Two consequences worth knowing:

1. `matches()` answers about the wall clock, so it is `false` for a run carried out of a
   skipped hour (03:30 is not 02:30) and `true` for **both** passes of a repeated hour.
   `next()` is the authority on which instants are occurrences.
2. A schedule inside a skipped hour still runs, an hour late, rather than being dropped
   for the day. For a dead man's switch, a run that silently never happens is the worse
   failure.

### Differences from `cron-parser`

This package replaces `cron-parser` 5.6.2. Sweeps totalling roughly 83,000 occurrence
comparisons, over more than 80 expressions and 22 time zones, starting on both sides of
every transition, found **11 disagreements**, all of them at a transition, in two
classes:

1. **A wall time the clock skips entirely** (6 cases: `45 2 * * 0` in `Pacific/Chatham`,
   whose clock jumps at exactly 02:45, and `0 0 30 * *` in `Africa/Cairo`, whose clock
   jumps at exactly 00:00, both looking forward; plus the same schedule in
   `Australia/Adelaide` and `Australia/Sydney` looking backward, where the other library
   keeps the run going forward but drops it going back). We carry the run past the jump,
   in both directions. `cron-parser` drops it and reports the following week or month.
   **We consider ours correct**: it is what a Unix cron daemon does, it is what
   `cron-parser` itself does when the wall time is _inside_ the gap rather than exactly at
   its start, and a monitor that expects nothing for a week is a monitor that cannot
   alert.
2. **`prev()` inside a repeated hour** (5 cases: `45 2 * * 0` in `Australia/Adelaide`,
   `Australia/Sydney`, `Pacific/Auckland` and `Pacific/Chatham`; `30 23 * * 6` in
   `America/Santiago`). We report the first pass, the same instant `next()` reports.
   `cron-parser` reports the first pass going forward and the second going back.
   **We consider ours correct**: `next()` and `prev()` should agree on which instants are
   occurrences.

Everything else matched exactly, including both DST directions in the common zones, the
either-or rule with steps, name and step parsing, February 29th across a non-leap
century, and month-length skipping.

Two intentional differences in what is _accepted_ rather than computed: expressions using
seconds or the non-standard extensions are rejected here and accepted there, and a list
that repeats a value (`0 12 * * 1,1`) is accepted and normalized here but rejected there.

`src/parity.test.ts` pins the recorded occurrences and the divergences above. It exists
only until no application depends on `cron-parser`, and should be deleted with it.

## Pattern: Validating a submitted expression

```typescript
import { Schedule } from "@pkg/cron";
import { isFailure } from "@pkg/result";

let result = Schedule.parse(input.expression);
if (isFailure(result)) {
	return {
		errors: {
			expression: {
				key: `cron.error.${result.error.reason}`,
				field: result.error.field,
				position: result.error.position,
			},
		},
	};
}

// Store the normalized form, so logs and comparisons see one spelling.
await repository.save({ expression: result.data.toString(), timeZone: input.timeZone });
```

## Pattern: Translating a descriptor

```typescript
let descriptor = schedule.describe();

switch (descriptor.kind) {
	case "interval":
		return t(`schedule.interval.${descriptor.unit}`, { count: descriptor.every });
	case "hourly":
		return t("schedule.hourly", { minutes: descriptor.minutes });
	case "daily":
		return t("schedule.daily", { times: descriptor.at.map(formatTime) });
	case "weekly":
		return t("schedule.weekly", {
			days: descriptor.weekdays.map((day) => WEEKDAY_NAMES[day]),
			times: descriptor.at.map(formatTime),
		});
	case "monthly":
		return t("schedule.monthly", { days: descriptor.days, times: descriptor.at.map(formatTime) });
	case "yearly":
		return t("schedule.yearly", {
			months: descriptor.months.map((month) => MONTH_NAMES[month]),
			days: descriptor.days,
			times: descriptor.at.map(formatTime),
		});
	case "expression":
		return schedule.toString();
}
```

## Pattern: A dead man's switch

Recording a signal and deciding whether the next one is overdue are the same two calls
from opposite ends:

```typescript
import { Schedule } from "@pkg/cron";
import { isFailure } from "@pkg/result";

let result = Schedule.parse(monitor.expression);
if (isFailure(result)) return; // A stored expression that no longer parses cannot be judged.
let schedule = result.data;

// When a signal arrives, record when the following one is due.
let nextExpectedAt = schedule.next({ from: new Date(), timeZone: monitor.timeZone }).getTime();

// On a sweep, ask whether the signal that was due has been missed.
let late = schedule.isDue(new Date(monitor.lastSignalAt), {
	now: new Date(),
	timeZone: monitor.timeZone,
	grace: monitor.grace,
});
```

## Pattern: Counting runs in a window

`count` walks forward from an instant, so a window is a count plus a filter:

```typescript
let end = new Date("2026-07-01T00:00:00Z");
let runs = schedule
	.next({ from: new Date("2026-06-01T00:00:00Z"), timeZone: "UTC", count: 5000 })
	.filter((date) => date < end);
```

Choose the count with the window in mind: an every-minute schedule produces about 44,600
runs in a month, and each one costs a walk of the calendar.

## Related Packages

- [`@pkg/result`](/packages/result) - the `Result` type parsing returns
- [`@pkg/duration`](/packages/duration) - the `DurationInput` the `grace` option takes

## Tips

1. **Parse once** - a `Schedule` is immutable and frozen, so parse an expression when a
   record is loaded and reuse the instance for the whole request.
2. **Store the normalized form** - `toString()` gives one spelling per schedule, which
   makes stored expressions comparable and log lines stable.
3. **Store the zone next to the expression** - the zone is never defaulted, and a
   schedule evaluated in the wrong one is off by hours, not minutes.
4. **Key i18n on `kind`, not on the expression** - and always handle
   `kind: "expression"`, which is a normal outcome rather than an error.
5. **Pass `now` from the caller** - the lateness helpers take the instant to judge, which
   is what makes a late-monitor sweep testable without touching the clock.
6. **Check for an invalid `Date`** - occurrence queries return one when the runtime does
   not know the time zone, which is the failure mode of a stale stored zone name.
7. **Reach for `next()`, not `matches()`, to decide what ran** - `matches()` reads the
   wall clock, and the two can disagree inside a daylight saving transition.
