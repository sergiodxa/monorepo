/**
 * Resolves the platform dashboard's own session and builds the sign-in redirect a
 * page with no valid session sends a visitor to. The platform web router carries no
 * `ctx.tenantStub` — that only exists on the tenant router a hostname resolves to —
 * so the platform tenant's own Durable Object is reached directly, the same way
 * `signup/verify.tsx` already does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { env } from "cloudflare:workers";

import { requestOrigin } from "~/app/lib/request-origin";
import { sessionCookie } from "~/app/lib/session-cookie";
import tenantRoutes from "~/routes/tenant";

/** A live platform dashboard session's subject and session id. */
export interface DashboardSession {
	subjectId: string;
	sessionId: string;
}

/**
 * Resolves the request's `__Host-session` cookie against the platform tenant's own
 * object, when it carries one that still resolves as `"active"`.
 *
 * @param ctx - The request context (provides `request`).
 * @returns The live session's subject id, or `null` when there is no cookie or it no
 * longer resolves.
 */
export async function resolveDashboardSession(
	ctx: RequestContext,
): Promise<DashboardSession | null> {
	let token = await sessionCookie.parse(ctx.request.headers.get("Cookie"));
	if (!token) return null;

	let platform = env.TENANT.getByName(env.PLATFORM_DOMAIN);
	let resolved = await platform.resolveSession({ token, ...requestOrigin(ctx.request) });

	return resolved.status === "active"
		? { subjectId: resolved.subjectId, sessionId: resolved.sessionId }
		: null;
}

/**
 * The platform's own hosted sign-in URL, returning to `returnTo` once signed in —
 * the same page a dashboard page with no valid session sent the visitor away from.
 *
 * @param returnTo - The path to return to after signing back in.
 * @returns The absolute sign-in URL.
 */
export function dashboardSignInUrl(returnTo: string): string {
	let url = new URL(tenantRoutes.hostedSignInShow.href(), `https://${env.PLATFORM_DOMAIN}`);
	url.searchParams.set("return_to", returnTo);
	return url.toString();
}
