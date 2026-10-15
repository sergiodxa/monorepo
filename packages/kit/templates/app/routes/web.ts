/**
 * The web route contract: every URL the app answers, by name. Controllers and links build
 * URLs with `routes.<name>.href()`, so a pattern changes here and nowhere else.
 */

import { get, post, route } from "remix/routes";

/** The home page and the MCP endpoint an agent connects to. */
export default route({
	home: get("/"),
	mcp: post("/mcp"),
});
