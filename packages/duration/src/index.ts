/**
 * Public surface of the duration package: the duration string type, the input
 * union every consumer declares, the conversions to milliseconds and seconds,
 * and the runtime parser with its error. Nothing here touches a `Date`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DurationInput, DurationString } from "./types";
export type { DurationUnit, DurationUnitShort } from "./units";

export { InvalidDurationError } from "./invalid-duration-error";
export { parse } from "./parse";
export { toMs } from "./to-ms";
export { toSeconds } from "./to-seconds";
