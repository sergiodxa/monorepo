/**
 * The `next` handler: the schedule's upcoming runs from `Schedule.next`, each printed as an
 * RFC 9557 timestamp on the zone's wall clock, so a developer can see when a job fires before
 * deploying it, across daylight saving changes included.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { formatZonedDateTime } from "@sdxc/dates";
import { isFailure } from "@sdxc/result";

import { CRON_COMMANDS } from "./cli-contract.js";
import { describeInvalid, loadSchedule } from "./cli-input.js";
import { InvalidCronExpression } from "./invalid-cron-expression.js";

/**
 * Prints one run per line, or `{ expression, timeZone, from, occurrences }` with `--json`, where
 * each occurrence carries its UTC `instant` and its `local` zoned time. An unreadable or invalid
 * expression exits 2. Without `--tz` the runs are read on this machine's zone.
 */
export default createCommand(CRON_COMMANDS.next, async (ctx) => {
	let loaded = await loadSchedule(ctx.arguments.expression, ctx.stdin);
	if (isFailure(loaded)) {
		if (!(loaded.error instanceof InvalidCronExpression)) return exit(2, loaded.error.message);
		ctx.stderr(describeInvalid(loaded.error));
		return exit(2);
	}
	let { schedule } = loaded.data;
	let timeZone = ctx.flags.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
	let from = ctx.flags.from ?? new Date();
	let occurrences = schedule.next({ from, timeZone, count: ctx.flags.count });

	if (ctx.flags.json) {
		let report = {
			expression: schedule.toString(),
			timeZone,
			from: from.toISOString(),
			occurrences: occurrences.map((date) => ({
				instant: date.toISOString(),
				local: formatZonedDateTime({ date, timeZone }),
			})),
		};
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		for (let date of occurrences) ctx.stdout(`${formatZonedDateTime({ date, timeZone })}\n`);
	}
	return success();
});
