/**
 * The input side every `sdxc-jscalendar` command shares: the document read from a path or
 * stdin, its format detected from the text, and either format read into a JSCalendar object.
 * An input that cannot be read is an exit-2 failure, so each handler only forwards it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { ExitError, Stdin } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { exit } from "@sdxc/cli";
import { parse as parseICalendar } from "@sdxc/icalendar";
import { isFailure, success, wrap } from "@sdxc/result";

import type { JSCalendar } from "./types.js";

import { fromICalendar } from "./icalendar.js";

import { parse } from "./index.js";

/** A calendar format the command line reads and writes. */
export type Format = "jscalendar" | "icalendar";

/** The exit code for usage errors and input that cannot be read. */
const UNREADABLE = 2;

/**
 * The document's text: the file at `file`, resolved against the run's directory, or stdin
 * when `file` is `-` or absent. A terminal on stdin fails at once, so a run never waits.
 *
 * @param ctx - The run's directory and stdin
 * @param file - The path argument as typed
 * @returns The text, or an exit-2 failure naming what could not be read
 */
export async function readInput(
	ctx: { cwd: string; stdin: Stdin },
	file: string | undefined,
): Promise<Result<string, ExitError>> {
	if (file === undefined || file === "-") {
		if (ctx.stdin.isTTY) return exit(UNREADABLE, "No input: pass a file, or pipe one on stdin");
		return success(await ctx.stdin.text());
	}
	let read = await wrap(() => readFile(resolve(ctx.cwd, file), "utf8"));
	if (isFailure(read)) return exit(UNREADABLE, `Cannot read ${file}: ${read.error.message}`);
	return success(read.data);
}

/**
 * The format the text is written in: iCalendar when it opens with `BEGIN:VCALENDAR`, in any
 * case and after leading whitespace, and JSCalendar for anything else.
 *
 * @param text - The document's text
 */
export function detectFormat(text: string): Format {
	return /^\s*BEGIN:VCALENDAR/i.test(text) ? "icalendar" : "jscalendar";
}

/**
 * The document as a JSCalendar object: JSCalendar validated as written, and iCalendar
 * converted to a Group. Text that is not valid in its format is an exit-2 failure.
 *
 * @param text - The document's text
 * @param format - The format to read it as
 * @returns The Event, Task or Group, or an exit-2 failure with the parse error
 */
export function readCalendar(
	text: string,
	format: Format,
): Result<JSCalendar.CalendarObject, ExitError> {
	if (format === "icalendar") {
		let parsed = parseICalendar(text);
		if (isFailure(parsed)) {
			return exit(UNREADABLE, `Invalid iCalendar: ${parsed.error.message}`);
		}
		return success(fromICalendar(parsed.data.calendar));
	}
	let parsed = parse(text);
	if (isFailure(parsed)) return exit(UNREADABLE, parsed.error.message);
	return parsed;
}
