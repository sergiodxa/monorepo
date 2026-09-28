/**
 * The tools this board offers an agent, declared the way routes are: the name a client
 * calls, the description a model chooses by, and the JSON Schema its arguments satisfy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { tool, tools } from "@sdxc/mcp";

/** Registers the board's tools. */
export default tools({
	searchJobs: tool("search_jobs", {
		title: "Search jobs",
		description:
			"Search the board's open positions by title, company or location. Returns the id, title, company, location and salary of each match; read a position in full through the posting resource.",
		input: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description: "Words to look for, matched against title, company and location.",
					minLength: 1,
					maxLength: 100,
				},
				limit: {
					type: "integer",
					description: "How many positions to return.",
					minimum: 1,
					maximum: 50,
					default: 10,
				},
			},
			required: ["query"],
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
	}),
});
