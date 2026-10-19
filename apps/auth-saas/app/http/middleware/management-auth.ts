/**
 * Resolves a management API request's caller into a tenant id and a scope set,
 * from either a bearer token issued by the platform tenant's own token endpoint
 * or a dashboard session naming a member of the tenant the URL's `:tenantId`
 * segment addresses, then binds that caller as `ctx.access` against the management
 * policy, so a route's `requireAbility` refuses with the scope it needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BearerChallenge } from "@sdxc/auth/bearer-challenge";
import type { Refusal } from "@sdxc/authz";
import type { Middleware, RequestContext } from "remix/router";

import { access } from "@sdxc/authz/middleware/router";
import { JWK } from "@sdxc/jwt";
import { createContextKey } from "remix/router";

import type { ManagementResourceServer } from "~/app/initializers/management-resource";

import { managementProblem } from "~/app/http/problem";
import { managementResourceServer } from "~/app/initializers/management-resource";
import { platformTenantIssuer, platformTenantStub } from "~/app/initializers/platform-tenant";
import { AccessToken } from "~/app/models/tenant/tokens";
import policy, { scopeOfAbility, scopeRoles, scopesForRole } from "~/app/policies/policy";
import { tenantFeatures } from "~/app/services/billing/tenant-features";

/** Who is calling, and the scopes that credential resolved to. */
export interface ManagementCaller {
	/** The tenant this request is scoped to. */
	tenantId: string;
	/** The scopes this caller carries at this tenant. */
	scopes: string[];
	/** The principal a route's own audit trail names as having acted. */
	actor: { type: "client" | "member"; id: string };
}

export const ManagementCallerContext = createContextKey<ManagementCaller>();

export const ManagementApiContext = createContextKey<ManagementResourceServer>();

declare module "remix/router" {
	interface RequestContext {
		/** The caller this request was resolved to, and the scopes it carries. */
		managementCaller: ManagementCaller;
		/** The management API as a protected resource, which every refusal's challenge comes from. */
		managementApi: ManagementResourceServer;
	}
}

const CALLER_PROPERTY = { property: "managementCaller" } as const;

const API_PROPERTY = { property: "managementApi" } as const;

/** Why a request was refused, in the RFC 6750 terms its `WWW-Authenticate` challenge carries. */
type ChallengeRefusal = Pick<Partial<BearerChallenge>, "error" | "scope">;

/**
 * A `401` whose challenge points at the resource metadata (RFC 9728 §5.1), so a client
 * holding nothing but the API URL learns where to get a token. A request that presented
 * no token gets a challenge with no `error`, per RFC 6750 §3.1.
 */
function unauthorized(
	api: ManagementResourceServer,
	detail: string,
	refusal?: ChallengeRefusal,
): Response {
	return managementProblem(
		"unauthorized",
		{ detail },
		{ headers: { "WWW-Authenticate": api.challenge(refusal) } },
	);
}

/**
 * A `403` carrying `insufficient_scope`: the credential authenticated but reaches
 * nothing at this tenant, and `scope` names what it would need when that is one scope.
 *
 * @param api - The resource server the challenge points at.
 * @param detail - The problem's human-readable explanation.
 * @param scope - The scopes the route requires, for a scope refusal.
 * @returns The `problem+json` refusal.
 */
export function forbidden(
	api: ManagementResourceServer,
	detail: string,
	scope: string[] = [],
): Response {
	return managementProblem(
		"forbidden",
		{ detail },
		{ headers: { "WWW-Authenticate": api.challenge({ error: "insufficient_scope", scope }) } },
	);
}

/**
 * Answers a management refusal: an unpaid feature or a missing scope is a `403` whose
 * challenge names the scope the ability needs, and an undecidable check is a `500`.
 * A route selling a paid feature answers its own `entitlement:*` refusal first.
 *
 * @param ctx - A request `managementAuth` resolved, carrying the management API.
 * @param decision - The refusal `requireAbility` or a handler's own check reached.
 * @returns The `problem+json` refusal.
 * @example
 * let decision = ctx.access.check(abilities.subjects.export.credentials);
 * if (!decision.allowed) return managementDenied(ctx, decision);
 */
export function managementDenied(
	ctx: { managementApi: ManagementResourceServer },
	decision: Refusal,
): Response {
	if (decision.cause === "error") return new Response("Internal Server Error", { status: 500 });

	let scope = scopeOfAbility(decision.ability);
	if (scope === null) return forbidden(ctx.managementApi, "This caller may not do this.");
	return forbidden(ctx.managementApi, `This route requires the "${scope}" scope.`, [scope]);
}

/** A resolved caller, and the roles and consent ceiling the policy binds it with. */
interface ResolvedCaller {
	caller: ManagementCaller;
	roles: string[];
	within?: string[];
}

export interface ManagementAuthOptions {
	/** The management API's own issuer, `https://api.{PLATFORM_DOMAIN}`. */
	issuer: string;
	/**
	 * Resolves a dashboard request's session into the platform member's subject
	 * id, or `null` when the request carries no session that still resolves.
	 * Injected the same way `tenant()`'s Durable Object stub is, so this
	 * middleware never has to know how the platform's own member identity is
	 * reached.
	 */
	resolveDashboardSubjectId: (ctx: RequestContext) => Promise<string | null>;
}

/**
 * Verifies a presented bearer token against the platform tenant's own published
 * keys and issuer, the one check any caller of the platform tenant's token
 * endpoint must pass regardless of which resource server it then reaches —
 * the management API through {@link resolveBearerCaller} below, or another
 * protected resource verifying the same token before forwarding it onward.
 *
 * @param token - The bearer credential as presented.
 * @returns The verified token, or `null` when it does not verify.
 */
