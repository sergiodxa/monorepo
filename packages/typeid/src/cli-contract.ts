/**
 * The `sdxc-typeid` command line as a contract: `new` to mint UUIDv7-backed TypeIDs, `parse`
 * to read one back into its prefix, UUID and time, and `encode` to prefix an existing UUID.
 * Help, usage errors and each handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/**
 * A count of at least one written as digits only, so `0`, `-1` and `2.5` are usage errors
 * before anything is generated.
 */
const COUNT: Schema<unknown, number> = s.createSchema(function validate(value, context) {
	if (typeof value === "string" && /^\d+$/u.test(value) && Number(value) >= 1) {
		return { value: Number(value) };
	}
	return s.fail(`expects a positive integer; got ${JSON.stringify(value)}`, context.path);
});

/** Every command `sdxc-typeid` takes. */
export const TYPEID_COMMANDS = commands({
	description: "sdxc-typeid — generate, parse and encode TypeIDs",
	new: command({
		description: "Generate TypeIDs backed by UUIDv7, so they sort by creation time",
		arguments: {
			prefix: argument(s.string(), {
				description: "Lowercase letters and underscores naming what the id identifies",
			}),
		},
		flags: {
			count: flag.string("count", {
				short: "n",
				valueName: "count",
				default: 1,
				schema: COUNT,
				description: "How many ids to print, one per line",
			}),
		},
		examples: ["new user", "new session -n 5"],
	}),
	parse: command({
		description: "Read a TypeID back into its prefix, UUID and, for a UUIDv7, its creation time",
		arguments: {
			typeid: argument(s.string(), { description: "The TypeID to read" }),
		},
		flags: {
			json: flag.boolean("json", { description: "Print the result as JSON" }),
		},
		examples: [
			"parse user_01h455vb4pex5vsknk084sn02q",
			"parse user_01h455vb4pex5vsknk084sn02q --json",
		],
	}),
	encode: command({
		description: "Write an existing UUID as a TypeID under a prefix",
		arguments: {
			prefix: argument(s.string(), { description: "The prefix to apply" }),
			uuid: argument(s.string(), { description: "A canonical lowercase UUID" }),
		},
		examples: ["encode user 01890a5d-ac96-774b-bcce-b302099a8057"],
	}),
});
