# @sdxc/cron

Cron schedules with zone-aware occurrences and structured descriptors.

A `Schedule` is a parsed five-field cron expression. Parsing answers a `Result` that names the
field and character index at fault, every occurrence query takes its time zone and starting
instant as arguments, and `describe()` answers data an app translates into its own words.

## Installation

```sh
npm add @sdxc/cron
```

Parsing answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), and
the `grace` option takes a `DurationInput` from
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration).

## Usage

### Parse an expression

```typescript
import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

let result = Schedule.parse("0 25 * * *");
if (isFailure(result)) {
	result.error.reason; // "out-of-range"
	result.error.field; // "hour"
	result.error.position; // 2, the index of "25" in the text
} else {
	let schedule = result.data;
}
```

### Compute occurrences

```typescript
import { Schedule } from "@sdxc/cron";
import { unwrap } from "@sdxc/result";

let schedule = unwrap(Schedule.parse("*/15 * * * *"));
let from = new Date();

schedule.next({ from, timeZone: "America/New_York" }); // Date
schedule.next({ from, timeZone: "America/New_York", count: 5 }); // Date[]
schedule.prev({ from, timeZone: "America/New_York" }); // Date
schedule.matches(from, { timeZone: "America/New_York" }); // boolean
```

`from` is exclusive on both sides: an instant that is itself an occurrence counts as already run.

### Describe it

```typescript
let schedule = unwrap(Schedule.parse("0 9 * * MON-FRI"));

schedule.describe(); // { kind: "weekly", weekdays: [1, 2, 3, 4, 5], at: [{ hour: 9, minute: 0 }] }
schedule.toString(); // "0 9 * * 1-5"
```

### Ask whether a run is late

```typescript
let schedule = unwrap(Schedule.parse("0 * * * *"));
let lastRun = new Date("2026-06-01T10:00:00Z");

schedule.expectedBy(lastRun, { timeZone: "UTC", grace: "5 minutes" }); // 2026-06-01T11:05:00Z
schedule.isDue(lastRun, { now: new Date(), timeZone: "UTC", grace: "5 minutes" }); // boolean
```

## API

### `Schedule.parse(expression: string): Result<Schedule, InvalidCronExpression>`

Parses five standard fields or a macro, and never throws. A `Schedule` is frozen and can only come
from `parse`, so an instance is always a valid schedule.

### `schedule.next(options): Date | Date[]`

The next occurrence strictly after `options.from`, evaluated on `options.timeZone`'s clock. With
`options.count`, an array of that many occurrences in order.

### `schedule.prev(options: OccurrenceOptions): Date`

The last occurrence strictly before `options.from`, to the millisecond. `next` and `prev` agree on
which instants are occurrences.

### `schedule.matches(date: Date, options: MatchOptions): boolean`

Whether the wall-clock minute `date` falls in, read in `options.timeZone`, is one the schedule
fires in. Seconds are ignored.

### `schedule.describe(): ScheduleDescriptor`

A structured description, the same frozen object on every call. `{ kind: "expression" }` means no
concise shape fits; show `toString()` then.

### `schedule.toString(): string`

The normalized expression: macros expanded, names resolved to numbers, values sorted and
deduplicated, runs collapsed to ranges and steps. One spelling per schedule, for storage and logs.

```typescript
unwrap(Schedule.parse("@weekly")).toString(); // "0 0 * * 0"
unwrap(Schedule.parse("5/10 * * * *")).toString(); // "5,15,25,35,45,55 * * * *"
```

### `schedule.expectedBy(lastRun: Date, options: ExpectedByOptions): Date`

The deadline for the run following `lastRun`: the next occurrence after it, plus `options.grace`.

### `schedule.isDue(lastRun: Date, options: IsDueOptions): boolean`

`true` once `options.now` has reached `expectedBy(lastRun, options)`.

### Unknown time zones

A zone the runtime does not know makes `next`, `prev` and `expectedBy` answer an invalid `Date`
(`next` with `count` an empty array), and `matches` and `isDue` answer `false`. Check
`Number.isNaN(date.getTime())` when the zone comes from stored data.

### `InvalidCronExpression`

The `Error` a failed parse carries. Its message is diagnostic; key user-facing wording on `reason`.

- `expression`: the rejected text, verbatim, so `position` lines up with it
- `reason`: an `InvalidCronReason`
- `field`: the `CronFieldName` at fault, or `null` when the whole expression is
- `position`: zero-based index into `expression`

