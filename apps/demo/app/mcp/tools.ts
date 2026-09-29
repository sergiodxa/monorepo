/**
 * The tools this board offers an agent, declared the way routes are: the name a client
 * calls, the description a model chooses by, and the schema its arguments satisfy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { tool, tools } from "@sdxc/mcp";

/** Registers the board's tools. */
export default tools({
	searchJobs: tool("search_jobs", {
		title: "Search jobs",
		description:
			"Search the board's open positions by title, company or location. Returns the id, title, company, location and salary of each match; read a position in full through the posting resource.",
		input: s.object({
			query: s.string().pipe(checks.minLength(1), checks.maxLength(100)).meta({
				description: "Words to look for, matched against title, company and location.",
			}),
			limit: s.defaulted(
				s
					.integer()
					.pipe(checks.min(1), checks.max(50))
					.meta({ description: "How many positions to return." }),
				10,
			),
		}),
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),
});
