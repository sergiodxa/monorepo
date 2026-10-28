/**
 * Landing page: short plain-text description pointing agents at `/v1` and `/mcp`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { OPERATIONS } from "~/config/catalog";
import routes from "~/routes/web";

/** Answers `GET /` with a plain-text orientation for humans and agents. */
export default createAction(routes.home, async () => {
	let lines = [
		"sdxc package-backed micro-APIs",
		"",
		"Each POST /v1/<id> runs one @sdxc/* capability and charges via x402.",
		"GET /v1 lists operations. POST /mcp exposes the same tools to agents.",
		"HTML docs and npm packages stay free; only hosted execution is paid.",
		"",
		"Operations:",
		...OPERATIONS.map(
			(operation) => `- ${operation.id} (${operation.priceUsd}) — ${operation.description}`,
		),
		"",
	];
	return new Response(lines.join("\n"), {
		headers: { "content-type": "text/plain; charset=utf-8" },
	});
});
