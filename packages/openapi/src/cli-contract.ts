/**
 * The `sdxc-openapi` command line as a contract: `check` reads an OpenAPI 3.1 document from a
 * file, a URL or stdin and reports what keeps it from being one. Help, usage errors and the
 * handler's typed `ctx.flags` come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-openapi` takes. */
export const OPENAPI_COMMANDS = commands({
	description: "sdxc-openapi — check OpenAPI 3.1 documents",
	check: command({
		description:
			"Check a JSON or YAML OpenAPI 3.1 document; prints each finding at its JSON Pointer and exits 1 on any",
		arguments: {
			document: argument(s.string(), {
				optional: true,
				valueName: "document",
				description: "A file path or an http(s) URL; stdin when - or left out",
			}),
		},
		flags: {
			json: flag.boolean("json", { description: "Print the result as JSON" }),
		},
		examples: [
			"check openapi.json",
			"check https://api.example.com/openapi.json --json",
			"check - < openapi.yaml",
		],
	}),
});
