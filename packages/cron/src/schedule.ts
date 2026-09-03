/**
 * The `Schedule` value object: a parsed cron expression that answers when it fires
 * next, whether an instant matches it, how to describe it, and whether a run that
 * should have happened is overdue. Parsing returns a `Result` and nothing throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";

import { toMs } from "@sdxc/duration";
import { isFailure, success } from "@sdxc/result";

import type { ScheduleDescriptor } from "./describe";
import type { CronFieldSet } from "./fields";
import type { InvalidCronExpression } from "./invalid-cron-expression";
import type {
	ExpectedByOptions,
	IsDueOptions,
	MatchOptions,
	NextOptions,
	OccurrenceOptions,
} from "./types";

import { describeFields } from "./describe";
import { normalizeExpression } from "./normalize";
import { matchesInstant, nextOccurrence, previousOccurrence } from "./occurrences";
import { parseExpression } from "./parse-expression";

/**
 * A cron schedule: immutable, cheap to hold, and safe to parse once and reuse.
 * Every query names its time zone, and evaluating in the zone a schedule was
 * configured in keeps a daily 09:00 job at 09:00 local through a DST shift.
 *
 * @example
 * let result = Schedule.parse("0 9 * * 1-5");
 * if (isFailure(result)) return validationError(result.error);
 * let when = result.data.next({ from: new Date(), timeZone: "America/New_York" });
 */
export class Schedule {
	/**
	 * Parse a cron expression: five standard fields, or an `@hourly`–`@yearly`
	 * macro. Six fields, and non-standard extensions (`L`, `W`, `#`, `?`), are
	 * rejected as outside what this package promises.
	 *
	 * @param expression - The expression as written, whitespace and case as typed.
	 * @returns The schedule, or an `InvalidCronExpression` naming the field and the
	 * index a validation message should point at.
	 *
	 * @example
	 * Schedule.parse("0 9 * * 1-5"); // success
	 * @example
	 * Schedule.parse("0 25 * * *"); // failure: out-of-range in the hour field
	 */
	static parse(expression: string): Result<Schedule, InvalidCronExpression> {
		let parsed = parseExpression(expression);
		if (isFailure(parsed)) return parsed;
		return success(new Schedule(parsed.data));
	}

	/** The value sets each field stands for, the whole state of a schedule. */
	private readonly fields: CronFieldSet;

	/** The normalized expression, computed once because `toString` is for logs. */
	private readonly normalized: string;

	/** The descriptor, computed once and frozen, since the fields never change. */
	private readonly descriptor: ScheduleDescriptor;

	/**
	 * Wraps already-parsed fields. Private so a `Schedule` can only come from
	 * {@link Schedule.parse}, which means an instance is always a valid schedule.
	 *
	 * @param fields - Field value sets from the parser.
	 */
	private constructor(fields: CronFieldSet) {
		this.fields = Object.freeze(fields);
		this.normalized = normalizeExpression(fields);
		this.descriptor = describeFields(fields);
		Object.freeze(this);
	}

	/**
	 * The next occurrence strictly after `from`, so an instant that is itself an
	 * occurrence returns the one after it, matching a daemon that has already run it.
	 *
	 * @param options - Where to start and the zone to evaluate in.
	 * @returns The occurrence, or an invalid `Date` when the zone is unknown to the
	 * runtime, which is the only way a parsed schedule fails to produce one.
	 *
	 * @example
	 * schedule.next({ from: new Date(), timeZone: "Europe/Madrid" });
	 */
	next(options: OccurrenceOptions & { count?: undefined }): Date;

	/**
	 * The next `count` occurrences after `from`, each one after the last.
	 *
	 * @param options - Where to start, the zone to evaluate in, and how many to take.
	 * @returns The occurrences in order; empty when `count` is not a positive number,
	 * and shorter than asked only if the search runs past its horizon.
	 *
	 * @example
	 * schedule.next({ from: new Date(), timeZone: "UTC", count: 5 });
	 */
	next(options: OccurrenceOptions & { count: number }): Date[];

	next(options: NextOptions): Date | Date[] {
		if (options.count === undefined) {
			let instant = nextOccurrence(this.fields, options.from.getTime(), options.timeZone);
			return new Date(instant ?? Number.NaN);
		}

		let occurrences: Date[] = [];
		let cursor = options.from.getTime();

		for (let taken = 0; taken < options.count; taken++) {
			let instant = nextOccurrence(this.fields, cursor, options.timeZone);
			if (instant === null) break;
			occurrences.push(new Date(instant));
			cursor = instant;
		}

		return occurrences;
	}

