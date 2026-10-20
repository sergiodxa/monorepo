/**
 * Calls the real, public Management API through a self-referencing service binding —
 * zero-latency, in-process, with none of the DNS/TLS cost of a real network round
 * trip — so the dashboard exercises the exact same surface any other Management API
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";

/** The management API's own origin, one level under the platform's own. */
function managementOrigin(): string {
	return `https://api.${env.PLATFORM_DOMAIN}`;
}

/**
 * Issues a request against the real Management API, carrying the dashboard
 * request's own session cookie so `managementAuth`'s dashboard-session branch
 * authenticates it exactly as it would a direct browser call.
 *
 * @param ctx - The dashboard request context (provides `request`).
 * @param path - The Management API path to call, e.g. `/tenants/:id/agent-clients`.
 * @param init - The method, body, and any extra headers for the call.
 * @returns A promise resolving to the Management API's own response.
 * @example
 * let response = await callManagementApi(ctx, `/tenants/${tenantId}/agent-clients`, {
 * 	method: "POST",
 * 	body: JSON.stringify({ name, scopes }),
 * 	headers: { "Content-Type": "application/json" },
 * });
 */
export function callManagementApi(
	ctx: RequestContext,
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	let headers = new Headers(init.headers);

	let cookie = ctx.request.headers.get("Cookie");
	if (cookie) headers.set("Cookie", cookie);

	let request = new Request(`${managementOrigin()}${path}`, { ...init, headers });
	return env.SELF.fetch(request);
}