| `reason`                | Meaning                                                  |
| ----------------------- | -------------------------------------------------------- |
| `empty`                 | No fields at all                                         |
| `field-count`           | Not five fields                                          |
| `seconds-not-supported` | Six fields, a seconds-first expression                   |
| `unknown-macro`         | An `@` shorthand outside the supported set               |
| `syntax`                | A field that is not a list of values, ranges or steps    |
| `unknown-name`          | A month or weekday name that is not a known abbreviation |
| `out-of-range`          | A value outside the field's bounds                       |
| `reversed-range`        | A range whose start is greater than its end              |
| `invalid-step`          | A step that is missing, not a number, or zero            |
| `impossible-date`       | A day of month no month in the expression contains       |

### Expression syntax

| Shape           | Example                                           | Notes                                             |
| --------------- | ------------------------------------------------- | ------------------------------------------------- |
| Value           | `30 9 * * *`                                      |                                                   |
| List            | `0,15,30,45 * * * *`                              | Sorted and deduplicated                           |
| Range           | `0 9-17 * * *`                                    | Inclusive                                         |
| Step            | `*/15`, `9-17/4`, `5/10`                          | `5/10` runs from the value to the field's maximum |
| Names           | `JAN`, `jan-mar`, `MON-FRI`                       | Three letters, any case                           |
| Sunday as seven | `0 0 * * 7`                                       | Same as `0`                                       |
| Macros          | `@hourly` `@daily` `@weekly` `@monthly` `@yearly` | `@annually` and `@midnight` are aliases           |

Fields are minute `0-59`, hour `0-23`, day of month `1-31`, month `1-12` and day of week `0-7`.
Seconds, `@reboot` and the extensions `L`, `W`, `#` and `?` are rejected.

When both day fields are restricted, a date matches if either does; only a bare `*` leaves a field
open, so `*/2` in the day-of-month field counts as restricted.

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
```

Each member is exported on its own: `IntervalDescriptor`, `HourlyDescriptor`, `DailyDescriptor`,
`WeeklyDescriptor`, `MonthlyDescriptor`, `YearlyDescriptor` and `ExpressionDescriptor`. Weekdays
count from `0` for Sunday and months from `1` for January, as in the cron fields. `TimeOfDay` is
`{ hour, minute }` on the evaluation zone's wall clock.

#### Options and errors

`OccurrenceOptions` is `{ from, timeZone }`, and `NextOptions` adds `count?`. `MatchOptions` is
`{ timeZone }`, `ExpectedByOptions` is `{ timeZone, grace? }`, and `IsDueOptions` adds `now`.
`CronFieldName` is `"minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek"`, `InvalidCronReason`
is the union of the reasons above, and `InvalidCronExpressionInput` is the constructor's argument.

## Pattern: Validating A Submitted Expression

Point the form error at the field and character the user got wrong, and store the normalized
form next to the zone it was configured in.

```typescript
import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

interface ScheduleInput {
	expression: string;
	timeZone: string;
}

function validateSchedule(input: ScheduleInput) {
	let result = Schedule.parse(input.expression);
	if (isFailure(result)) {
		return {
			ok: false as const,
			error: {
				messageKey: `cron.error.${result.error.reason}`,
				field: result.error.field,
				position: result.error.position,
			},
		};
	}

	return {
		ok: true as const,
		value: { expression: result.data.toString(), timeZone: input.timeZone },
	};
}

validateSchedule({ expression: "0 9 * * mon-fri", timeZone: "Europe/Madrid" });
// { ok: true, value: { expression: "0 9 * * 1-5", timeZone: "Europe/Madrid" } }
```

## Pattern: Translating A Descriptor

Switch on `kind` and map each shape to a translation key; `expression` is a normal outcome.

```typescript
import type { Schedule, TimeOfDay } from "@sdxc/cron";

type Translate = (key: string, values?: Record<string, unknown>) => string;

function formatTime(time: TimeOfDay) {
	return `${String(time.hour).padStart(2, "0")}:${String(time.minute).padStart(2, "0")}`;
}

