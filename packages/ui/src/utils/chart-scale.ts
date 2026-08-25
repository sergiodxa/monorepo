/**
 * Pure numeric math behind the chart components: mapping data values onto
 * pixel space along a continuous or categorical axis, generating evenly
 * spaced "nice" axis labels, and allocating a pie chart's wedges around a
 * circle. Every export is a plain function operating on numbers and
 * strings, with no knowledge of SVG, the DOM, or rendering — directly
 * unit-testable and reusable ahead of any drawing step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FULL_TURN_RADIANS } from "./full-turn-radians";

/**
 * Thresholds {@link niceStep} compares a candidate step's residual against
 * to choose a multiplier of 1, 2, 5, or 10 — the geometric midpoints between
 * those multipliers (the square roots of 50, 10, and 2).
 */
const NICE_STEP_THRESHOLD_10 = Math.sqrt(50);
const NICE_STEP_THRESHOLD_5 = Math.sqrt(10);
const NICE_STEP_THRESHOLD_2 = Math.sqrt(2);

/**
 * Options accepted by {@link linearScale}.
 */
export namespace LinearScale {
	/**
	 * Options tuning how {@link linearScale} handles an input outside the
	 * domain it was built from.
	 */
	export interface Options {
		/**
		 * When `true`, an input outside the domain maps to the nearer end of
		 * the range instead of extrapolating past it. Defaults to `false`,
		 * extrapolating past the corresponding end of the range.
		 */
		clamp?: boolean;
	}
}

/**
 * Builds a function mapping a continuous numeric domain onto a continuous
 * numeric range through linear interpolation — the position math behind a
 * chart's axis, where a descending range inverts growth direction.
 *
 * @param domain The `[start, end]` bounds of the input values.
 * @param range The `[start, end]` bounds the output is mapped onto.
 * @param options Tuning for out-of-domain inputs.
 * @returns A function mapping a value from `domain` to the matching position in `range`.
 * @example
 * let x = linearScale([0, 100], [0, 320]);
 * x(50); // 160
 * @example
 * let y = linearScale([0, 10], [200, 0]); // inverted, for SVG's downward y-axis
 * y(0); // 200
 * y(10); // 0
 */
export function linearScale(
	domain: readonly [number, number],
	range: readonly [number, number],
	options: LinearScale.Options = {},
): (value: number) => number {
	let [domainStart, domainEnd] = domain;
	let [rangeStart, rangeEnd] = range;
	let clamp = options.clamp ?? false;
	let domainSpan = domainEnd - domainStart;

	return (value: number): number => {
		let fraction = domainSpan === 0 ? 0 : (value - domainStart) / domainSpan;
		if (clamp) fraction = Math.min(1, Math.max(0, fraction));
		return rangeStart + fraction * (rangeEnd - rangeStart);
	};
}

/**
 * Options and result types for {@link bandScale}.
 */
export namespace BandScale {
	/**
	 * Options controlling the gap {@link bandScale} leaves between and
	 * around bands, each expressed as a fraction of a single band's step
	 * (the space one domain key occupies including its share of the gap).
	 */
	export interface Options {
		/**
		 * Fraction of a band's step reserved as a gap between adjacent
		 * bands. `0` (the default) packs bands edge to edge; `1` would
		 * shrink every band to zero width.
		 */
		paddingInner?: number;
		/**
		 * Fraction of a band's step reserved as a gap before the first band
		 * and after the last one. Defaults to `0`, which starts the first
		 * band flush with the start of the range.
		 */
		paddingOuter?: number;
	}

	/**
	 * The band scale {@link bandScale} returns: a shared bandwidth every key
	 * occupies, and a lookup from a domain key to that band's start
	 * position.
	 */
	export interface Scale {
		/** Width, in output units, of every band — the size to draw a bar or category column at. */
		readonly bandwidth: number;
		/**
		 * Start offset, in output units, of `key`'s band, or `undefined`
		 * when `key` isn't part of the domain this scale was built from.
		 *
		 * @param key Domain key to look up.
		 */
		position(key: string): number | undefined;
	}
}

