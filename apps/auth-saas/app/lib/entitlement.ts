/**
 * Tenant-runtime entitlement gate. A suspended tenant's Durable Object still receives
 * requests directly via Cloudflare for SaaS `hostMetadata`, bypassing the control-plane
 * database, so this module blocks its OIDC/OAuth2 provider surface while keeping the
 * operational paths reachable that let the tenant be re-provisioned or un-suspended.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Path prefixes that stay reachable on a suspended tenant Durable Object: the
 * Management API (to read/manage the tenant and re-run `/api/setup`) and the
 * suspension-control endpoint. Every other path is blocked while suspended.
 */
const SUSPENSION_EXEMPT_PREFIXES = ["/api/", "/__control/"];

/**
 * Decides whether a request to a suspended tenant Durable Object should be blocked.
 * Blocks the OIDC/OAuth2 provider surface while leaving the Management API and the
 * control endpoint reachable, so the platform can inspect or un-suspend the tenant.
 *
 * @param pathname - The request URL pathname (e.g. `/authorize`, `/api/stats`).
 * @returns `true` when the request must be blocked because the tenant is suspended.
 * @example
 * if (suspended && shouldBlockWhileSuspended(new URL(request.url).pathname)) {
 * 	return suspendedResponse();
 * }
 */
export function shouldBlockWhileSuspended(pathname: string): boolean {
	return !SUSPENSION_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Builds the response returned to callers hitting a suspended tenant's provider surface.
 *
 * Uses `402 Payment Required` because tenant suspension is a billing-entitlement state;
 * the body is a stable, machine-readable error object so relying clients can detect it.
 *
 * @returns A `402` JSON `Response` with an `error: "tenant_suspended"` body.
 * @example
 * return suspendedResponse();
 */
export function suspendedResponse(): Response {
	return new Response(JSON.stringify({ error: "tenant_suspended" }), {
		status: 402,
		headers: { "Content-Type": "application/json" },
	});
}