function describeSchedule(schedule: Schedule, t: Translate, weekdayNames: string[]) {
	let descriptor = schedule.describe();
	switch (descriptor.kind) {
		case "interval":
			return t(`schedule.every.${descriptor.unit}`, { count: descriptor.every });
		case "hourly":
			return t("schedule.hourly", { minutes: descriptor.minutes });
		case "daily":
			return t("schedule.daily", { times: descriptor.at.map(formatTime) });
		case "weekly":
			return t("schedule.weekly", {
				days: descriptor.weekdays.map((day) => weekdayNames[day]),
				times: descriptor.at.map(formatTime),
			});
		case "monthly":
			return t("schedule.monthly", { days: descriptor.days, times: descriptor.at.map(formatTime) });
		case "yearly":
			return t("schedule.yearly", {
				months: descriptor.months,
				days: descriptor.days,
				times: descriptor.at.map(formatTime),
			});
		case "expression":
			return schedule.toString();
	}
}
```

## Pattern: A Dead Man's Switch

A monitored job pings after each run; a periodic sweep flags the ones whose next ping is overdue.
Passing `now` keeps the sweep testable without touching the clock.

```typescript
import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

interface Monitor {
	expression: string;
	timeZone: string;
	lastPingAt: Date;
}

function overdueMonitors(monitors: Monitor[], now: Date) {
	return monitors.filter((monitor) => {
		let result = Schedule.parse(monitor.expression);
		if (isFailure(result)) return false;
		return result.data.isDue(monitor.lastPingAt, {
			now,
			timeZone: monitor.timeZone,
			grace: "5 minutes",
		});
	});
}

function alertDeadline(monitor: Monitor) {
	let schedule = Schedule.parse(monitor.expression);
	if (isFailure(schedule)) return null;
	return schedule.data.expectedBy(monitor.lastPingAt, {
		timeZone: monitor.timeZone,
		grace: "5 minutes",
	});
}
```

## Pattern: Runs Across A Daylight Saving Change

A schedule pinned to hours is an appointment and keeps its wall-clock time; one that fires every
hour is an interval and keeps its spacing. Around 2026-03-08 in `America/New_York`, 02:00 EST
becomes 03:00 EDT:

```typescript
import { Schedule } from "@sdxc/cron";
import { unwrap } from "@sdxc/result";

let from = new Date("2026-03-07T12:00:00Z");
let timeZone = "America/New_York";

unwrap(Schedule.parse("0 9 * * *")).next({ from, timeZone, count: 2 });
// 2026-03-07T14:00Z and 2026-03-08T13:00Z, both 09:00 local

unwrap(Schedule.parse("30 2 * * *")).next({ from, timeZone });
// 2026-03-08T07:30Z, 03:30 EDT: a skipped wall time runs just after the jump
```

| Situation                        | Behavior                               |
| -------------------------------- | -------------------------------------- |
| Appointment in a repeated hour   | Fires once, on the first pass          |
| Appointment in a skipped hour    | Carried forward to just after the jump |
| Interval through a repeated hour | Fires in both passes                   |
| Interval through a skipped hour  | Loses the runs inside it               |

`matches()` reads the wall clock, so it answers `false` for a carried run (03:30 is not 02:30) and
`true` for both passes of a repeated hour. Use `next()` or `prev()` to decide what ran.

## Pattern: Restricting Both Day Fields

```typescript
import { Schedule } from "@sdxc/cron";
import { unwrap } from "@sdxc/result";

unwrap(Schedule.parse("0 0 13 * 5")); // the 13th of every month, and every Friday
unwrap(Schedule.parse("0 0 * * 1")); // Mondays only: the day of month is open
unwrap(Schedule.parse("0 0 */2 * 1")); // odd days of the month, and every Monday

Schedule.parse("0 0 30 2 *"); // failure: impossible-date, February has no 30th
Schedule.parse("0 0 30 2 1"); // success: every Monday in February
```

Because of this rule, `toString()` prints a day field covering every day as `1-31` or `0-6`.

## Pattern: Counting Runs In A Window

`count` walks forward from an instant, so a window is a count plus a filter. Size the count to the
window: every minute for a month is about 44,600 runs.

```typescript
import { Schedule } from "@sdxc/cron";
import { unwrap } from "@sdxc/result";

let schedule = unwrap(Schedule.parse("0 */6 * * *"));
let start = new Date("2026-06-01T00:00:00Z");
let end = new Date("2026-07-01T00:00:00Z");

let runs = schedule
	.next({ from: new Date(start.getTime() - 1), timeZone: "UTC", count: 200 })
	.filter((date) => date < end);
runs.length; // 120
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
		"@sdxc/cron": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
