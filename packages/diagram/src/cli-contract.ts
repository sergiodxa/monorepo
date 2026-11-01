/**
 * The `sdxc-diagram` command line as a contract: `render` draws a Mermaid file as SVG and
 * `check` reads one without drawing it. Help, usage errors and each handler's typed
 * `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-diagram` takes. */
export const DIAGRAM_COMMANDS = commands({
	description: "sdxc-diagram — Mermaid sequence, class, state and flowchart diagrams to SVG",
	render: command({
		description:
			"Draw a Mermaid diagram as SVG. Source the package cannot read exits 2 naming its line and column.",
		arguments: {
			file: argument(s.string(), {
				default: "-",
				description: "The Mermaid source file; - or absent reads stdin",
			}),
		},
		flags: {
			output: flag.string("output", {
				short: "o",
				valueName: "file",
				description: "Write the SVG to this file instead of stdout",
			}),
			alt: flag.string("alt", {
				valueName: "text",
				description: "The drawing's accessible name, in place of the source's title",
			}),
		},
		examples: ["render flow.mmd", "render flow.mmd --output flow.svg", "cat flow.mmd | render"],
	}),
	check: command({
		description:
			"Read a Mermaid diagram without drawing it. Exits 1 when it uses syntax outside the supported subset.",
		arguments: {
			file: argument(s.string(), {
				default: "-",
				description: "The Mermaid source file; - or absent reads stdin",
			}),
		},
		flags: {
			json: flag.boolean("json", {
				description: "Print the result as JSON: { valid, reason?, line?, column? }",
			}),
		},
		examples: ["check flow.mmd", "check flow.mmd --json"],
	}),
});
