/**
 * Instants around a reference the caller supplies. The reference is passed in
 * rather than read from the clock, which is what keeps a seeded run producing
 * the same dates tomorrow as it did today.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { add, elapsed, subtract } from "@pkg/dates";
import { toMs } from "@pkg/duration";

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

/** Instants before, after, and between. */
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
}

/** Create the `date` module over one stream and a reference instant. */
export function createDateModule(random: Random, now: Date): DateModule {
	let day = toMs("1 day");

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
	};

	return dates;
}