/**
 * Builds a scale mapping a categorical domain (bar chart categories, a pie
 * chart's legend order) onto evenly sized, evenly spaced bands within a
 * continuous range, in `domain`'s order — a bar chart's category axis.
 *
 * @param domain The ordered category keys to lay out; duplicate keys share
 * the first matching position.
 * @param range The `[start, end]` bounds the bands are laid out across.
 * @param options Padding between and around bands.
 * @returns A scale exposing each band's shared width and a per-key position lookup.
 * @example
 * let x = bandScale(["a", "b", "c"], [0, 300]);
 * x.bandwidth; // 100
 * x.position("b"); // 100
 * @example
 * let x = bandScale(["a", "b", "c"], [0, 250], { paddingInner: 0.5 });
 * x.bandwidth; // 50
 * x.position("b"); // 100
 */
export function bandScale(
	domain: readonly string[],
	range: readonly [number, number],
	options: BandScale.Options = {},
): BandScale.Scale {
	let paddingInner = options.paddingInner ?? 0;
	let paddingOuter = options.paddingOuter ?? 0;
	let [rangeStart, rangeEnd] = range;
	let n = domain.length;

	let step =
		n === 0 ? 0 : (rangeEnd - rangeStart) / Math.max(1, n - paddingInner + paddingOuter * 2);
	let start = rangeStart + step * paddingOuter;
	let bandwidth = step * (1 - paddingInner);

	return {
		bandwidth,
		position(key: string): number | undefined {
			let index = domain.indexOf(key);
			if (index === -1) return undefined;
			return start + step * index;
		},
	};
}

/**
 * A "nice" step size decomposed into `multiplier * 10 ** exponent`, with
 * `multiplier` always `1`, `2`, or `5`. {@link ticks} applies this
 * decomposition to keep every generated value an exact decimal number.
 */
interface NiceStep {
	/** Always `1`, `2`, or `5`. */
	multiplier: number;
	/** Power of ten `multiplier` scales by; negative for a step below one. */
	exponent: number;
}

/**
 * Picks the "nice" step {@link ticks} advances by: a power of ten
 * multiplied by 1, 2, or 5, chosen so dividing `[lo, hi]` by it lands as
 * close as possible to `count` round-decimal steps.
 *
 * @param lo Lower bound of the span to step across.
 * @param hi Upper bound of the span to step across.
 * @param count Approximate number of steps the result should produce.
 * @returns The chosen step. A multiplier of 10 folds into the next power of
 * ten, so the returned `multiplier` always stays `1`, `2`, or `5`.
 */
function niceStep(lo: number, hi: number, count: number): NiceStep {
	let rawStep = (hi - lo) / count;
	let exponent = Math.floor(Math.log10(rawStep));
	let magnitude = 10 ** exponent;
	let residual = rawStep / magnitude;

	let multiplier = 1;
	if (residual >= NICE_STEP_THRESHOLD_10) multiplier = 10;
	else if (residual >= NICE_STEP_THRESHOLD_5) multiplier = 5;
	else if (residual >= NICE_STEP_THRESHOLD_2) multiplier = 2;

	return multiplier === 10 ? { multiplier: 1, exponent: exponent + 1 } : { multiplier, exponent };
}

/**
 * Resolves a decomposed {@link NiceStep} to its plain numeric value.
 *
 * @param step Step to resolve.
 * @returns `step.multiplier * 10 ** step.exponent`.
 */
function stepValue(step: NiceStep): number {
	return step.exponent >= 0
		? step.multiplier * 10 ** step.exponent
		: step.multiplier / 10 ** -step.exponent;
}

/**
 * Computes the `index`-th multiple of a decomposed {@link NiceStep},
 * applying a step below one through division by a power of ten to land
 * on an exact decimal value, free of floating-point rounding drift.
 *
 * @param index Which multiple of the step to compute.
 * @param step Step to apply.
 * @returns `index * step`, computed to land on an exact decimal value.
 */
function tickAt(index: number, step: NiceStep): number {
	return step.exponent >= 0
		? index * step.multiplier * 10 ** step.exponent
		: (index * step.multiplier) / 10 ** -step.exponent;
}

