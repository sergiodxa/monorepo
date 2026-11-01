/**
 * The `sdxc-cron` command line as a contract: `next` lists upcoming runs in a time zone,
 * `describe` prints what a schedule means, and `validate` checks an expression. Help, usage
 * errors and each handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import { parseDate } from "@sdxc/dates";
import { isValidTimeZone } from "@sdxc/dates/zone";
import { isFailure } from "@sdxc/result";

/** What a contract schema's `validate` answers: the parsed value, or the message a user reads. */
type Checked<Output> = { value: Output } | { issues: [{ message: string }] };

/** A Standard Schema over the text a flag or argument was typed as. */
interface TextSchema<Output> {
	"~standard": {
		version: 1;
		vendor: string;
		types: { input: unknown; output: Output };
		validate(value: unknown): Checked<Output>;
	};
}

/**
 * A Standard Schema reading typed text with `read`, so the package needs no schema library and a
 * bad value is a usage error naming the flag before any handler runs.
 *
 * @param read - Answers the parsed value, or `null` when the text is rejected
 * @param wanted - What the flag expects, for the error line
 */
function text<Output>(read: (value: string) => Output | null, wanted: string): TextSchema<Output> {
	return {
		"~standard": {
			version: 1,
			vendor: "@sdxc/cron",
			types: { input: "", output: undefined as Output },
			validate(value) {
				let parsed = typeof value === "string" ? read(value) : null;
				if (parsed !== null) return { value: parsed };
				return { issues: [{ message: `expects ${wanted}; got ${JSON.stringify(value)}` }] };
			},
		},
	};
}

/** The expression every command takes: the text as typed, or `-` and absent for stdin. */
function expression() {
	return argument(
		text((value) => value, "an expression"),
		{
			default: "-",
			description: "A five-field cron expression or a macro, quoted; - reads it from stdin",
		},
	);
}

/** The `--json` flag every command takes. */
function json() {
	return flag.boolean("json", { description: "Print the result as JSON" });
}

/** Every command `sdxc-cron` takes. */
export const CRON_COMMANDS = commands({
	description: "sdxc-cron — upcoming runs, descriptions and validation for cron schedules",
	next: command({
		description: "List the next runs strictly after --from, on the wall clock of --tz",
		arguments: { expression: expression() },
		flags: {
			tz: flag.string("tz", {
				valueName: "zone",
				schema: text((value) => (isValidTimeZone(value) ? value : null), "an IANA time zone"),
				description: "The time zone the schedule runs in (default: this machine's)",
			}),
			count: flag.string("count", {
				short: "n",
				valueName: "N",
				default: 5,
				schema: text(
					(value) => (/^\d+$/.test(value) && Number(value) >= 1 ? Number(value) : null),
					"a positive integer",
				),
				description: "How many runs to list",
			}),
			from: flag.string("from", {
				valueName: "date",
				schema: text((value) => {
					let parsed = parseDate(value);
					return isFailure(parsed) ? null : parsed.data;
				}, "a date such as 2026-06-01T09:00:00Z"),
				description: "Start after this instant (default: now)",
			}),
			json: json(),
		},
		examples: [
			'next "*/15 * * * *"',
			'next "0 9 * * MON-FRI" --tz America/New_York -n 3',
			'next "@daily" --from 2026-03-07T12:00:00Z --json',
		],
	}),
	describe: command({
		description: "Print what a schedule means in words, and its normalized expression",
		arguments: { expression: expression() },
		flags: { json: json() },
		examples: ['describe "0 9 * * 1-5"', 'describe "@weekly" --json'],
	}),
	validate: command({
		description:
			"Check an expression: exits 0 printing its normalized form, or 1 naming the field and position at fault",
		arguments: { expression: expression() },
		flags: { json: json() },
		examples: ['validate "0 25 * * *"', "validate - --json < schedule.txt"],
	}),
});
