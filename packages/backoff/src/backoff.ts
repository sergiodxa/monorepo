/**
 * Retry delay schedules: how long to wait after the Nth failure, from a growth
 * curve or a hand-written table, with a ceiling, free attempts and jitter drawn
 * from an injectable `Random`, so a seeded test asserts exact delays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DurationInput } from "@sdxc/duration";
import type { Random } from "@sdxc/random";

import { toMs } from "@sdxc/duration";
import { systemRandom } from "@sdxc/random";

/** A schedule answering how long to wait after a given number of failures. */
export interface Backoff {
	/**
	 * Milliseconds to wait after `attempt` failures, counting from 1. A
	 * non-positive attempt and a free attempt both answer `0`.
	 */
	delay(attempt: number): number;
	/** The epoch milliseconds of the next try: `now` plus `delay(attempt)`. */
	at(attempt: number, now: number): number;
}

/**
 * How jitter spreads a delay: a fraction in `[0, 1]` draws from
 * `delay × (1 ± fraction)`, and `"full"` draws from `[0, delay]`.
 */
export type Jitter = number | "full";

/** Options every schedule accepts, whatever shapes its delays. */
export interface BackoffSharedOptions {
	/**
	 * Failures that answer `0`; the schedule's first delay belongs to the
	 * failure right after them.
	 * @default 0
	 */
	free?: number;
	/** Spread applied after the ceiling, so retries waiting at the cap still spread out. */
	jitter?: Jitter;
	/**
	 * The stream jitter draws from; pass a seeded one to make delays exact.
	 * @default systemRandom()
	 */
	random?: Random;
}

/** A schedule computed from a base delay and a growth rule. */
export interface BackoffCurveOptions extends BackoffSharedOptions {
	/** The delay after the first counted failure. */
	base: DurationInput;
	/**
	 * `"exponential"` multiplies by `factor` per failure, `"linear"` adds `base`
	 * per failure, and `"constant"` repeats `base`.
	 * @default "exponential"
	 */
	growth?: "exponential" | "linear" | "constant";
	/**
	 * The multiplier per failure of an exponential schedule.
	 * @default 2
	 */
	factor?: number;
	/** The ceiling a delay reaches before jitter; unbounded when omitted. */
	max?: DurationInput;
}

/** A schedule chosen by hand, one step per failure, the last one repeating. */
export interface BackoffStepsOptions extends BackoffSharedOptions {
	/** The delay after each counted failure, in order. */
	steps: readonly DurationInput[];
}

/** Either shape `createBackoff` accepts. */
export type BackoffOptions = BackoffCurveOptions | BackoffStepsOptions;

/**
 * Build a schedule. Options are validated once here, so `delay` and `at`
 * never fail afterwards.
 *
 * @throws RangeError for a negative or unparseable base, step or ceiling, a
 * `factor` below 1, a `max` below `base`, a `jitter` outside `[0, 1]`, empty
 * `steps`, or a `free` that is not a non-negative integer.
 * @example createBackoff({ base: "15 seconds", max: "12 hours", jitter: 0.2 }).delay(3); // 60_000 ± 20%
 * @example createBackoff({ steps: ["1 minute", "5 minutes", "1 hour"] }).at(attempts, Date.now());
 */
export function createBackoff(options: BackoffOptions): Backoff {
	let free = options.free ?? 0;
	if (!Number.isSafeInteger(free) || free < 0) {
		throw new RangeError(`free needs a non-negative integer, received ${free}.`);
	}

	let jitter = options.jitter;
	if (typeof jitter === "number" && !(jitter >= 0 && jitter <= 1)) {
		throw new RangeError(`jitter needs a fraction in [0, 1] or "full", received ${jitter}.`);
	}

	let random = options.random ?? systemRandom();
	let curve = "steps" in options ? stepsCurve(options) : growthCurve(options);

	let backoff: Backoff = {
		delay(attempt) {
			let counted = attempt - free;
			if (!(counted >= 1)) return 0;
			let delay = curve(counted);
			if (jitter === undefined || jitter === 0) return delay;
			if (jitter === "full") return Math.round(random.float(0, delay));
			return Math.round(delay * random.float(1 - jitter, 1 + jitter));
		},
		at(attempt, now) {
			return now + backoff.delay(attempt);
		},
	};

	return backoff;
}

/**
 * Convert a duration option to milliseconds, rejecting the negative values
 * and unparseable strings that `toMs` reports as `NaN`.
 */
function nonNegativeMs(name: string, input: DurationInput): number {
	let ms = toMs(input);
	if (!(ms >= 0)) throw new RangeError(`${name} needs a non-negative duration, received ${input}.`);
	return ms;
}

/**
 * The pre-jitter delay of a growth schedule for a counted failure (1 or more).
 * An unbounded exponential schedule reaches `Infinity` once the product
 * overflows.
 */
function growthCurve(options: BackoffCurveOptions): (counted: number) => number {
	let base = nonNegativeMs("base", options.base);
	let factor = options.factor ?? 2;
	if (!(factor >= 1)) throw new RangeError(`factor needs to be at least 1, received ${factor}.`);
	let max = options.max === undefined ? Infinity : nonNegativeMs("max", options.max);
	if (max < base) throw new RangeError(`max (${max}ms) needs to be at least base (${base}ms).`);

	let growth = options.growth ?? "exponential";
	return (counted) => {
		if (growth === "constant") return Math.min(base, max);
		if (growth === "linear") return Math.min(base * counted, max);
		return Math.min(base * factor ** (counted - 1), max);
	};
}

/** The pre-jitter delay of a stepped schedule, repeating the last step past the end. */
function stepsCurve(options: BackoffStepsOptions): (counted: number) => number {
	if (options.steps.length === 0) throw new RangeError("steps needs at least one delay.");
	let steps = options.steps.map((step, index) => nonNegativeMs(`steps[${index}]`, step));
	return (counted) => steps[Math.min(counted, steps.length) - 1] as number;
}
