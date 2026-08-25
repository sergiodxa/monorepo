/**
 * The duration vocabulary shared by every package that takes a length of time:
 * a compile-time-checked duration string and the input union consumers declare.
 * A bare number is always milliseconds, so a unit is never inferred silently.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationUnit, DurationUnitShort } from "./units";

/**
 * A duration written as text: a whole amount plus a unit, spelled out after a
 * space or abbreviated with none. The amount is `${bigint}`, so only whole,
 * canonical amounts such as `30` type-check.
 *
 * @example
 * let lifetime: DurationString = "30 days";
 * @example
 * let backoff: DurationString = "250ms";
 */
export type DurationString = `${bigint} ${DurationUnit}` | `${bigint}${DurationUnitShort}`;

/**
 * What a duration-taking API declares: a checked duration string, or a bare
 * number already counted in milliseconds. Consumers normalize internally with
 * `toMs()` or `toSeconds()` so their own unit is stated once.
 *
 * @example
 * function schedule(delay: DurationInput) { return setTimeout(run, toMs(delay)); }
 */
export type DurationInput = number | DurationString;
