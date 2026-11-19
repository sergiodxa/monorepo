# @sdxc/natural-dates

Find English date, time, duration and repeat phrases in text, resolved against a clock and a time zone.

## Installation

```sh
npm add @sdxc/natural-dates
```

Results come back as a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which installs alongside.

## Usage

### Read a date and time from a sentence

```typescript
import { find } from "@sdxc/natural-dates";
import { unwrap } from "@sdxc/result";

let found = unwrap(
	find("Lunch with Ana tomorrow 1pm", { now: new Date(), timeZone: "Europe/Lisbon" }),
);

found.date; // "2026-11-19", tomorrow on a Lisbon calendar
found.start; // "13:00"
```

Dates come back as `YYYY-MM-DD` and times as `HH:MM`, on the zone's own calendar. A field is set only when the text says it, so you choose the defaults (today, an hour long).

### Take the phrases out of the text

```typescript
import { find, strip } from "@sdxc/natural-dates";
import { unwrap } from "@sdxc/result";

let text = "Dentist on Friday at 8:30am";
let found = unwrap(find(text, { now: new Date(), timeZone: "America/New_York" }));

strip(text, found.matches); // "Dentist"
```

Every match carries its `index` and `end`, so you can also highlight phrases as someone types.

### Read ranges, lengths and all-day spans

```typescript
let { start, end, duration } = unwrap(find("Review 9:30–11", options)); // "09:30", "11:00", 90
let standup = unwrap(find("Standup at 9:30 for 15 minutes", options)); // end "09:45"
let trip = unwrap(find("Offsite Dec 3-5", options)); // date "2026-12-03", endDate "2026-12-05"
let block = unwrap(find("Planning all day Friday", options)); // allDay true, no times
```

### Read a repeat

```typescript
import { find, toRRule } from "@sdxc/natural-dates";

let { repeat, date } = unwrap(find("Design sync every other Tuesday until March", options));
// repeat: { frequency: "weekly", interval: 2, byDay: [{ day: "tu" }], until: "2027-03-31T23:59:59" }
// date: the first Tuesday on or after today

toRRule(repeat); // "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;UNTIL=20270331T235959"
```

`repeat` has the shape of a JSCalendar `RecurrenceRule`, so it drops into an event's `recurrenceRules` as is. `toRRule` writes it for iCalendar.

## API

### `find(text: string, options: FindOptions): Result<Found, NaturalDatesError>`

Finds every phrase in `text` and adds them up. Text without a date phrase succeeds with no matches. Only an unknown `timeZone` or an invalid `now` fails. Longer phrases are read first and matches never overlap, so "every other Tuesday until March" is one repeat.

It reads:

- **Dates:** today, tonight, tomorrow, yesterday, the day after tomorrow; weekdays ("Friday", "this Friday", "next Friday"); month days ("Dec 3", "December 3rd, 2027", "the 5th of January"); `YYYY-MM-DD`; "in 2 weeks", "in a month"; "next week" and "next month"; spans ("Dec 3-5", "Dec 3 to Dec 7").
- **Times:** "1pm", "9:30 am", "13:45", "at 3", noon, midnight, and morning, afternoon or evening.
- **Ranges:** "9:30–11", "9-10am", "11 to 1pm", "from 2 to 4", "between 1 and 2pm".
- **Durations:** "for 45 minutes", "for an hour", "for 1.5 hours", "for 1 hour 30 minutes", "for 3 days".
- **All-day:** "all day", "all-day".
- **Repeats:** daily, weekly, biweekly, monthly, yearly; "every day", "every 3 weeks", "every weekday", "every weekend", "every Tuesday and Thursday", "every other Tuesday"; each with an optional "until <date or month>" or "N times".

How it resolves them:

- A weekday names the next one on or after today, and "next Friday" the first one after today.
- A month day without a year is the next one on or after today.
- A bare hour after "at" reads as a working-day hour: 1 to 7 is afternoon, 8 to 11 is morning, and after "tonight" every hour is evening.
- A number range with no meridiem, colon or "from" ("2-3 people") is left alone.

### `strip(text: string, matches: Array<{ index: number; end: number }>): string`

The text without the given ranges. Whitespace collapses, and an "on", "at", "from", "for", "by", colon, comma or dash stranded at either end goes with them.

### `toRRule(rule: RepeatRule): string`

The rule as an iCalendar `RRULE` value, without the `RRULE:` name. `UNTIL` is written as a floating date-time, the end of that day on the event's own clock. Convert it to UTC yourself if the event's `DTSTART` carries a `TZID`.

### `NaturalDatesError`

What `find` fails with. Its `problem` is `"timeZone"` or `"now"`.

### Types

- `FindOptions`: `{ now: Date; timeZone: string }`.
- `Found`: `{ matches, date?, endDate?, start?, end?, duration?, allDay, repeat? }`, with `duration` in minutes.
- `Match`: a `MatchValue` plus `index`, `end` and `text`.
- `MatchValue`, discriminated by `kind`:
  - `date` (`date`)
  - `dateRange` (`from`, `to`)
  - `time` (`time`)
  - `timeRange` (`from`, `to`)
  - `duration` (`minutes`)
  - `allDay`
  - `repeat` (`rule`)
- `RepeatRule`: `{ frequency: "daily" | "weekly" | "monthly" | "yearly"; interval?; byDay?: Array<{ day: Weekday }>; until?; count? }`.
- `Weekday`: `"mo" | "tu" | "we" | "th" | "fr" | "sa" | "su"`.

## Pattern: A Quick-Add Box That Creates an Event

Read the line, take the phrases out for the title, and fill the defaults the text left open.

```typescript
import { find, strip } from "@sdxc/natural-dates";
import { isFailure } from "@sdxc/result";

function quickAdd(line: string, timeZone: string, now = new Date()) {
	let found = find(line, { now, timeZone });
	if (isFailure(found)) return null;
	let { date, start, end, allDay, repeat, matches } = found.data;
	let title = strip(line, matches) || "New event";
	let day = date ?? now.toISOString().slice(0, 10);
	if (allDay || start === undefined) return { title, day, allDay: true, repeat };
	return { title, day, start, end: end ?? addHour(start), repeat };
}

function addHour(time: string): string {
	let minutes = (Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) + 60) % 1440;
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
```

## Pattern: A JSCalendar Event From a Sentence

`found.repeat` is already a JSCalendar `RecurrenceRule`, so the event only needs its start and length written out.

```typescript
import { find, strip } from "@sdxc/natural-dates";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

let line = "Yoga every Monday and Wednesday at 7am for an hour";
let found = unwrap(find(line, { now: new Date(), timeZone: "America/Chicago" }));

let event = {
	"@type": "Event",
	uid: generateUUID(),
	title: strip(line, found.matches), // "Yoga"
	start: `${found.date}T${found.start}:00`,
	timeZone: "America/Chicago",
	duration: `PT${found.duration}M`,
	recurrenceRules: found.repeat ? [found.repeat] : undefined,
};
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
		"@sdxc/natural-dates": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