/**
 * Generates an approximately evenly spaced sequence of "nice" round numbers
 * spanning a domain — the label positions along a chart's value axis. A
 * "nice" step is always a power of ten multiplied by 1, 2, or 5.
 *
 * @param domain The `[start, end]` bounds to generate tick values across.
 * `start` may be greater than `end`, in which case the result descends from
 * `start` to `end` instead of ascending.
 * @param count Approximate number of ticks to generate.
 * @returns The generated tick values, ordered to match the direction of
 * `domain`. The array's length can differ from `count` since a "nice" step
 * rarely divides the domain into exactly that many pieces.
 * @example
 * ticks([0, 100], 5); // [0, 20, 40, 60, 80, 100]
 * @example
 * ticks([0, 1], 5); // [0, 0.2, 0.4, 0.6, 0.8, 1]
 * @example
 * ticks([5, 5], 3); // [5]
 */
export function ticks(domain: readonly [number, number], count: number): number[] {
	let [start, stop] = domain;
	if (count <= 0) return [];
	if (start === stop) return [start];

	let descending = stop < start;
	let lo = descending ? stop : start;
	let hi = descending ? start : stop;

	let step = niceStep(lo, hi, count);
	let value = stepValue(step);
	if (value === 0 || !Number.isFinite(value)) return [];

	let first = Math.round(lo / value);
	let last = Math.round(hi / value);
	if (tickAt(first, step) < lo) first++;
	if (tickAt(last, step) > hi) last--;

	let values: number[] = [];
	for (let i = first; i <= last; i++) {
		values.push(tickAt(i, step));
	}

	return descending ? values.reverse() : values;
}

/**
 * Options and result types for {@link pieAngles}.
 */
export namespace PieAngles {
	/**
	 * Options tuning the span {@link pieAngles} allocates across and the
	 * gap it leaves between adjacent slices.
	 */
	export interface Options {
		/** Angle, in radians, where the first slice begins. Defaults to `0`. */
		startAngle?: number;
		/**
		 * Angle, in radians, where the last slice ends. Defaults to
		 * `startAngle` plus a full turn (2π), sweeping the values around a
		 * complete circle.
		 */
		endAngle?: number;
		/**
		 * Gap, in radians, left between each pair of adjacent slices. Not
		 * applied before the first slice or after the last one. Defaults to
		 * `0`.
		 */
		padAngle?: number;
	}

	/**
	 * One allocated wedge of a {@link pieAngles} result, in the same order
	 * as the input `values`.
	 */
	export interface Slice {
		/** The input value this slice represents, unchanged. */
		value: number;
		/** Angle, in radians, where this slice's arc begins. */
		startAngle: number;
		/** Angle, in radians, where this slice's arc ends. */
		endAngle: number;
	}
}

/**
 * Allocates a pie or donut chart's wedges: divides the span from
 * `startAngle` to `endAngle` into one slice per value, sized by its share
 * of the total, with an optional gap between adjacent slices.
 *
 * @param values The magnitude each slice represents, in the order the wedges should be drawn.
 * @param options Tuning for the total span and the gap between slices.
 * @returns One {@link PieAngles.Slice} per input value, in the same order.
 * A negative value produces a zero-width slice, and an all-zero set of
 * values splits the span evenly across all slices.
 * @example
 * pieAngles([1, 1, 2]);
 * // [
 * //   { value: 1, startAngle: 0, endAngle: Math.PI / 2 },
 * //   { value: 1, startAngle: Math.PI / 2, endAngle: Math.PI },
 * //   { value: 2, startAngle: Math.PI, endAngle: Math.PI * 2 },
 * // ]
 */
export function pieAngles(
	values: readonly number[],
	options: PieAngles.Options = {},
): PieAngles.Slice[] {
	let startAngle = options.startAngle ?? 0;
	let endAngle = options.endAngle ?? startAngle + FULL_TURN_RADIANS;
	let padAngle = options.padAngle ?? 0;

	let n = values.length;
	if (n === 0) return [];

	let sum = values.reduce((total, value) => total + Math.max(0, value), 0);

	let totalSpan = endAngle - startAngle;
	let direction = totalSpan < 0 ? -1 : 1;
	let available = totalSpan - direction * padAngle * (n - 1);

	let cursor = startAngle;
	let slices: PieAngles.Slice[] = [];

	for (let [i, value] of values.entries()) {
		let weight = Math.max(0, value);
		let fraction = sum > 0 ? weight / sum : 1 / n;
		let sliceStart = cursor;
		let sliceEnd = sliceStart + fraction * available;

		slices.push({ value, startAngle: sliceStart, endAngle: sliceEnd });

		cursor = i < n - 1 ? sliceEnd + direction * padAngle : sliceEnd;
	}

	return slices;
}