	/**
	 * The last occurrence strictly before `from`.
	 *
	 * @param options - Where to start and the zone to evaluate in.
	 * @returns The occurrence, or an invalid `Date` for a zone unknown to the runtime.
	 *
	 * @example
	 * schedule.prev({ from: new Date(), timeZone: "America/New_York" });
	 */
	prev(options: OccurrenceOptions): Date {
		let instant = previousOccurrence(this.fields, options.from.getTime(), options.timeZone);
		return new Date(instant ?? Number.NaN);
	}

	/**
	 * Whether the minute `date` falls in is one the schedule fires in. Seconds are
	 * ignored, because cron resolves to minutes.
	 *
	 * @param date - The instant to test.
	 * @param options - The zone whose wall clock the fields are read against.
	 * @returns `true` when every field matches, `false` for an unknown zone.
	 *
	 * @example
	 * schedule.matches(new Date(), { timeZone: "UTC" });
	 */
	matches(date: Date, options: MatchOptions): boolean {
		return matchesInstant(this.fields, date.getTime(), options.timeZone);
	}

	/**
	 * A structured description of the schedule, for an app to turn into text in the
	 * user's language. `{ kind: "expression" }` means no concise shape fits and the
	 * normalized expression is the best thing to show.
	 *
	 * @returns The frozen descriptor, the same object on every call.
	 *
	 * @example
	 * schedule.describe(); // { kind: "daily", at: [{ hour: 9, minute: 0 }] }
	 */
	describe(): ScheduleDescriptor {
		return this.descriptor;
	}

	/**
	 * The normalized expression: names resolved to numbers, macros expanded, values
	 * sorted. Meant for storage and logs, never for display to a user.
	 *
	 * @returns The five fields separated by single spaces.
	 *
	 * @example
	 * unwrap(Schedule.parse("@weekly")).toString(); // "0 0 * * 0"
	 */
	toString(): string {
		return this.normalized;
	}

	/**
	 * The instant a run that follows `lastRun` must have arrived by: the next
	 * occurrence after it, plus the grace period a late run is still tolerated in.
	 *
	 * @param lastRun - When the schedule last ran, e.g. the last ping received.
	 * @param options - The zone to evaluate in and the tolerance to add.
	 * @returns The deadline, or an invalid `Date` for a zone unknown to the runtime.
	 *
	 * @example
	 * schedule.expectedBy(lastPing, { timeZone: "UTC", grace: "5 minutes" });
	 */
	expectedBy(lastRun: Date, options: ExpectedByOptions): Date {
		let instant = nextOccurrence(this.fields, lastRun.getTime(), options.timeZone);
		if (instant === null) return new Date(Number.NaN);
		return new Date(instant + graceMs(options.grace));
	}

	/**
	 * Whether a run is overdue: the occurrence following `lastRun`, plus its grace
	 * period, is at or before `now`. This is the question a dead man's switch asks,
	 * with `lastRun` standing for the last signal received.
	 *
	 * @param lastRun - When the schedule last ran.
	 * @param options - The instant to judge against, the zone, and the tolerance.
	 * @returns `true` once the deadline has been reached, `false` while there is
	 * still time and for a zone unknown to the runtime.
	 *
	 * @example
	 * schedule.isDue(lastPing, { now: new Date(), timeZone: "UTC", grace: "5 minutes" });
	 */
	isDue(lastRun: Date, options: IsDueOptions): boolean {
		let deadline = this.expectedBy(lastRun, options).getTime();
		if (Number.isNaN(deadline)) return false;
		return options.now.getTime() >= deadline;
	}
}

/**
 * The grace period in milliseconds. An omitted period is no tolerance, and text the
 * duration type would have rejected is treated the same way rather than throwing,
 * since it can only arrive here through a cast or an unchecked runtime value.
 *
 * @param grace - The configured tolerance, if any.
 * @returns Milliseconds to add to an expected instant.
 */
function graceMs(grace: DurationInput | undefined): number {
	if (grace === undefined) return 0;
	let ms = toMs(grace);
	return Number.isFinite(ms) ? ms : 0;
}
