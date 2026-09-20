/**
 * `POST /oauth/token` — the token endpoint: turns an authorization code or a
 * refresh token into a token set, authenticating the client from whichever
 * credential shape it presented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Base64 } from "@sdxc/crypto";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import routes from "~/routes/tenant";

/** How a client may present itself here, mirroring what the tenant's token module accepts. */
type AuthScheme = "basic" | "post" | "none";

interface ClientAuth {
	clientId: string;
	clientSecret: string | null;
	authScheme: AuthScheme;
}

type ClientAuthResult =
	| { ok: true; auth: ClientAuth }
	| { ok: false; status: 400 | 401; error: string; description: string };

const INVALID_BASIC_HEADER: ClientAuthResult = {
	ok: false,
	status: 401,
	error: "invalid_client",
	description: "The Authorization header is not valid Basic credentials.",
};

/** Reads a form field as a non-empty string, or `null` when absent, empty, or a file. */
function stringField(form: FormData, name: string): string | null {
	let value = form.get(name);
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Resolves which of the token endpoint's three credential shapes a request
 * presented: `Basic` in `Authorization`, `client_secret` in the form body, or a
 * form-only `client_id` with no secret at all. A `client_id` presented both in the
 * header and the body is refused here, before either value reaches the exchange
 * the client actually asked for.
 */
function resolveClientAuth(request: Request, form: FormData): ClientAuthResult {
	let authorization = request.headers.get("Authorization");
	let formClientId = stringField(form, "client_id");

	if (authorization?.startsWith("Basic ")) {
		if (formClientId !== null) {
			return {
				ok: false,
				status: 400,
				error: "invalid_request",
				description:
					"The client authenticated both in the Authorization header and the request body.",
			};
		}

		let decoded = Base64.decode(authorization.slice("Basic ".length));
		if (isFailure(decoded)) return INVALID_BASIC_HEADER;

		let credentials = new TextDecoder().decode(decoded.data);
		let separator = credentials.indexOf(":");
		if (separator === -1) return INVALID_BASIC_HEADER;

		return {
			ok: true,
			auth: {
				clientId: decodeURIComponent(credentials.slice(0, separator)),
				clientSecret: decodeURIComponent(credentials.slice(separator + 1)),
				authScheme: "basic",
			},
		};
	}

	if (formClientId === null) {
		return {
			ok: false,
			status: 400,
			error: "invalid_request",
			description: "client_id is required.",
		};
	}

	let formClientSecret = stringField(form, "client_secret");
	if (formClientSecret !== null) {
		return {
			ok: true,
			auth: { clientId: formClientId, clientSecret: formClientSecret, authScheme: "post" },
		};
	}

	return { ok: true, auth: { clientId: formClientId, clientSecret: null, authScheme: "none" } };
}

/** Renders a client-facing token error, adding the `Basic` challenge OAuth 2.1 asks for at `401`. */
function tokenError(status: number, error: string, description: string): Response {
	let headers = status === 401 ? { "WWW-Authenticate": "Basic" } : undefined;
	return json({ error, error_description: description }, { status, headers });
}

/**
 * Turns an authorization code or a refresh token into a token set.
 *
 * @param ctx - The request context (provides `tenantStub`).
 * @returns The minted token set as OAuth-shaped JSON with `Cache-Control:
 * no-store`, or the error the tenant's token module refused the request for.
 * @example
 * router.map(routes.token, token);
 */
export default createAction(routes.token, async (ctx) => {
	let form: FormData;
	try {
		form = await ctx.request.formData();
	} catch {
		return tokenError(
			400,
			"invalid_request",
			"The request body must be application/x-www-form-urlencoded.",
		);
	}

	let grantType = form.get("grant_type");
	if (typeof grantType !== "string") {
		return tokenError(400, "invalid_request", "grant_type is required.");
	}

	if (grantType !== "authorization_code" && grantType !== "refresh_token") {
		return tokenError(400, "unsupported_grant_type", `Grant type "${grantType}" is not supported.`);
	}

	let clientAuth = resolveClientAuth(ctx.request, form);
	if (!clientAuth.ok)
		return tokenError(clientAuth.status, clientAuth.error, clientAuth.description);

	let now = Date.now();

	let outcome;

	if (grantType === "authorization_code") {
		let code = form.get("code");
		let codeVerifier = form.get("code_verifier");
		let redirectUri = form.get("redirect_uri");

		if (
			typeof code !== "string" ||
			typeof codeVerifier !== "string" ||
			typeof redirectUri !== "string"
		) {
			return tokenError(
				400,
				"invalid_request",
				"code, code_verifier, and redirect_uri are required.",
			);
		}

		outcome = await ctx.tenantStub.exchangeCode({
			code,
			codeVerifier,
			redirectUri,
			clientId: clientAuth.auth.clientId,
			clientSecret: clientAuth.auth.clientSecret,
			authScheme: clientAuth.auth.authScheme,
			now,
		});
	} else {
		let refreshToken = form.get("refresh_token");
		let scope = form.get("scope");

		if (typeof refreshToken !== "string") {
			return tokenError(400, "invalid_request", "refresh_token is required.");
		}

		outcome = await ctx.tenantStub.refreshTokens({
			refreshToken,
			scope: typeof scope === "string" ? scope : null,
			clientId: clientAuth.auth.clientId,
			clientSecret: clientAuth.auth.clientSecret,
			authScheme: clientAuth.auth.authScheme,
			now,
		});
	}

	if (outcome.kind === "error")
		return tokenError(outcome.status, outcome.error, outcome.description);

	return json(
		{
			access_token: outcome.accessToken,
			...(outcome.idToken ? { id_token: outcome.idToken } : {}),
			...(outcome.refreshToken ? { refresh_token: outcome.refreshToken } : {}),
			token_type: outcome.tokenType,
			expires_in: outcome.expiresIn,
			scope: outcome.scope,
		},
		{ status: 200, headers: { "Cache-Control": "no-store" } },
	);
});