export async function verifyManagementBearerToken(token: string): Promise<AccessToken | null> {
	let platform = platformTenantStub();
	let published = await platform.publishKeySet();
	let keys = await JWK.importLocal(published);

	try {
		return await AccessToken.verify(token, keys, {
			issuer: platformTenantIssuer(),
			algorithms: [JWK.Algorithm.ES256],
		});
	} catch {
		return null;
	}
}

/**
 * Resolves a presented bearer token into who it speaks for. A machine
 * credential names its one reachable tenant at registration, in
 * the agent client bindings model — checked here the same way a membership is
 * checked, since neither a machine credential nor a person's own token ever
 * needs to carry a tenant claim itself. A token with no binding is a person's
 * own, obtained through an ordinary authorization-code-with-PKCE consent:
 * which tenant it reaches, and at what scopes, is resolved fresh against the
 * URL's own `:tenantId` and that subject's membership there — the
 * intersection of the role's own scope ceiling and whatever the token's own
 * consent actually granted, since a consent may have granted fewer scopes
 * than the role would otherwise allow.
 */
async function resolveBearerCaller(
	ctx: RequestContext,
	api: ManagementResourceServer,
	pathTenantId: string | null,
	token: string,
): Promise<ResolvedCaller | { error: Response }> {
	let verified = await verifyManagementBearerToken(token);
	if (verified === null) {
		return {
			error: unauthorized(api, "The bearer token did not verify.", { error: "invalid_token" }),
		};
	}

	let scopes = verified.scope.split(" ").filter(Boolean);

	let binding = await ctx.models.agentClientBindings.find(verified.clientId);
	if (binding) {
		return {
			caller: {
				tenantId: binding.tenant_id,
				scopes,
				actor: { type: "client", id: verified.clientId },
			},
			roles: scopeRoles(scopes),
		};
	}

	if (pathTenantId === null) {
		return {
			error: unauthorized(api, "A bearer token or an authenticated dashboard session is required."),
		};
	}

	let membership = await ctx.models.memberships.findByTenantAndSubject(
		pathTenantId,
		verified.subject,
	);
	if (!membership) {
		return { error: forbidden(api, "This member does not belong to this tenant.") };
	}

	let roleScopes: string[] = scopesForRole(membership.role);
	let grantedScopes = scopes.filter((scope) => roleScopes.includes(scope));

	return {
		caller: {
			tenantId: pathTenantId,
			scopes: grantedScopes,
			actor: { type: "member", id: verified.subject },
		},
		roles: [membership.role],
		within: scopeRoles(scopes),
	};
}

/**
 * Builds the auth-resolution middleware. Reads `:tenantId` off the matched
 * route's own params, so it is mounted on each tenant-scoped route itself —
 * the same per-route placement `scimGate` already uses — rather than the
 * router's global chain, where params from a route not yet matched are not
 * there to read. Publishes the management API's resource server as
 * `ctx.managementApi`, and binds `ctx.access`: an agent client holds its scopes' roles,
 * a person their membership role cut to their token's consent, a dashboard session its
 * role. The `billing` fact loads only when a paid ability is checked.
 *
 * @param options - The management API's own issuer, and how to resolve a dashboard
 * session's subject id.
 * @returns The middleware, for a route's own `middleware` array.
 * @example
 * router.map(routes.subjectsRead, {
 * 	middleware: [managementAuth({ issuer, resolveDashboardSubjectId })],
 * 	handler,
 * });
 */
export function managementAuth(options: ManagementAuthOptions): Middleware {
	let api = managementResourceServer(options.issuer);

	/** Binds the resolved caller and continues to the route. */
	function bind(resolved: ResolvedCaller): Middleware {
		return access(policy, {
			roles: resolved.roles,
			...(resolved.within === undefined ? {} : { within: resolved.within }),
			facts: {
				billing: (ctx: RequestContext) => tenantFeatures(ctx.models, resolved.caller.tenantId),
			},
			onDenied: managementDenied,
		});
	}

	return async (ctx, next) => {
		ctx.set(ManagementApiContext, api, API_PROPERTY);

		let pathTenantId = typeof ctx.params.tenantId === "string" ? ctx.params.tenantId : null;
		let authorization = ctx.request.headers.get("Authorization");

		if (authorization?.startsWith("Bearer ")) {
			let token = authorization.slice("Bearer ".length).trim();
			if (!token) return unauthorized(api, "A bearer token is required.");

			let resolved = await resolveBearerCaller(ctx, api, pathTenantId, token);
			if ("error" in resolved) return resolved.error;

			if (pathTenantId !== null && pathTenantId !== resolved.caller.tenantId) {
				return forbidden(api, "This credential is bound to a different tenant.");
			}

			ctx.set(ManagementCallerContext, resolved.caller, CALLER_PROPERTY);
			return bind(resolved)(ctx, next);
		}

		if (pathTenantId === null) {
			return unauthorized(api, "A bearer token or an authenticated dashboard session is required.");
		}

		let subjectId = await options.resolveDashboardSubjectId(ctx);
		if (!subjectId) {
			return unauthorized(api, "A bearer token or an authenticated dashboard session is required.");
		}

		let membership = await ctx.models.memberships.findByTenantAndSubject(pathTenantId, subjectId);
		if (!membership) return forbidden(api, "This member does not belong to this tenant.");

		let caller: ManagementCaller = {
			tenantId: pathTenantId,
			scopes: scopesForRole(membership.role),
			actor: { type: "member", id: subjectId },
		};
		ctx.set(ManagementCallerContext, caller, CALLER_PROPERTY);

		return bind({ caller, roles: [membership.role] })(ctx, next);
	};
}
