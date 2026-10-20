/**
 * The platform router's fallback: the bare platform domain answers a short allowlist of
 * hosted pages by forwarding them to the tenant router as the platform tenant, so the
 * platform's own sign-in runs the same hosted flow every customer tenant does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";

import {
	TENANT_ID_HEADER,
	TENANT_ISSUER_HEADER,
	TENANT_REGION_HEADER,
} from "~/app/http/middleware/tenant";
import { tenantRouter } from "~/app/initializers/tenant-router";

/**
 * The hosted pages this platform's own bare domain answers directly, addressed at
 * the platform tenant's own subject store rather than a signed-up customer's.
 */
const PLATFORM_HOSTED_PATHS = new Set([
	"/u/sign-in",
	"/u/sign-in/passkey/options",
	"/u/sign-in/passkey/verify",
	"/u/second-factor",
	"/u/second-factor/enrol",
	"/u/second-factor/continue",
	"/u/reset",
	"/u/magic-link",
	"/u/magic-link/complete",
	"/u/error",
]);

/** What the fallback reads off the platform router's context. */
type ForwardContext = Pick<RequestContext, "request" | "url" | "formData">;

/**
 * Forwards a request to the tenant router carrying the platform tenant's own
 * synthetic identity: it has no control-plane row to resolve one from, being
 * addressed purely by the Durable Object name every other platform-tenant call
 *
 * @param ctx - The request context (provides `request` and `formData`).
 * @returns The tenant router's response for that request.
 */
async function forwardToPlatformTenant(ctx: ForwardContext): Promise<Response> {
	let headers = new Headers(ctx.request.headers);
	headers.set(TENANT_ID_HEADER, env.PLATFORM_DOMAIN);
	headers.set(TENANT_REGION_HEADER, "wnam");
	headers.set(TENANT_ISSUER_HEADER, `https://${env.PLATFORM_DOMAIN}`);

	let method = ctx.request.method;
	if (method === "GET" || method === "HEAD") {
		return await tenantRouter.fetch(new Request(ctx.request.url, { method, headers }));
	}

	headers.delete("content-type");
	return await tenantRouter.fetch(
		new Request(ctx.request.url, { method, headers, body: ctx.formData }),
	);
}

/**
 * Forwards an allowlisted hosted path to the tenant router addressed at the
 * platform tenant, and answers a plain `404` for anything else.
 *
 * @param ctx - The request context (provides `request`, `url` and `formData`).
 * @returns The forwarded hosted page, or a plain `404 Not Found`.
 */
export async function platformTenantForward(ctx: ForwardContext): Promise<Response> {
	if (PLATFORM_HOSTED_PATHS.has(ctx.url.pathname)) return await forwardToPlatformTenant(ctx);
	return new Response("Not Found", { status: 404 });
}
