/**
 * `GET|POST /userinfo` — the OIDC UserInfo endpoint: verifies the bearer access
 * token and returns the claims its granted scopes carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { forbidden, ok, unauthorized } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { createAction } from "remix/router";

import type { ResolvedTenant } from "~/app/http/middleware/tenant";
import type Tenant from "~/database/tenant-do";

import { AccessToken } from "~/database/tokens";
import routes from "~/routes/tenant";

/** How a missing or unverifiable bearer token challenges the client, per RFC 6750. */
const MISSING_TOKEN_CHALLENGE = { "WWW-Authenticate": "Bearer" };
const INVALID_TOKEN_CHALLENGE = { "WWW-Authenticate": 'Bearer error="invalid_token"' };
const INSUFFICIENT_SCOPE_CHALLENGE = { "WWW-Authenticate": 'Bearer error="insufficient_scope"' };

/**
 * Verifies the bearer access token and assembles the claims its granted scopes
 * carry. Every request fetches the tenant's current JWKS from its Durable Object
 * rather than a cache: the caching layer this endpoint deserves is not built yet,
 * so a verification here costs one round trip rather than none.
 *
 * Takes the request and the tenant facts as plain arguments, rather than the
 * router's request context, so the one implementation serves both the `GET` and
 * the `POST` route this endpoint accepts.
 *
 * @param request - The incoming request, read for its `Authorization` header.
 * @param tenant - The tenant this request was resolved to.
 * @param tenantStub - A stub for the tenant's Durable Object.
 * @returns The subject's claims as JSON, or a `401`/`403` naming why the token
 * was refused.
 */
async function respondToUserinfo(
	request: Request,
	tenant: ResolvedTenant,
	tenantStub: DurableObjectStub<Tenant>,
): Promise<Response> {
	let authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return unauthorized({}, { headers: MISSING_TOKEN_CHALLENGE });
	}

	let token = authorization.slice("Bearer ".length).trim();
	if (!token) return unauthorized({}, { headers: MISSING_TOKEN_CHALLENGE });

	let metadata = await tenantStub.publishMetadata({ now: Date.now() });
	let keys = await JWK.importLocal(metadata.jwks);

	let subjectId: string;
	let scopes: string[];

	try {
		let verified = await AccessToken.verify(token, keys, {
			issuer: tenant.issuer,
			algorithms: [JWK.Algorithm.ES256],
		});
		subjectId = verified.subject;
		scopes = verified.scope.split(" ").filter(Boolean);
	} catch {
		return unauthorized({}, { headers: INVALID_TOKEN_CHALLENGE });
	}

	if (!scopes.includes("openid")) {
		return forbidden({ error: "insufficient_scope" }, { headers: INSUFFICIENT_SCOPE_CHALLENGE });
	}

	let resolved = await tenantStub.resolveUserInfo({ subjectId, scopes, now: Date.now() });
	if (resolved.kind === "unknown") return unauthorized({}, { headers: INVALID_TOKEN_CHALLENGE });

	return ok(resolved.claims);
}

/**
 * `GET /userinfo`.
 *
 * @example
 * router.map(routes.userinfoGet, userinfoGet);
 */
export const userinfoGet = createAction(routes.userinfoGet, (ctx) =>
	respondToUserinfo(ctx.request, ctx.tenant, ctx.tenantStub),
);

/**
 * `POST /userinfo`, identical to {@link userinfoGet}.
 *
 * @example
 * router.map(routes.userinfoPost, userinfoPost);
 */
export const userinfoPost = createAction(routes.userinfoPost, (ctx) =>
	respondToUserinfo(ctx.request, ctx.tenant, ctx.tenantStub),
);
