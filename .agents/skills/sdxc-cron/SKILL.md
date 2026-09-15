---
name: sdxc-cron
description: "@sdxc/cron parses five-field cron expressions into an immutable `Schedule` and computes time-zone-aware occurrences, lateness deadlines and structured descriptors. Use when validating a cron expression someone typed into a form, computing the next or previous run in an IANA time zone, deciding whether a scheduled run is overdue (a dead man's switch), or rendering a schedule in the reader's language without hardcoded English."
---

# @sdxc/cron

Cron expressions arrive as user input, so this package models them as a value object: `Schedule.parse()` returns a `Result` carrying the offending field and character index instead of throwing, and the resulting `Schedule` is immutable. Occurrence queries (`next`, `prev`, `matches`, `expectedBy`, `isDue`) always take the IANA zone and the instant to search from as explicit arguments, so there is no ambient clock and results are reproducible in a test. `describe()` returns structured descriptors such as `{ kind: "daily", at: [{ hour: 9, minute: 0 }] }` rather than text, leaving the wording to the app. Pure JavaScript with no runtime dependency beyond `Intl`, so it runs anywhere.

Full API, options and examples: [packages/cron/README.md](packages/cron/README.md)

## When to reach for it

- A form takes a cron expression and needs a validation message pointing at the field and character that is wrong.
- Something has to answer "when does this run next" or "when did it last run" in a zone the user configured, across daylight saving transitions.
- A monitor has to decide whether the run that was due has been missed, with a grace period.
- A schedule has to be shown to a reader in their own language, keyed on shape rather than on the raw expression.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/cron": "workspace:*" } }
```

```ts
import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

let result = Schedule.parse("*/15 * * * *");
if (isFailure(result)) {
	// result.error.reason  -> "out-of-range"
	// result.error.field   -> "hour"
	// result.error.position -> index inside the text the user typed
	return validationError(result.error);
}

let schedule = result.data;

schedule.next({ from: new Date(), timeZone: "America/New_York" }); // Date
schedule.next({ from: new Date(), timeZone: "America/New_York", count: 5 }); // Date[]
schedule.isDue(lastPing, { now: new Date(), timeZone, grace: "5 minutes" }); // boolean
```

## Suggestions

- Parse once and reuse the frozen `Schedule`, store `toString()` (the normalized expression) so logs and comparisons see one spelling, and store the zone next to it — the zone is never defaulted.
- Occurrence queries return an invalid `Date` for a zone the runtime does not know, rather than throwing, which is how a stale stored zone name shows up. Check for it.
- Only the five standard fields are supported: seconds, `@reboot`, and the non-standard `L`, `W`, `#` and `?` are rejected at parse time rather than half-implemented.
- Key i18n on `descriptor.kind` and always handle `{ kind: "expression" }` — it is a normal outcome for schedules with no concise shape, not an error. Show `toString()` there.
- Use `next()`, not `matches()`, to decide what ran: `matches()` reads the wall clock, and the two disagree inside a daylight saving transition.

## Related

- `@sdxc/result` — the `Result` that `parse()` returns; skill `sdxc-result`
- `@sdxc/duration` — the `DurationInput` the `grace` option takes; skill `sdxc-duration`
- `@sdxc/dates` — zone-aware calendar operations and `Intl` formatting for the instants a schedule produces; skill `sdxc-dates`
