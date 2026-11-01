/**
 * The `sdxc-distill` command line as a contract: `extract <url|file>` with its output format and
 * the `User-Agent` a retrieval names itself with. Help, usage errors and the handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-distill` takes. */
export const DISTILL_COMMANDS = commands({
	description: "sdxc-distill — extract the article from a web page",
	extract: command({
		description:
			"Print the article a page carries: its title, byline and sanitized body. Exits 1 when the page has no article or the site refused or ran out of time.",
		arguments: {
			source: argument(s.string(), {
				default: "-",
				description: "An http(s) URL, a saved HTML file, or - for stdin",
			}),
		},
		flags: {
			format: flag.string("format", {
				default: "html",
				schema: s.enum_(["html", "text", "json"] as const),
				description: "html (the sanitized body), text (readable text) or json (every field)",
			}),
			json: flag.boolean("json", { description: "Same as --format json" }),
			url: flag.string("url", {
				description:
					"The address a file or stdin was served from, which relative links resolve against",
			}),
			userAgent: flag.string("user-agent", {
				default: "sdxc-distill (+https://sdxc.dev)",
				description: "The User-Agent a URL is requested with",
			}),
		},
		examples: [
			"extract https://example.com/post",
			"extract page.html --url https://example.com/post --format text",
			"curl -s https://example.com/post | sdxc-distill extract --json",
		],
	}),
});
