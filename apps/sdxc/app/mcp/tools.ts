/**
 * The tools this site offers a model, declared the way routes are: a name, the
 * description a model chooses by, and the schema its arguments satisfy.
 *
 * Every page here already has a markdown twin at a stable URL, so retrieval is solved for
 * anything that can fetch. What a model cannot do is find the thing — ask whether a
 * package exists for a problem, or enumerate sixty names it has never met — so the tools
 * are weighted toward search and enumeration, and none of them merely refetches a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

/** Nothing here writes, and nothing reaches past the content in this deployment. */
const READ_ONLY = { readOnlyHint: true, openWorldHint: false } as const;

/** How many results a caller gets when it names no number. */
const DEFAULT_LIMIT = 10;

export default tools({
	searchDocs: tool("search_docs", {
		title: "Search the documentation",
		description:
			"Search every guide and package reference on this site by page title, heading and summary. Returns the URL of each match, including the heading anchor, and every URL has a .md twin that serves the markdown source. Use this to find where something is explained.",
		input: s.object({
			query: s.string().pipe(checks.minLength(1), checks.maxLength(200)).meta({
				description: "Words to look for. Every word must match for a page to be returned.",
			}),
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(50))
					.meta({ description: "How many results to return." }),
				DEFAULT_LIMIT,
			),
		}),
		annotations: READ_ONLY,
	}),

	packages: tools({
		search: tool("search_packages", {
			title: "Search the packages",
			description:
				"Find packages by what they do, matched against the name, the one-line description and the README text. Ask this first for questions of the form 'is there a package for X'; it answers with names that get_package then reads in full.",
			input: s.object({
				query: s
					.string()
					.pipe(checks.minLength(1), checks.maxLength(200))
					.meta({ description: "What the package would do, in your own words." }),
				limit: s.defaulted(
					s
						.integer()
						.pipe(checks.min(1), checks.max(50))
						.meta({ description: "How many packages to return." }),
					DEFAULT_LIMIT,
				),
			}),
			annotations: READ_ONLY,
		}),

		list: tool("list_packages", {
			title: "List the packages",
			description:
				"List every published package, grouped by the problem it solves. Use this to see the whole set at once; use search_packages when looking for one in particular.",
			input: s.object({
				group: s.optional(
					s.string().pipe(checks.maxLength(100)).meta({
						description:
							"Restrict the listing to one group, named as list_packages reports it. Omit for every group.",
					}),
				),
			}),
			annotations: READ_ONLY,
		}),

		get: tool("get_package", {
			title: "Read a package",
			description:
				"Read one package in full: its README, plus the facts its manifest states — the subpaths it exports, the packages it installs alongside itself, and which applications use it. Needs the short name, without the @sdxc/ scope.",
			input: s.object({
				name: s
					.string()
					.pipe(checks.minLength(1), checks.maxLength(100))
					.meta({ description: "The package's short name, such as 'result' or 'markdown'." }),
			}),
			annotations: READ_ONLY,
		}),
	}),
});
