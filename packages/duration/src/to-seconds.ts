/**
 * Conversion to whole seconds, the unit HTTP cache headers and platform TTLs
 * count in. It exists as a separate call so a seconds-based API is handed
 * seconds deliberately and can never receive milliseconds by accident.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "./types.js";

import { toMs } from "./to-ms.js";
import { SECOND_MS } from "./units.js";

/**
 * Convert a duration to whole seconds, rounding to the nearest second with
 * halves rounding up. Durations under half a second round down to `0`, which
 * most seconds-based APIs read as no caching; a bypassed type propagates as `NaN`.
 *
 * @param input - A duration string, or a number of milliseconds.
 * @returns The duration in whole seconds.
 *
 * @example
 * toSeconds("1 hour"); // 3600
 * @example
 * toSeconds(1500); // 2
 */
export function toSeconds(input: DurationInput): number {
	return Math.round(toMs(input) / SECOND_MS);
}
