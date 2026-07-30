/**
 * Conversion to milliseconds, the unit JavaScript time arithmetic and timers
 * count in. This is the normalization every consumer runs on the
 * `DurationInput` it declares, so call sites can read `"1 hour"` instead of a
 * product of sixties.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess } from "@pkg/result";

import type { DurationInput } from "./types";

import { parse } from "./parse";

/**
 * Convert a duration to milliseconds. A bare number is already milliseconds and
 * passes through untouched, which keeps existing numeric call sites working.
 *
 * Malformed text is a compile error, so the failure path is only reachable
 * through a cast or an unchecked runtime value; it yields `NaN` rather than
 * throwing, and `parse()` is the entry point that reports why.
 *
 * @param input - A duration string, or a number of milliseconds.
 * @returns The duration in milliseconds, or `NaN` if the type was bypassed.
 *
 * @example
 * toMs("5 minutes"); // 300000
 * @example
 * toMs("30s"); // 30000
 * @example
 * toMs(1500); // 1500
 */
export function toMs(input: DurationInput): number {
	if (typeof input === "number") return input;
	let result = parse(input);
	if (isSuccess(result)) return result.data;
	return Number.NaN;
}
