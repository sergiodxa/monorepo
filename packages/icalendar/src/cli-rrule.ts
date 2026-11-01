/**
 * The `sdxc-icalendar rrule` handler: expands a bare `RRULE` value from a start, so a rule can
 * be checked before it goes into an event. The start counts as the first occurrence, as
 * `DTSTART` does in an event, and occurrences print on the `--time-zone` wall clock.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createCommand, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { ICalendar } from "./types.js";

import { ICALENDAR_COMMANDS } from "./cli-contract.js";
import { formatInstant, instantOf, whenValue } from "./lib/cli-io.js";
import { occurrences, parseRecurrence, stringifyRecurrence } from "./rrule.js";

/** The last instant a rule is expanded to; `--count` ends an unbounded rule well before. */
const HORIZON = Date.UTC(9999, 11, 31);

export default createCommand(
	ICALENDAR_COMMANDS.rrule,
	/** Parses the rule, exiting 1 when it does not parse or expand, and prints its occurrences. */
	(ctx) => {
		let { timeZone, count } = ctx.flags;
		let rule = parseRecurrence(ctx.arguments.rule.replace(/^RRULE:/i, ""));
		if (isFailure(rule)) return rule;

		let start = whenValue(ctx.flags.start, timeZone);
		let event: ICalendar.Event = {
			uid: "sdxc-icalendar-rrule",
			dtstamp: new Date(0),
			start,
			recurrence: rule.data,
			properties: [],
		};
		let from = instantOf(start, timeZone);
		let expanded = occurrences(event, { from, to: HORIZON, limit: count, timeZone });
		if (isFailure(expanded)) return expanded;

		let listed = expanded.data.map(({ start: instant }) => formatInstant(instant, timeZone));
		if (ctx.flags.json) {
			let report = { rule: stringifyRecurrence(rule.data), occurrences: listed };
			ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		} else for (let line of listed) ctx.stdout(`${line}\n`);
		return success();
	},
);
