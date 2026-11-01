/**
 * The `describe` handler: turns the structured `schedule.describe()` into one English sentence
 * for a person at a terminal, with the normalized expression beside it. Apps translate the
 * descriptor themselves; this wording belongs to the command line alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { ScheduleDescriptor } from "./describe.js";
import type { TimeOfDay } from "./types.js";

import { CRON_COMMANDS } from "./cli-contract.js";
import { describeInvalid, loadSchedule } from "./cli-input.js";
import { InvalidCronExpression } from "./invalid-cron-expression.js";

/** Weekday names indexed as the cron field counts them, from `0` for Sunday. */
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Month names indexed from `0`, one below the cron field's numbering. */
const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/**
 * Items joined as English prose: `a`, `a and b`, `a, b and c`.
 *
 * @param items - The words to join, in order
 */
function list(items: readonly string[]): string {
	if (items.length <= 1) return items.join("");
	return `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/**
 * The times of day as 24-hour `HH:MM` prose.
 *
 * @param at - The descriptor's times, on the evaluation zone's wall clock
 */
function times(at: readonly TimeOfDay[]): string {
	return list(
		at.map(
			({ hour, minute }) => `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
		),
	);
}

/**
 * One sentence for a descriptor; a schedule without a concise shape reads as its expression.
 *
 * @param descriptor - What `schedule.describe()` answered
 * @param expression - The normalized expression, for the `expression` kind
 */
function sentence(descriptor: ScheduleDescriptor, expression: string): string {
	switch (descriptor.kind) {
		case "interval":
			return descriptor.every === 1
				? `Every ${descriptor.unit}`
				: `Every ${descriptor.every} ${descriptor.unit}s`;
		case "hourly":
			return `Every hour at minute ${list(descriptor.minutes.map(String))}`;
		case "daily":
			return `Every day at ${times(descriptor.at)}`;
		case "weekly":
			return `Every ${list(descriptor.weekdays.map((day) => WEEKDAYS[day] ?? String(day)))} at ${times(descriptor.at)}`;
		case "monthly":
			return `On day ${list(descriptor.days.map(String))} of every month at ${times(descriptor.at)}`;
		case "yearly":
			return `On day ${list(descriptor.days.map(String))} of ${list(descriptor.months.map((month) => MONTHS[month - 1] ?? String(month)))} at ${times(descriptor.at)}`;
		case "expression":
			return `On the schedule ${expression}`;
	}
}

/**
 * Prints the sentence and the normalized expression, or `{ expression, normalized, summary,
 * descriptor }` with `--json`. Times are wall-clock times in whichever zone the schedule runs
 * in. An unreadable or invalid expression exits 2.
 */
export default createCommand(CRON_COMMANDS.describe, async (ctx) => {
	let loaded = await loadSchedule(ctx.arguments.expression, ctx.stdin);
	if (isFailure(loaded)) {
		if (!(loaded.error instanceof InvalidCronExpression)) return exit(2, loaded.error.message);
		ctx.stderr(describeInvalid(loaded.error));
		return exit(2);
	}
	let { expression, schedule } = loaded.data;
	let normalized = schedule.toString();
	let descriptor = schedule.describe();
	let summary = sentence(descriptor, normalized);

	if (ctx.flags.json) {
		let report = { expression, normalized, summary, descriptor };
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		ctx.stdout(`${summary}\nExpression: ${normalized}\n`);
	}
	return success();
});
