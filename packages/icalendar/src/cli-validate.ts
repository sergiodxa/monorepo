/**
 * The `sdxc-icalendar validate` handler: reads every `VCALENDAR` in a file and reports what a
 * client would trip on, one problem per line or as JSON. Structural errors, reader warnings
 * and events whose zones or rules cannot expand are all problems, and any of them exits 1.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import type { ICalendar } from "./types.js";

import { ICALENDAR_COMMANDS } from "./cli-contract.js";
import { readInput } from "./lib/cli-io.js";
import { occurrences } from "./rrule.js";

import { parseAll } from "./index.js";

/** One problem in the report; `line` is absent for a problem found after reading. */
interface Problem {
	line?: number;
	message: string;
}

/** The `--json` report. */
interface Report {
	valid: boolean;
	calendars: number;
	events: number;
	problems: Problem[];
}

/**
 * A reader warning, `Line 3: VEVENT has no UID`, as a problem with its line apart.
 *
 * @param warning - The warning as the reader wrote it
 */
function problemOf(warning: string): Problem {
	let match = /^Line (\d+): (.*)$/s.exec(warning);
	if (!match) return { message: warning };
	return { line: Number(match[1]), message: match[2] ?? warning };
}

/**
 * The events whose `TZID`s, rule or dates cannot be expanded, found by expanding each over an
 * empty-ended window, which resolves every zone the event names.
 *
 * @param calendar - A parsed calendar
 */
function expansionProblems(calendar: ICalendar.Calendar): Problem[] {
	let problems: Problem[] = [];
	for (let event of calendar.events) {
		let expanded = occurrences(event, { from: 0, to: 1, calendar, limit: 1 });
		if (isFailure(expanded)) {
			problems.push({ message: `VEVENT ${event.uid || "without UID"}: ${expanded.error.message}` });
		}
	}
	return problems;
}

/**
 * Prints the report and exits 1 when it holds a problem.
 *
 * @param report - What validation found
 * @param json - Whether to print JSON
 * @param print - Writes to stdout
 */
function respond(report: Report, json: boolean, print: (text: string) => void) {
	if (json) print(`${JSON.stringify(report, null, 2)}\n`);
	else {
		for (let { line, message } of report.problems) {
			print(line === undefined ? `${message}\n` : `Line ${line}: ${message}\n`);
		}
		let calendars = `${report.calendars} ${report.calendars === 1 ? "calendar" : "calendars"}`;
		let events = `${report.events} ${report.events === 1 ? "event" : "events"}`;
		let count = report.problems.length;
		print(
			report.valid
				? `Valid: ${calendars}, ${events}\n`
				: `${count} ${count === 1 ? "problem" : "problems"} in ${calendars}, ${events}\n`,
		);
	}
	return report.valid ? success() : exit(1);
}

export default createCommand(
	ICALENDAR_COMMANDS.validate,
	/** Reads the file, collects every problem, and reports them; unreadable input exits 2. */
	async (ctx) => {
		let input = await readInput(ctx.arguments.file, ctx);
		if (isFailure(input)) return exit(2, input.error.message);

		let print = (text: string) => ctx.stdout(text);
		let parsed = parseAll(input.data);
		if (isFailure(parsed)) {
			let { line, message } = problemOf(parsed.error.message);
			let problem = line === undefined ? { message } : { line, message };
			return respond(
				{ valid: false, calendars: 0, events: 0, problems: [problem] },
				ctx.flags.json,
				print,
			);
		}

		let problems: Problem[] = [];
		let events = 0;
		for (let { calendar, warnings } of parsed.data) {
			problems.push(...warnings.map(problemOf), ...expansionProblems(calendar));
			events += calendar.events.length;
		}
		if (parsed.data.length === 0) problems.push({ message: "the text holds no VCALENDAR" });
		return respond(
			{ valid: problems.length === 0, calendars: parsed.data.length, events, problems },
			ctx.flags.json,
			print,
		);
	},
);
