/**
 * Authenticates every call to the platform's MCP server before any tool runs: the
 * same bearer credential the management API itself accepts, verified once here so a
 * tool handler only ever has to forward it, never re-check it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { stringify } from "@sdxc/auth/bearer-challenge";
import { metadataUrl } from "@sdxc/well-known/oauth-protected-resource";
import { env } from "cloudflare:workers";
import { createContextKey } from "remix/router";

import { verifyManagementBearerToken } from "~/app/http/middleware/management-auth";

declare module "remix/router" {
	interface RequestContext {
		/** The caller's own bearer token, verified and forwarded unchanged to every tool call. */
		mcpBearerToken: string;
	}
}

/** Context key holding the caller's verified bearer token, exposed as `ctx.mcpBearerToken`. */
export const McpBearerToken: { defaultValue?: string } = createContextKey<string>();

const TOKEN_PROPERTY = { property: "mcpBearerToken" } as const;

/** Where this server's own RFC 9728 metadata is served, from its bare resource identifier. */
function resourceMetadataUrl(): URL {
	return metadataUrl(`https://${env.PLATFORM_DOMAIN}`);
}

/** A `401` whose challenge points at this server's own resource metadata (RFC 6750 §3, RFC 9728 §5.1). */
function unauthorized(detail: string, error?: "invalid_token"): Response {
	let headers = new Headers({
		"WWW-Authenticate": stringify({ error, resourceMetadata: resourceMetadataUrl() }),
	});
	return Response.json(
		{ error: "unauthorized", error_description: detail },
		{ status: 401, headers },
	);
}

/**
 * Refuses a request with no bearer token, or one that does not verify against the
 * platform tenant's own published keys, before `mcp.fetch` — and so any tool — ever
 * runs. A verified token is published on the request context as `ctx.mcpBearerToken`,
 * the same string a generated tool's handler forwards to the real management route.
 *
 * @returns The middleware, for the MCP route's own `middleware` array.
 * @example
 * mcpRouter.map(routes.mcp, { middleware: [mcpAuth()], handler: (ctx) => mcp.fetch(ctx) });
 */
export function mcpAuth(): Middleware {
	return async (ctx, next) => {
		let authorization = ctx.request.headers.get("Authorization");
		if (!authorization?.startsWith("Bearer ")) return unauthorized("A bearer token is required.");

		let token = authorization.slice("Bearer ".length).trim();
		if (!token) return unauthorized("A bearer token is required.");

		let verified = await verifyManagementBearerToken(token);
		if (verified === null) return unauthorized("The bearer token did not verify.", "invalid_token");

		ctx.set(McpBearerToken, token, TOKEN_PROPERTY);
		return next();
	};
}
