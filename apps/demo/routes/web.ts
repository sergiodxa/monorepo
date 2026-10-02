/**
 * Route table for the job board. Four patterns: the board itself, which both lists and
 * accepts a posting, one position on its own, the outbox that shows what the app mailed,
 * and the MCP endpoint an agent speaks to. Every pattern is linked from a page, so patterns
 * are added, not reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/** Registers the board, one position, the outbox and the MCP endpoint. */
export default route({
	/** GET lists the open positions; POST publishes a new one. */
	board: form("/"),

	/**
	 * One position, complete: the address the listing's own control points at, and the one
	 * the dialog's frame is filled from. It answers a whole document, so a visitor who
	 * arrives here from a link, a bookmark or with scripting off reads the same page.
	 */
	position: get("/positions/:id"),

	/** Every message the in-memory transport captured, newest first. */
	outbox: get("/outbox"),

	/** The Model Context Protocol endpoint, answering the job tools and the posting resource. */
	mcp: post("/mcp"),
});
