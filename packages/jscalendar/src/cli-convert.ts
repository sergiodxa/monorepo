/**
 * The `sdxc-jscalendar convert` handler: a JSCalendar Event, Task or Group written as an
 * iCalendar file, or an iCalendar file read into a JSCalendar Group. Exits 1 when an object
 * uses something iCalendar cannot express, and 2 when the input cannot be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, failure, success, usage } from "@sdxc/cli";
import { stringify as stringifyICalendar } from "@sdxc/icalendar";
import { isFailure } from "@sdxc/result";

import { JSCALENDAR_COMMANDS } from "./cli-contract.js";
import { detectFormat, readCalendar, readInput } from "./cli-input.js";
import { toICalendar } from "./icalendar.js";

import { stringify } from "./index.js";

/**
 * Converts the document to the `--to` format, the input format taken from `--from` or
 * detected from the text; asking for the format the input is already in is a usage error.
 */
export default createCommand(JSCALENDAR_COMMANDS.convert, async (ctx) => {
	let text = await readInput(ctx, ctx.arguments.file);
	if (isFailure(text)) return text;
	let from = ctx.flags.from ?? detectFormat(text.data);
	if (from === ctx.flags.to) return usage(`The input is already ${from}; nothing to convert`);

	let object = readCalendar(text.data, from);
	if (isFailure(object)) return object;
	if (ctx.flags.to === "jscalendar") {
		ctx.stdout(`${stringify(object.data, 2)}\n`);
		return success();
	}
	let calendar = toICalendar(object.data);
	if (isFailure(calendar)) return failure(calendar.error);
	ctx.stdout(stringifyICalendar(calendar.data));
	return success();
});
