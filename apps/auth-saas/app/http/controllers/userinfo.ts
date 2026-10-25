/**
 * `GET|POST /userinfo` — the OIDC UserInfo endpoint: verifies the bearer access
 * token and returns the claims its granted scopes carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { verifyProof } from "@sdxc/auth/dpop";
import { forbidden, ok, unauthorized } from "@sdxc/http/response/json";
import { JWK } from "@sdxc/jwt";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ResolvedTenant } from "~/app/http/middleware/tenant";
import type Tenant from "~/app/models/tenant/object";

import { tenantReplayStore } from "~/app/http/controllers/oauth/token";
import { userinfoResource, userinfoResourceServer } from "~/app/initializers/userinfo-resource";
import { AccessToken } from "~/app/models/tenant/tokens";
import routes from "~/routes/tenant";

/**
 * Verifies the access token, a bearer one or a DPoP-bound one beside its proof, and
 * assembles the claims its granted scopes carry. A bound token presented as a bearer
 * token is refused, since its holder proved no key. The key set is read fresh from the
 * tenant's Durable Object on every request.
 *
 * @param request - The incoming request, read for its `Authorization` header.
 * @param tenant - The tenant this request was resolved to.
 * @param tenantStub - A stub for the tenant's Durable Object.
 * @returns The subject's claims as JSON, or a `401`/`403` naming why the token was refused.
 */
async function respondToUserinfo(
	request: Request,
	tenant: ResolvedTenant,
	tenantStub: DurableObjectStub<Tenant>,
): Promise<Response> {
	let api = userinfoResourceServer(tenant.issuer);
	let missingToken = { "WWW-Authenticate": `${api.challenge()}, ${api.dpopChallenge()}` };
	let invalidToken = { "WWW-Authenticate": api.challenge({ error: "invalid_token" }) };

	let authorization = request.headers.get("Authorization");
	let scheme = authorization?.split(" ", 1)[0]?.toLowerCase();
	if (!authorization || (scheme !== "bearer" && scheme !== "dpop")) {
		return unauthorized({}, { headers: missingToken });
	}

	let bound = scheme === "dpop";
	let token = authorization.slice(authorization.indexOf(" ") + 1).trim();
	if (!token) return unauthorized({}, { headers: missingToken });

	if (bound) invalidToken = { "WWW-Authenticate": api.dpopChallenge({ error: "invalid_token" }) };

	let proofJkt: string | null = null;
	if (bound) {
		let verified = await verifyProof(request, {
			replay: tenantReplayStore(tenantStub),
			accessToken: token,
			url: userinfoResource(tenant.issuer),
		});
		if (isFailure(verified)) {
			let challenge = api.dpopChallenge({
				error: verified.error.code === "use_dpop_nonce" ? "use_dpop_nonce" : "invalid_dpop_proof",
			});
			return unauthorized({}, { headers: { "WWW-Authenticate": challenge } });
		}
		proofJkt = verified.data.jkt;
	}

	let metadata = await tenantStub.publishMetadata({ now: Date.now() });
	let keys = await JWK.importLocal(metadata.jwks);

	let subjectId: string;
	let scopes: string[];
	let sessionId: string;
	let clientId: string;
	let remainingSeconds: number;
	let boundTo: string | null;

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
		boundTo = verified.jkt;
	} catch {
		return unauthorized({}, { headers: invalidToken });
	}

	if (boundTo !== proofJkt) return unauthorized({}, { headers: invalidToken });

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
