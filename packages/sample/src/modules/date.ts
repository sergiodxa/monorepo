/**
 * Instants around a reference the caller supplies. The reference is passed in
 * rather than read from the clock, which is what keeps a seeded run producing
 * the same dates tomorrow as it did today.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { add, elapsed, subtract } from "@sdxc/dates";
import { toMs } from "@sdxc/duration";

import type { Dataset } from "../dataset";
import type { Random } from "../random";

/** Options for an instant measured in days from the reference. */
export interface SpanOptions {
	/** How far the span reaches, 30 days by default. */
	days?: number;
}

/** Options for an instant inside an explicit range. */
export interface BetweenOptions {
	from: Date;
	to: Date;
}

/** Options for several instants inside a range. */
export interface BetweensOptions extends BetweenOptions {
	/** How many instants to return, 3 by default. */
	count?: number;
}

/** Options for a birthdate. */
export interface BirthdateOptions {
	/** Youngest age in years, 18 by default. */
	min?: number;
	/** Oldest age in years, 80 by default. */
	max?: number;
}

/** Options for a month or weekday name. */
export interface NameOptions {
	/** Returns a short form, such as `"Sep"`. */
	abbreviated?: boolean;
}

/** Instants before, after, between, and the calendar words around them. */
export interface DateModule {
	/** An instant in the `days` leading up to the reference. */
	past(options?: SpanOptions): Date;
	/** An instant in the `days` following the reference. */
	future(options?: SpanOptions): Date;
	/**
	 * An instant in `[from, to]`.
	 *
	 * @throws RangeError when either end is an invalid date, or `to` falls
	 * before `from`.
	 */
	between(options: BetweenOptions): Date;
	/** Several instants in `[from, to]`, in ascending order. */
	betweens(options: BetweensOptions): Date[];
	/** An instant in the day or so before the reference. */
	recent(options?: SpanOptions): Date;
	/** An instant in the day or so after the reference. */
	soon(options?: SpanOptions): Date;
	/** An instant within a year either side of the reference. */
	anytime(): Date;
	/** A date of birth putting the person between `min` and `max` years old. */
	birthdate(options?: BirthdateOptions): Date;
	/** A month name. */
	month(options?: NameOptions): string;
	/** A weekday name. */
	weekday(options?: NameOptions): string;
	/** An IANA time zone name. */
	timeZone(): string;
}

/** How many characters an abbreviated month or weekday keeps. */
const ABBREVIATION_LENGTH = 3;

/** Create the `date` module over one stream, dataset, and reference instant. */
export function createDateModule(random: Random, data: Dataset, now: Date): DateModule {
	let day = toMs("1 day");
	let year = toMs("1 day") * 365;

	function name(values: readonly string[], options: NameOptions = {}): string {
		let picked = random.pick(values);
		return options.abbreviated === true ? picked.slice(0, ABBREVIATION_LENGTH) : picked;
	}

	let dates: DateModule = {
		past(options = {}) {
			return dates.between({ from: subtract(now, (options.days ?? 30) * day), to: now });
		},
		future(options = {}) {
			return dates.between({ from: now, to: add(now, (options.days ?? 30) * day) });
		},
		between(options) {
			let span = elapsed(options.from, options.to);
			if (Number.isNaN(span)) throw new RangeError("between() needs two valid dates.");
			if (span < 0) {
				throw new RangeError(
					`between() needs to (${options.to.toISOString()}) at or after from (${options.from.toISOString()}).`,
				);
			}
			return add(options.from, random.int(0, span));
		},
		betweens(options) {
			let count = options.count ?? 3;
			if (!Number.isSafeInteger(count) || count < 0) {
				throw new RangeError(`betweens() needs a count of zero or more, received ${count}.`);
			}
			return Array.from({ length: count }, () => dates.between(options)).sort(
				(left, right) => left.getTime() - right.getTime(),
			);
		},
		recent(options = {}) {
			return dates.past({ days: options.days ?? 1 });
		},
		soon(options = {}) {
			return dates.future({ days: options.days ?? 1 });
		},
		anytime() {
			return dates.between({ from: subtract(now, year), to: add(now, year) });
		},
		birthdate(options = {}) {
			let min = options.min ?? 18;
			let max = options.max ?? 80;
			if (max < min) {
				throw new RangeError(`birthdate() needs max (${max}) to be at least min (${min}).`);
			}
			return dates.between({ from: subtract(now, max * year), to: subtract(now, min * year) });
		},
		month(options) {
			return name(data.months, options);
		},
		weekday(options) {
			return name(data.weekdays, options);
		},
		timeZone() {
			return random.pick(data.timeZones);
		},
	};

	return dates;
}
