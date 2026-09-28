/**
 * Route table for the job board. Three patterns: the board itself, which both lists and
 * accepts a posting, the outbox that shows what the app mailed, and the MCP endpoint an
 * agent speaks to. Every pattern is linked from a page, so patterns are added, not reshaped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/** Registers the board, the outbox and the MCP endpoint. */
export default route({
	/** GET lists the open positions; POST publishes a new one. */
	board: form("/"),

	/** Every message the in-memory transport captured, newest first. */
	outbox: get("/outbox"),

	/** The Model Context Protocol endpoint, answering `search_jobs` and the posting resource. */
	mcp: post("/mcp"),
});
