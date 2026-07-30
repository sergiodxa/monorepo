/**
 * The vocabulary every other module in the package shares: which of the five cron
 * fields an error points at, a wall-clock time inside a descriptor, and the option
 * bags occurrence queries take. Each bag names its time zone, so none is inherited.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@pkg/duration";

/**
 * One of the five fields of a standard cron expression, named in the order they
 * are written. A parse failure carries one of these so a validation message can
 * highlight the field the user got wrong.
 */
export type CronFieldName = "minute" | "hour" | "dayOfMonth" | "month" | "dayOfWeek";

/**
 * A time of day in 24-hour form, as it reads on a wall clock in the evaluation
 * zone. Used inside descriptors, where the app turns the numbers into text.
 */
export interface TimeOfDay {
	hour: number;
	minute: number;
}

/**
 * Where an occurrence search starts and the zone whose wall clock the schedule's
 * fields are read against. `from` is exclusive: an occurrence falling exactly on
 * it belongs to the past, mirroring how a cron daemon has already run it.
 */
export interface OccurrenceOptions {
	from: Date;
	timeZone: string;
}

/**
 * Occurrence search options plus how many occurrences to collect. Omitting
 * `count` asks for a single `Date`; passing it asks for an array of that length.
 */
export interface NextOptions extends OccurrenceOptions {
	count?: number;
}

/** The zone a candidate instant's wall clock is read in when matching fields. */
export interface MatchOptions {
	timeZone: string;
}

/**
 * How late a run may be before it counts as missed: the zone the schedule is
 * evaluated in, plus the tolerance added to the expected instant. An omitted
 * `grace` means no tolerance at all.
 */
export interface ExpectedByOptions {
	timeZone: string;
	grace?: DurationInput;
}

/** Deadline options plus the instant being judged, so no ambient clock is read. */
export interface IsDueOptions extends ExpectedByOptions {
	now: Date;
}
