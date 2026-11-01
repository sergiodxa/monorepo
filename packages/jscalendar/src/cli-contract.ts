/**
 * The `sdxc-jscalendar` command line as a contract: `convert` between JSCalendar and iCalendar,
 * `expand` recurrences inside a window, and `validate` a JSCalendar document. Help, usage errors
 * and each handler's typed `ctx.flags` come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The calendar formats the command line reads and writes. */
const FORMAT_SCHEMA = s.enum_(["jscalendar", "icalendar"]);

/** The input every command reads: a path, or stdin when it is `-` or left out. */
const FILE_ARGUMENT = argument(s.string(), {
	optional: true,
	valueName: "file",
	description: "The document to read; stdin when - or left out",
});

/** Every command `sdxc-jscalendar` takes. */
export const JSCALENDAR_COMMANDS = commands({
	description: "sdxc-jscalendar — convert, expand and validate RFC 8984 JSCalendar documents",
	convert: command({
		description:
			"Convert a JSCalendar document to iCalendar or an iCalendar file to a JSCalendar Group",
		arguments: { file: FILE_ARGUMENT },
		flags: {
			to: flag.string("to", {
				valueName: "format",
				required: true,
				schema: FORMAT_SCHEMA,
				description: "The output format, jscalendar or icalendar",
			}),
			from: flag.string("from", {
				valueName: "format",
				schema: FORMAT_SCHEMA,
				description: "The input format, jscalendar or icalendar (default: detected from the text)",
			}),
		},
		examples: ["convert event.json --to icalendar", "convert - --to jscalendar < calendar.ics"],
	}),
	expand: command({
		description:
			"List the occurrences of every event and task in a JSCalendar or iCalendar document inside a window",
		arguments: { file: FILE_ARGUMENT },
		flags: {
			from: flag.string("from", {
				valueName: "date",
				required: true,
				description: "The window's start, inclusive: 2026-11-01 or 2026-11-01T09:00:00Z",
			}),
			until: flag.string("until", {
				valueName: "date",
				required: true,
				description: "The window's end, exclusive, written like --from",
			}),
			timeZone: flag.string("time-zone", {
				valueName: "zone",
				default: "UTC",
				description: "The IANA zone floating times and dates without an offset are read in",
			}),
			limit: flag.number("limit", {
				default: 1000,
				description: "The most occurrences listed",
			}),
			json: flag.boolean("json", { description: "Print the occurrences as JSON" }),
		},
		examples: [
			"expand standup.json --from 2026-11-01 --until 2026-12-01",
			"expand calendar.ics --from 2026-11-01 --until 2026-11-08 --time-zone Europe/Madrid --json",
		],
	}),
	validate: command({
		description: "Check a JSCalendar Event, Task or Group against RFC 8984; exits 1 on any problem",
		arguments: { file: FILE_ARGUMENT },
		flags: {
			json: flag.boolean("json", { description: "Print the result as JSON" }),
		},
		examples: ["validate event.json", "validate group.json --json"],
	}),
});
