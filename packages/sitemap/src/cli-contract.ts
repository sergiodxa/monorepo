/**
 * The `sdxc-sitemap` command line as a contract: `list` prints every page a sitemap reaches and
 * `validate` checks one against the protocol. Help, usage errors and each handler's typed
 * `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The input both commands take: an http(s) URL to fetch, a file, or `-` for stdin. */
const SOURCE = argument(s.string(), {
	default: "-",
	description: "The sitemap's URL or file; - or absent reads stdin",
});

/** Every command `sdxc-sitemap` takes. */
export const SITEMAP_COMMANDS = commands({
	description: "sdxc-sitemap — read and check sitemaps",
	list: command({
		description:
			"Print every page URL in a sitemap, one per line, fetching each child of a sitemap index.",
		arguments: { source: SOURCE },
		flags: {
			json: flag.boolean("json", {
				description: "Print a JSON array of { loc, lastmod }, lastmod an ISO date or null",
			}),
		},
		examples: [
			"list https://example.com/sitemap.xml",
			"list sitemap.xml --json",
			"cat sitemap.xml | list",
		],
	}),
	validate: command({
		description:
			"Check a sitemap against the protocol: size and row limits, absolute URLs on one host, and each field's format. Exits 1 when it finds a problem.",
		arguments: { source: SOURCE },
		flags: {
			json: flag.boolean("json", {
				description: "Print the result as JSON: { valid, problems: [{ rule, message, row? }] }",
			}),
		},
		examples: ["validate https://example.com/sitemap.xml", "validate sitemap.xml --json"],
	}),
});
