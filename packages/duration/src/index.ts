/**
 * Public surface of the duration package: the duration string type, the input
 * union every consumer declares, the conversions to milliseconds and seconds,
 * and the runtime parser with its error, all expressed as plain numbers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DurationInput, DurationString } from "./types.js";
export type { DurationUnit, DurationUnitShort } from "./units.js";

export { InvalidDurationError } from "./invalid-duration-error.js";
export { parse } from "./parse.js";
export { toMs } from "./to-ms.js";
export { toSeconds } from "./to-seconds.js";
