/**
 * Route table for the micro-APIs Worker: catalog, health, MCP and one POST per priced operation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

export default route({
	/** Human-readable landing page and machine catalog. */
	home: get("/"),
	/** JSON catalog of every priced operation. */
	catalog: get("/v1"),
	/** Health report. */
	health: get("/health"),
	/** Model Context Protocol endpoint. */
	mcp: post("/mcp"),
	/**
	 * One priced operation by catalog id. A named wildcard keeps dots in ids
	 * (`semver.satisfies`) because a `:id` variable stops at `.`.
	 */
	operation: post("/v1/*id"),
});
