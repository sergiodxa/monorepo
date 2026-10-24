/**
 * Route table for the job board. Five patterns: the board itself, which both lists and
 * accepts a posting, one position on its own, the outbox that shows what the app mailed,
 * the MCP endpoint an agent speaks to, and the health check a monitor polls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/** Registers the board, one position, the outbox, the MCP endpoint and the health check. */
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

	/** The `application/health+json` report on the database the board reads. */
	health: get("/health"),
});
