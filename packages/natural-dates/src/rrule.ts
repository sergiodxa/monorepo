/**
 * Writes a found repeat as an iCalendar `RRULE` value, for a calendar stored as iCalendar rather
 * than JSCalendar. `UNTIL` is written as a floating date-time, the day's end on the event's own
 * clock, which RFC 5545 accepts beside a floating `DTSTART`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RepeatRule } from "./types.js";

/**
 * The rule as an `RRULE` value: `FREQ`, then `INTERVAL`, `BYDAY`, `UNTIL` and `COUNT` when set.
 *
 * @param rule A repeat `find` returned.
 * @returns The value, without the `RRULE:` name.
 * @example toRRule({ frequency: "weekly", interval: 2, byDay: [{ day: "tu" }] }) // "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU"
 */
export function toRRule(rule: RepeatRule): string {
	let parts = [`FREQ=${rule.frequency.toUpperCase()}`];
	if (rule.interval !== undefined && rule.interval > 1) parts.push(`INTERVAL=${rule.interval}`);
	if (rule.byDay && rule.byDay.length > 0)
		parts.push(`BYDAY=${rule.byDay.map((entry) => entry.day.toUpperCase()).join(",")}`);
	if (rule.until !== undefined)
		parts.push(`UNTIL=${rule.until.replaceAll("-", "").replaceAll(":", "")}`);
	if (rule.count !== undefined) parts.push(`COUNT=${rule.count}`);
	return parts.join(";");
}
