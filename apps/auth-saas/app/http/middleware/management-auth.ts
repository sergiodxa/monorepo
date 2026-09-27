/**
 * Resolves a management API request's caller into a tenant id and a scope set,
 * from either a management-client bearer token or a dashboard session naming a
 * member of the tenant the URL's `:tenantId` segment addresses. Answers only who
 * is calling and with what scopes; a route checks its own required scope itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { BearerChallenge } from "@sdxc/auth/bearer-challenge";
import type { Middleware, RequestContext } from "remix/router";

import { JWK } from "@sdxc/jwt";
import { createContextKey } from "remix/router";

import type { ManagementResourceServer } from "~/app/lib/management-resource";

import { managementProblem } from "~/app/http/lib/problem";
import { managementResourceServer } from "~/app/lib/management-resource";
import { ManagementAccessToken } from "~/app/lib/management-token";
import Membership from "~/app/models/membership";
import { publishPlatformKeySet } from "~/app/models/platform-signing-key";
import { scopesForRole } from "~/app/services/management-scopes";

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
type Refusal = Pick<Partial<BearerChallenge>, "error" | "scope">;

/**
 * A `401` whose challenge points at the resource metadata (RFC 9728 §5.1), so a client
 * holding nothing but the API URL learns where to get a token. A request that presented
 * no token gets a challenge with no `error`, per RFC 6750 §3.1.
 */
function unauthorized(api: ManagementResourceServer, detail: string, refusal?: Refusal): Response {
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

/** Verifies a presented bearer token against the platform's own published keys and issuer. */
async function resolveBearerCaller(
	ctx: RequestContext,
	api: ManagementResourceServer,
	issuer: string,
	token: string,
): Promise<ManagementCaller | { error: Response }> {
	let published = await publishPlatformKeySet(ctx.db);
	let keys = await JWK.importLocal(published);

	let verified: ManagementAccessToken;
	try {
		verified = await ManagementAccessToken.verify(token, keys, {
			issuer,
			algorithms: [JWK.Algorithm.ES256],
		});
	} catch {
		return {
			error: unauthorized(api, "The bearer token did not verify.", { error: "invalid_token" }),
		};
	}

	let scopes = verified.scope.split(" ").filter(Boolean);
	return { tenantId: verified.tenantId, scopes, actor: { type: "client", id: verified.clientId } };
}

/**
 * Builds the auth-resolution middleware. Reads `:tenantId` off the matched
 * route's own params, so it is mounted on each tenant-scoped route itself —
 * the same per-route placement `scimGate` already uses — rather than the
 * router's global chain, where params from a route not yet matched are not
 * there to read. Publishes the management API's resource server as
 * `ctx.managementApi`, so a route's own scope refusal carries the same challenge.
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

	return async (ctx, next) => {
		ctx.set(ManagementApiContext, api, API_PROPERTY);

		let pathTenantId = typeof ctx.params.tenantId === "string" ? ctx.params.tenantId : null;
		let authorization = ctx.request.headers.get("Authorization");

		if (authorization?.startsWith("Bearer ")) {
			let token = authorization.slice("Bearer ".length).trim();
			if (!token) return unauthorized(api, "A bearer token is required.");

			let resolved = await resolveBearerCaller(ctx, api, options.issuer, token);
			if ("error" in resolved) return resolved.error;

			if (pathTenantId !== null && pathTenantId !== resolved.tenantId) {
				return forbidden(api, "This credential is bound to a different tenant.");
			}

			ctx.set(ManagementCallerContext, resolved, CALLER_PROPERTY);
			return next();
		}

		if (pathTenantId === null) {
			return unauthorized(api, "A bearer token or an authenticated dashboard session is required.");
		}

		let subjectId = await options.resolveDashboardSubjectId(ctx);
		if (!subjectId) {
			return unauthorized(api, "A bearer token or an authenticated dashboard session is required.");
		}

		let membership = await Membership.findByTenantAndSubject(ctx.db, pathTenantId, subjectId);
		if (!membership) return forbidden(api, "This member does not belong to this tenant.");

		ctx.set(
			ManagementCallerContext,
			{
				tenantId: pathTenantId,
				scopes: scopesForRole(membership.role),
				actor: { type: "member", id: subjectId },
			},
			CALLER_PROPERTY,
		);

		return next();
	};
}
