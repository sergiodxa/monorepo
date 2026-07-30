/**
 * Conversion to whole seconds, the unit HTTP cache headers and platform TTLs
 * count in. It exists as a separate call so a seconds-based API is handed
 * seconds deliberately and can never receive milliseconds by accident.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "./types";

import { toMs } from "./to-ms";
import { SECOND_MS } from "./units";

/**
 * Convert a duration to whole seconds, rounding to the nearest second with
 * halves rounding up, so `"1500ms"` is `2` and `"1400ms"` is `1`.
 *
 * Anything under half a second rounds down to `0`, which most seconds-based
 * APIs read as "no caching" — pass a duration of at least `"1 second"` when that
 * matters. A bypassed type propagates as `NaN`, matching `toMs()`.
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
