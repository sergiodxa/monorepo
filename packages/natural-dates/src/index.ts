/**
 * Public surface of natural-dates: `find` reads the English date, time, duration and repeat
 * phrases in a text against a clock and a zone, `strip` takes them back out, and `toRRule` writes
 * a found repeat for iCalendar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { FindOptions, Found, Match, MatchValue, RepeatRule, Weekday } from "./types.js";

export { find } from "./find.js";
export { NaturalDatesError } from "./natural-dates-error.js";
export { toRRule } from "./rrule.js";
export { strip } from "./strip.js";
