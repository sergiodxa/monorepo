/**
 * The `sdxc-html` command line as a contract: `query` finds elements of a served page by role
 * and accessible name, `outline` lists its headings and landmarks. Help, usage errors and the handler's typed `ctx.arguments` and
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-html` takes. */
export const HTML_COMMANDS = commands({
	description: "sdxc-html — read a served page by role and accessible name",
	query: command({
		description:
			"List the elements with a role, and a name when given. Exits 1 when nothing matches, so it works as a smoke check.",
		arguments: {
			source: argument(s.string(), {
				default: "-",
				description: "An http(s) URL, an HTML file, or - / absent to read stdin",
			}),
		},
		flags: {
			role: flag.string("role", { required: true, description: "The ARIA role to match" }),
			name: flag.string("name", { description: "The whole accessible name to match" }),
			includeHidden: flag.boolean("include-hidden", {
				description: "Also match elements the markup hides",
			}),
			json: flag.boolean("json", {
				description:
					"Print the matches as JSON: [{ tag, role, name, text, value, attributes, disabled, position }]",
			}),
		},
		examples: [
			'query https://example.com --role button --name "Sign in"',
			"query page.html --role heading --json",
		],
	}),
	outline: command({
		description: "List the page's headings and landmarks in document order",
		arguments: {
			source: argument(s.string(), {
				default: "-",
				description: "An http(s) URL, an HTML file, or - / absent to read stdin",
			}),
		},
		flags: {
			json: flag.boolean("json", {
				description: "Print the outline as JSON: [{ kind, role, tag, name, level? }]",
			}),
		},
		examples: ["outline https://example.com", "outline page.html --json"],
	}),
});
