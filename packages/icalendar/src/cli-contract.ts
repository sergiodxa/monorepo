/**
 * The `sdxc-icalendar` command line as a contract: `validate` a calendar, `expand` its events
 * into occurrences over a window, and list the occurrences of a bare `rrule`. Help, usage
 * errors and each handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import { isValidTimeZone } from "@sdxc/dates/zone";
import * as s from "remix/data-schema";

import { WHEN_PATTERN } from "./lib/cli-io.js";

/** A positive decimal integer, written as digits only, so `+8`, `8.0` and `0x8` are usage errors. */
const POSITIVE_INTEGER: Schema<unknown, number> = s.createSchema(function validate(value, context) {
	if (typeof value === "string" && /^\d+$/.test(value) && Number(value) > 0) {
		return { value: Number(value) };
	}
	return s.fail(`expects a positive integer; got ${JSON.stringify(value)}`, context.path);
});

/** A date, a local date-time, or a date-time with `Z` or an offset, kept as written. */
const WHEN: Schema<unknown, string> = s.createSchema(function validate(value, context) {
	if (typeof value === "string" && WHEN_PATTERN.test(value)) return { value };
	return s.fail(
		`expects YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS][Z|±HH:MM]; got ${JSON.stringify(value)}`,
		context.path,
	);
});

/** An IANA zone `Intl` knows. */
const TIME_ZONE: Schema<unknown, string> = s.createSchema(function validate(value, context) {
	if (typeof value === "string" && isValidTimeZone(value)) return { value };
	return s.fail(`expects an IANA time zone; got ${JSON.stringify(value)}`, context.path);
});

/** The calendar file every calendar command reads, stdin when absent or `-`. */
const FILE = argument(s.string(), {
	default: "-",
	description: "The .ics file, or - for stdin",
});

/** The zone flag shared by every command that reads or prints a wall clock. */
const TIME_ZONE_FLAG = flag.string("time-zone", {
	aliases: ["tz"],
	valueName: "zone",
	default: "UTC",
	schema: TIME_ZONE,
	description: "Read dates and floating times, and print occurrences, in this IANA zone",
});

/** The flag that switches a report to JSON. */
const JSON_FLAG = flag.boolean("json", { description: "Print the report as JSON" });

/** Every command `sdxc-icalendar` takes. */
export const ICALENDAR_COMMANDS = commands({
	description: "sdxc-icalendar — check iCalendar files and expand their recurrences",
	validate: command({
		description:
			"Check a calendar's structure, properties, values, TZIDs and rules; exit 1 on a problem",
		arguments: { file: FILE },
		flags: { json: JSON_FLAG },
		examples: [
			"validate team.ics",
			"curl -s https://example.com/feed.ics | sdxc-icalendar validate",
		],
	}),
	expand: command({
		description:
			"List the occurrences overlapping a window, from RRULE, RDATE, EXDATE and overrides",
		arguments: { file: FILE },
		flags: {
			from: flag.string("from", {
				required: true,
				valueName: "date",
				schema: WHEN,
				description: "The window's start, inclusive",
			}),
			until: flag.string("until", {
				required: true,
				valueName: "date",
				schema: WHEN,
				description: "The window's end, exclusive",
			}),
			limit: flag.string("limit", {
				valueName: "N",
				default: 1000,
				schema: POSITIVE_INTEGER,
				description: "Print at most N occurrences",
			}),
			timeZone: TIME_ZONE_FLAG,
			json: JSON_FLAG,
		},
		examples: [
			"expand team.ics --from 2026-11-01 --until 2026-12-01",
			"expand team.ics --from 2026-11-01 --until 2026-11-08 --time-zone Europe/Madrid --json",
		],
	}),
	rrule: command({
		description:
			"List the first occurrences of a bare RRULE from a start, which counts as the first",
		arguments: {
			rule: argument(s.string(), { description: "The rule, with or without RRULE:" }),
		},
		flags: {
			start: flag.string("start", {
				required: true,
				valueName: "date",
				schema: WHEN,
				description: "DTSTART: a date for an all-day rule, a local date-time read in --time-zone",
			}),
			count: flag.string("count", {
				short: "n",
				valueName: "N",
				default: 10,
				schema: POSITIVE_INTEGER,
				description: "Print at most N occurrences",
			}),
			timeZone: TIME_ZONE_FLAG,
			json: JSON_FLAG,
		},
		examples: [
			'rrule "FREQ=WEEKLY;BYDAY=MO,WE" --start 2026-11-02T09:30 --time-zone Europe/Madrid',
			'rrule "FREQ=MONTHLY;BYDAY=-1FR" --start 2026-11-27 -n 12 --json',
		],
	}),
});
