/**
 * Tenant-runtime entitlement gate. A suspended tenant (canceled/unpaid billing, or a
 * tenant an operator disabled) must stop serving its OIDC/OAuth2 provider surface even
 * though requests can still reach its Durable Object directly via Cloudflare for SaaS
 * `hostMetadata` (which bypasses the control-plane database). This module classifies a
 * request path as provider traffic vs. an operational path that must stay reachable so
 * the tenant can be re-provisioned or un-suspended, and builds the `402` block response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Path prefixes that must stay reachable on a suspended tenant Durable Object: the
 * Management API (used by the control plane to read/manage the tenant and to re-run
 * `/api/setup`) and the internal suspension-control endpoint. Everything else — the
 * OIDC/OAuth2 provider surface (`/authorize`, `/oauth/*`, `/userinfo`, `/webauthn/*`,
 * discovery, magic links, email verification) — is blocked while suspended.
 */
const SUSPENSION_EXEMPT_PREFIXES = ["/api/", "/__control/"];

/**
 * Decides whether a request to a suspended tenant Durable Object should be blocked.
 *
 * Blocks the public OIDC/OAuth2 provider surface while leaving the Management API and
 * the internal control endpoint reachable so the platform can still inspect the tenant
 * and lift the suspension (or re-provision it) without a chicken-and-egg lockout.
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
