/**
 * The `sdxc-jsdoc` command line as a contract: `extract` reads JSDoc from source files and
 * directories into one JSON documentation project. Help, usage errors and the handler's typed
 * `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-jsdoc` takes. */
export const JSDOC_COMMANDS = commands({
	description: "sdxc-jsdoc — JSDoc from JavaScript and TypeScript sources as JSON",
	extract: command({
		description:
			"Extract the exported symbols of every source file into one JSON project. A file that does not parse is listed on stderr and exits 1, writing nothing, unless --keep-going.",
		arguments: {
			paths: argument.variadic(s.string(), {
				default: ["-"],
				valueName: "path",
				description:
					"Source files and directories, walked for .ts, .tsx, .mts, .cts, .js, .jsx, .mjs and .cjs files outside node_modules and dot-directories; - or absent reads stdin",
			}),
		},
		flags: {
			output: flag.string("output", {
				short: "o",
				valueName: "file",
				description: "Write the JSON to this file instead of stdout",
			}),
			name: flag.string("name", {
				valueName: "name",
				description: "The project's name (default: the name in ./package.json)",
			}),
			projectVersion: flag.string("project-version", {
				valueName: "version",
				description: "The project's version (default: the version in ./package.json)",
			}),
			includeInternal: flag.boolean("include-internal", {
				description: "Keep symbols tagged @internal",
			}),
			keepGoing: flag.boolean("keep-going", {
				description: "Leave out files that do not parse and exit 0 with the rest",
			}),
			stdinPath: flag.string("stdin-path", {
				valueName: "path",
				default: "module.ts",
				description: "The path stdin is documented under; .tsx and .jsx enable JSX",
			}),
		},
		examples: [
			"extract src --output docs.json",
			"extract src/index.ts src/add.ts --include-internal",
			"extract --stdin-path src/button.tsx < button.tsx",
		],
	}),
});
