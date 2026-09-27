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

import { userinfoResourceServer } from "~/app/lib/userinfo-resource";
import { AccessToken } from "~/database/tokens";
import routes from "~/routes/tenant";

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
 * `Cache-Control` states the access token's own remaining lifetime, so a relying
 * party caching this response never holds it past what the token itself is good for.
 * Every refusal's challenge carries `resource_metadata` (RFC 9728), pointing the client
 * at the tenant's userinfo metadata and, through it, at the issuer.
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
	let api = userinfoResourceServer(tenant.issuer);
	let missingToken = { "WWW-Authenticate": api.challenge() };
	let invalidToken = { "WWW-Authenticate": api.challenge({ error: "invalid_token" }) };

	let authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) return unauthorized({}, { headers: missingToken });

	let token = authorization.slice("Bearer ".length).trim();
	if (!token) return unauthorized({}, { headers: missingToken });

	let metadata = await tenantStub.publishMetadata({ now: Date.now() });
	let keys = await JWK.importLocal(metadata.jwks);

	let subjectId: string;
	let scopes: string[];
	let sessionId: string;
	let clientId: string;
	let remainingSeconds: number;

	try {
		let verified = await AccessToken.verify(token, keys, {
			issuer: tenant.issuer,
			algorithms: [JWK.Algorithm.ES256],
		});
		subjectId = verified.subject;
		scopes = verified.scope.split(" ").filter(Boolean);
		sessionId = verified.sessionId;
		clientId = verified.clientId;
		remainingSeconds = Math.max(0, verified.expiresIn ?? 0);
	} catch {
		return unauthorized({}, { headers: invalidToken });
	}

	if (!scopes.includes("openid")) {
		let challenge = api.challenge({ error: "insufficient_scope", scope: ["openid"] });
		return forbidden(
			{ error: "insufficient_scope" },
			{ headers: { "WWW-Authenticate": challenge } },
		);
	}

	let resolved = await tenantStub.resolveUserInfo({
		subjectId,
		scopes,
		now: Date.now(),
		sessionId,
		clientId,
	});
	if (resolved.kind === "unknown") return unauthorized({}, { headers: invalidToken });

	return ok(resolved.claims, {
		headers: { "Cache-Control": `private, max-age=${remainingSeconds}` },
	});
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
