/**
 * Gates the Streamable HTTP MCP surface: a key must carry the `mcp` scope before any
 * tool is listed or called. Resource scopes still gate each tool on their own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { apiChallenge } from "~/app/services/api/metadata";
import { apiProblems, problemInstance } from "~/app/services/api/problems";

/**
 * Refuses an authenticated API key that lacks `mcp`, naming that scope in the Bearer
 * challenge so a client knows what to add on the key.
 */
export const requireMcpScope: Middleware = async (ctx, next) => {
	if (ctx.apiKey.scopes.includes("mcp")) return next();

	return apiProblems.forbidden(
		{
			detail: "API key does not have mcp scope",
			instance: problemInstance(),
		},
		{
			headers: {
				"WWW-Authenticate": apiChallenge(ctx.url.origin, {
					error: "insufficient_scope",
					scope: ["mcp"],
				}),
			},
		},
	);
};

export default requireMcpScope;
