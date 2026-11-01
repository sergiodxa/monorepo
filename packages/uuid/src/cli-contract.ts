/**
 * The `sdxc-uuid` command line as a contract: `v4` and `v7` generate identifiers, `validate`
 * checks one and reports its version. Help, usage errors and each handler's typed `ctx.flags`
 * come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The most identifiers one run prints, so a typo in `-n` cannot flood a terminal. */
const MAX_COUNT = 100_000;

/**
 * A count from 1 to {@link MAX_COUNT}, written as digits only, so `+8`, `8.0` and `0x8` are
 * usage errors.
 */
function count(): Schema<unknown, number> {
	return s.createSchema(function validate(value, context) {
		if (typeof value === "string" && /^\d+$/.test(value)) {
			let parsed = Number(value);
			if (parsed >= 1 && parsed <= MAX_COUNT) return { value: parsed };
		}
		return s.fail(
			`expects an integer from 1 to ${MAX_COUNT}; got ${JSON.stringify(value)}`,
			context.path,
		);
	});
}

/** The `-n` flag both generators take: how many identifiers to print, one per line. */
const COUNT = flag.string("count", {
	short: "n",
	valueName: "N",
	default: 1,
	schema: count(),
	description: "How many to print, one per line",
});

/** Every command `sdxc-uuid` takes. */
export const UUID_COMMANDS = commands({
	description: "sdxc-uuid — generate and validate UUIDs",
	v4: command({
		description: "Print random version 4 UUIDs, which reveal nothing about when they were made.",
		flags: { count: COUNT },
		examples: ["v4", "v4 -n 5"],
	}),
	v7: command({
		description:
			"Print time-ordered version 7 UUIDs; each sorts after the one before, within a millisecond too.",
		flags: { count: COUNT },
		examples: ["v7", "v7 -n 1000 > ids.txt"],
	}),
	validate: command({
		description:
			"Check a UUID is lowercase 8-4-4-4-12 hex and print its version, plus its creation time for v7. Exits 1 when it is invalid.",
		arguments: {
			uuid: argument(s.string(), {
				optional: true,
				description: "The UUID to check; stdin when it is - or absent",
			}),
		},
		flags: { json: flag.boolean("json", { description: "Print the result as JSON" }) },
		examples: ["validate 019a6f3e-5c21-7a4b-9d3e-8f1a2b3c4d5e", "validate --json < id.txt"],
	}),
});
