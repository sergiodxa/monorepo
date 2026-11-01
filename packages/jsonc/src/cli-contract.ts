/**
 * The `sdxc-jsonc` command line as a contract: `check` reports where a JSONC document breaks and
 * `strip` prints it as plain JSON. Help, usage errors and each handler's typed `ctx.flags` all
 * come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The JSONC document both commands read: a path, or stdin when `-` or absent. */
const INPUT = argument(s.string(), {
	optional: true,
	description: "The JSONC file; - or absent reads stdin",
});

/** Every command `sdxc-jsonc` takes. */
export const JSONC_COMMANDS = commands({
	description: "sdxc-jsonc — check JSON with comments and strip it to plain JSON",
	check: command({
		description:
			"Check a JSONC document such as tsconfig.json; prints each parse error as file:line:column and exits 1 on any",
		arguments: { file: INPUT },
		flags: {
			json: flag.boolean("json", { description: "Print the result as JSON" }),
		},
		examples: ["check tsconfig.json", "check wrangler.jsonc --json", "cat settings.json | check"],
	}),
	strip: command({
		description:
			"Print a JSONC document as plain JSON: comments and trailing commas become spaces, so every line and column stays where it was. Text that is not JSONC exits 2.",
		arguments: { file: INPUT },
		flags: {
			indent: flag.number("indent", {
				valueName: "N",
				schema: s.number().refine((n) => Number.isInteger(n) && n >= 0 && n <= 10, "expects 0-10"),
				description: "Reformat the value with N spaces per level; 0 prints it on one line",
			}),
		},
		examples: ["strip tsconfig.json", "strip wrangler.jsonc --indent 2 > wrangler.json"],
	}),
});
