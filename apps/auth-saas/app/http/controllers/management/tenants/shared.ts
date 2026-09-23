/**
 * What every route in this directory shares: the auth and rate-limit
 * middleware a control-plane route mounts, reading and writing a tenant,
 * membership or domain row straight through `ctx.db` since each already
 * lives in the control plane. Also serializes a row into the camelCase shape
 * the management API answers with, parses the `:membershipId`/`:domainId`
 * path params, and builds the `problem+json` responses for a membership or
 * domain the caller's own tenant does not hold.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import * as s from "remix/data-schema";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { DomainRow } from "~/app/models/domain";
import type { MembershipRow } from "~/app/models/membership";
import type { TenantRow } from "~/app/models/tenant";

import { managementProblem } from "~/app/http/lib/problem";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";

/**
 * Builds the auth and rate-limit middleware a control-plane route mounts.
 *
 * @param options - The auth and rate-limit options every management resource
 * controller shares.
 * @param bucket - Which budget this route spends from.
 * @returns The middleware, for a route's own `middleware` array.
 */
export function mountedMiddleware(
	options: ManagementControllerOptions,
	bucket: "read" | "write",
): Middleware[] {
	return [
		managementAuth({
			issuer: options.issuer,
			resolveDashboardSubjectId: options.resolveDashboardSubjectId,
		}),
		managementRateLimit(options.limiter, { bucket }),
	];
}

/** Renders a tenant row as the management API's own public record. */
export function serializeTenant(row: TenantRow) {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		issuer: row.issuer,
		region: row.region,
		status: row.status,
		planSlug: row.plan_slug,
		subscriptionStatus: row.subscription_status,
		currentPeriodEnd: row.current_period_end,
		cancelAtPeriodEnd: row.cancel_at_period_end,
		graceUntil: row.grace_until,
		lapsedAt: row.lapsed_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** Renders a membership row as the management API's own record. */
export function serializeMembership(row: MembershipRow) {
	return {
		id: row.id,
		tenantId: row.tenant_id,
		subjectId: row.subject_id,
		role: row.role,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** Renders a domain row as the management API's own record. */
export function serializeDomain(row: DomainRow) {
	return {
		id: row.id,
		tenantId: row.tenant_id,
		hostname: row.hostname,
		kind: row.kind,
		status: row.status,
		certificateStatus: row.certificate_status,
		verificationName: row.verification_name,
		verificationValue: row.verification_value,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

/** Renders a domain row's verification and activation state alone. */
export function serializeDomainVerification(row: DomainRow) {
	return {
		status: row.status,
		certificateStatus: row.certificate_status,
		verificationName: row.verification_name,
		verificationValue: row.verification_value,
	};
}

/** Parses and requires the `:membershipId` path param every single-membership route matches. */
export function membershipIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ membershipId: s.string() }), ctx.params).membershipId;
}

/** Parses and requires the `:domainId` path param every single-domain route matches. */
export function domainIdParam(ctx: { params: Record<string, string | undefined> }): string {
	return s.parse(s.object({ domainId: s.string() }), ctx.params).domainId;
}

/** The tenant a route's own path names, for a caller that does not hold one. */
export function tenantNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such tenant exists.",
	});
}

/** A membership the caller's own tenant does not hold, for a route naming one in its path. */
export function membershipNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such membership exists for this tenant.",
	});
}

/** A domain the caller's own tenant does not hold, for a route naming one in its path. */
export function domainNotFound(): Response {
	return managementProblem("notFound", {
		detail: "No such domain exists for this tenant.",
	});
}

/** A caller naming `kind: "platform"` on an attach call, a domain only the platform's own provisioning writes. */
export function domainKindNotAttachable(): Response {
	return managementProblem("invalidDomainKind", {
		detail:
			"The platform provisions a tenant's own default domain at creation; this route attaches a custom domain.",
	});
}

/** A caller attaching a custom domain on a plan that does not include one. */
export function customDomainNotAllowed(): Response {
	return managementProblem("entitlementRequired", {
		detail:
			"This tenant is not entitled to a custom domain. Attaching a custom domain is not included on this tenant's plan.",
	});
}

/** A Cloudflare failure while registering a custom hostname. */
export function hostnameRegistrationFailed(detail: string): Response {
	return managementProblem("hostnameRegistrationFailed", {
		detail,
	});
}
