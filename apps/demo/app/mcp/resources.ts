/**
 * The board's resources: one open position, addressed by its own id. A person attaches a
 * position to a conversation from their client's picker, which is what `resources/list`
 * fills, so the enumeration and the read are both answered here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@sdxc/mcp";

/** Registers the board's resources. */
export default resources({
	posting: resource("jobs://postings/:id", {
		name: "Job posting",
		title: "Job posting",
		description: "One position on the board, as Markdown.",
		mimeType: "text/markdown",
	}),
});
