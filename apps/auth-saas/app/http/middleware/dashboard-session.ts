/**
 * Resolves the platform dashboard's own session and its membership of a tenant, and
 * builds the sign-in redirect a page with no valid session sends a visitor to. The
 * platform tenant's own Durable Object is reached directly, since `ctx.tenantStub`
 * exists only on the tenant router a hostname resolves to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { RequestContext } from "remix/router";

import { failure, success } from "@sdxc/result";
import { env } from "cloudflare:workers";

import type { MembershipRole } from "~/app/models/membership";
import type { TenantRow } from "~/app/models/tenant";

import { requestOrigin } from "~/app/lib/request-origin";
import { sessionCookie } from "~/app/lib/session-cookie";
import Membership from "~/app/models/membership";
import Tenant from "~/app/models/tenant";
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

/** A live dashboard session's membership of one tenant that still exists. */
export interface DashboardTenantMember {
	subjectId: string;
	role: MembershipRole;
	tenant: TenantRow;
}

/** The request carries no platform dashboard session that still resolves. */
export class DashboardSignInRequiredError extends Error {
	override name = "DashboardSignInRequiredError";

	constructor() {
		super("A platform dashboard session is required");
	}
}

/** The signed-in subject holds no membership of a live tenant with this id. */
export class NotATenantMemberError extends Error {
	override name = "NotATenantMemberError";

	/**
	 * @param tenantId - The tenant id the request named.
	 */
	constructor(public readonly tenantId: string) {
		super(`The signed-in subject is not a member of tenant ${tenantId}`);
	}
}

/**
 * Resolves the request's dashboard session into its membership of `tenantId`. A
 * deleted tenant answers exactly as one the subject never belonged to, so a
 * tombstone is administered by nobody and an unknown id reveals nothing.
 *
 * @param ctx - The request context (provides `request` and `db`).
 * @param tenantId - The tenant id the matched route's own `:tenantId` segment named.
 * @returns The member's subject, role and tenant, or why the request may not act on it.
 */
export async function resolveTenantMember(
	ctx: RequestContext,
	tenantId: string,
): Promise<Result<DashboardTenantMember, DashboardSignInRequiredError | NotATenantMemberError>> {
	let session = await resolveDashboardSession(ctx);
	if (!session) return failure(new DashboardSignInRequiredError());

	let membership = await Membership.findByTenantAndSubject(ctx.db, tenantId, session.subjectId);
	if (!membership) return failure(new NotATenantMemberError(tenantId));

	let tenant = await Tenant.findById(ctx.db, tenantId);
	if (!tenant || tenant.status === "deleted") return failure(new NotATenantMemberError(tenantId));

	return success({ subjectId: session.subjectId, role: membership.role, tenant });
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
