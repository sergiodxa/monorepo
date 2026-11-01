/**
 * The `sdxc-semver` command line as a contract: `valid`, `compare` and `sort`, all read by
 * SemVer 2.0.0 precedence with no range syntax. Help, usage errors and each handler's typed
 * `ctx.arguments` and `ctx.flags` come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The flag printing a command's result as JSON. */
const JSON_OUTPUT = flag.boolean("json", { description: "Print the result as JSON" });

/** Every command `sdxc-semver` takes. */
export const SEMVER_COMMANDS = commands({
	description: "sdxc-semver — SemVer 2.0.0 validation, comparison and sorting",
	valid: command({
		description:
			"Check a version and print it without its leading v or build metadata; exit 1 when it is not a version.",
		arguments: {
			version: argument(s.string(), { description: "The version to check, e.g. v1.2.3-rc.1" }),
		},
		flags: { json: JSON_OUTPUT },
		examples: ["valid v1.2.3", "valid 1.0.0-rc.1+build.5 --json"],
	}),
	compare: command({
		description:
			"Print -1 when a precedes b, 0 when they rank equally and 1 when a follows b; exit 2 when either is not a version.",
		arguments: {
			a: argument(s.string(), { description: "The left-hand version" }),
			b: argument(s.string(), { description: "The right-hand version" }),
		},
		examples: ["compare 1.0.0-rc.1 1.0.0", "compare 2026.10.1 2026.9.4"],
	}),
	sort: command({
		description:
			"Print versions one per line in precedence order, oldest first; read them one per line from stdin when none are given. Exit 2 naming every entry that is not a version.",
		arguments: {
			versions: argument.variadic(s.string(), { description: "The versions to sort" }),
		},
		flags: {
			reverse: flag.boolean("reverse", { description: "Print the newest version first" }),
			json: JSON_OUTPUT,
		},
		examples: ["sort 1.10.0 1.9.0 1.0.0-rc.1", "git tag | sort --reverse"],
	}),
});
