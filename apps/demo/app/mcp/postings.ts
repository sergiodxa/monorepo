/**
 * How a posting reads over MCP. A tool answers with the few fields a model ranks a position
 * by, and a resource answers with the whole document a person attaching it expects, so the
 * two shapes are stated once here rather than inside the handlers that return them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Posting } from "~/database/schema";

import resourceset from "~/app/mcp/resources";

/** The summary `search_jobs` returns, carrying the id `get_job` reads and the resource URI. */
export function summarize(posting: Posting) {
	return {
		id: posting.id,
		uri: resourceset.posting.href({ id: posting.id }),
		title: posting.title,
		company: posting.company,
		location: posting.location,
		salary: posting.salary,
	};
}

/** One entry in the resource picker: the position's URI and the line a person picks by. */
export function toEntry(posting: Posting) {
	return {
		uri: resourceset.posting.href({ id: posting.id }),
		name: `${posting.title} — ${posting.company}`,
	};
}

/** One position as the Markdown document a client renders. */
export function toMarkdown(posting: Posting): string {
	return [
		`# ${posting.title}`,
		`**${posting.company}** — ${posting.location} — ${posting.salary}`,
		posting.description,
		`Apply: ${posting.contact_email}`,
	].join("\n\n");
}
