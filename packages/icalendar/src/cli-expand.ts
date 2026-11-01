/**
 * The `sdxc-icalendar expand` handler: lists every event's occurrences overlapping a window,
 * overrides included, printed on the `--time-zone` wall clock. One tab-separated line per
 * occurrence (start, end, summary or UID) for people, or `--json` for scripts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createCommand, exit, success, usage } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { ICALENDAR_COMMANDS } from "./cli-contract.js";
import { formatInstant, instantOf, readInput, whenValue } from "./lib/cli-io.js";
import { calendarOccurrences } from "./rrule.js";

import { parseAll } from "./index.js";

/** One occurrence in the `--json` report; `summary` is `null` for an event without one. */
interface ReportedOccurrence {
	uid: string;
	summary: string | null;
	start: string;
	end: string;
}

export default createCommand(
	ICALENDAR_COMMANDS.expand,
	/**
	 * Expands every calendar in the file over `[--from, --until)`. An empty window is a usage
	 * error, unreadable input exits 2, and an event that cannot expand exits 1 naming why.
	 */
	async (ctx) => {
		let { timeZone, limit } = ctx.flags;
		let from = instantOf(whenValue(ctx.flags.from, timeZone), timeZone);
		let to = instantOf(whenValue(ctx.flags.until, timeZone), timeZone);
		if (!(to > from)) return usage("--until must be later than --from");

		let input = await readInput(ctx.arguments.file, ctx);
		if (isFailure(input)) return exit(2, input.error.message);
		let parsed = parseAll(input.data);
		if (isFailure(parsed)) return exit(2, `Not a readable calendar: ${parsed.error.message}`);

		let found: { at: number; occurrence: ReportedOccurrence }[] = [];
		for (let { calendar } of parsed.data) {
			let expanded = calendarOccurrences(calendar, { from, to, limit, timeZone });
			if (isFailure(expanded)) return expanded;
			for (let { start, end, event } of expanded.data) {
				let occurrence = {
					uid: event.uid,
					summary: event.summary ?? null,
					start: formatInstant(start, timeZone),
					end: formatInstant(end, timeZone),
				};
				found.push({ at: start, occurrence });
			}
		}
		let occurrences = found
			.sort((a, b) => a.at - b.at)
			.slice(0, limit)
			.map(({ occurrence }) => occurrence);

		if (ctx.flags.json) ctx.stdout(`${JSON.stringify({ occurrences }, null, 2)}\n`);
		else {
			for (let { start, end, summary, uid } of occurrences) {
				ctx.stdout(`${start}\t${end}\t${summary ?? uid}\n`);
			}
		}
		return success();
	},
);
