/**
 * The `sdxc-robots` command line as a contract: `check` says whether a crawler may fetch a URL
 * and which rule decides it, and `parse` reads a robots.txt into its groups, rules and sitemaps.
 * Help, usage errors and each handler's typed `ctx.arguments` and `ctx.flags` come from here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-robots` takes. */
export const ROBOTS_COMMANDS = commands({
	description: "sdxc-robots — read and evaluate robots.txt (RFC 9309)",
	check: command({
		description:
			"Say whether an agent may fetch a URL, and the rule that decides it. Fetches the origin's robots.txt unless --robots names one. Exits 1 when the URL is disallowed.",
		arguments: {
			url: argument(s.string(), {
				description: "The URL to check; a /-rooted path works with --robots",
			}),
		},
		flags: {
			agent: flag.string("agent", {
				short: "a",
				valueName: "name",
				description: "The crawler's user-agent; its product token picks the groups (default: *)",
			}),
			robots: flag.string("robots", {
				valueName: "file|url",
				description: "Read this robots.txt instead of the origin's; - reads stdin",
			}),
			json: flag.boolean("json", {
				description:
					"Print the result as JSON: { url, agent, allowed, rule, robots, status, httpStatus? }",
			}),
		},
		examples: [
			"check https://example.com/private/report",
			"check https://example.com/feed.xml --agent GPTBot --json",
			"check /admin --robots public/robots.txt",
		],
	}),
	parse: command({
		description:
			"Read a robots.txt and print it normalized, or its groups, rules and sitemaps with --json. An origin with no readable robots.txt exits 2.",
		arguments: {
			source: argument(s.string(), {
				default: "-",
				description: "A robots.txt file, any URL on an origin, or - (or absent) for stdin",
			}),
		},
		flags: {
			json: flag.boolean("json", {
				description: "Print the document as JSON: { groups, sitemaps, records }",
			}),
		},
		examples: ["parse robots.txt", "parse https://example.com --json", "cat robots.txt | parse"],
	}),
});
