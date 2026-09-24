/**
 * The two `remix/middleware/auth` schemes this package's roles answer, a session-backed
 * one and a bearer one, plus the `requireAuth()` failure that challenges a request that
 * sent no token. Both schemes leave a request they have nothing to say about to the next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	AuthScheme,
	AuthSchemeAuthenticateResult,
	AuthSchemeFailure,
	BadAuth,
} from "remix/middleware/auth";
import type { RequestContext } from "remix/router";

import { isFailure, wrap } from "@sdxc/result";

import type { AccessToken } from "../access-token.js";
import type { RelyingParty } from "../relying-party.js";
import type { ResourceServer } from "../resource-server.js";

import { AuthError, AuthErrorCode } from "../auth-error.js";
import { AuthSession } from "../auth-session.js";

import { sessionOf } from "./context.js";

/** The method name a session scheme reports when it is given none. */
const DEFAULT_SESSION_SCHEME_NAME = "oidc-session";

/** The method name a bearer scheme reports when it is given none. */
const DEFAULT_BEARER_SCHEME_NAME = "bearer";

/** The challenge RFC 6750 §3 pairs with a rejected token, for a server that writes none. */
const INVALID_TOKEN_CHALLENGE = `Bearer error="invalid_token"`;

/** The HTTP status a request lacking authentication is answered with. */
const UNAUTHORIZED = 401;

/**
 * The answer a credential the resource server declines is reported with. The middleware
 * forwards its challenge as `WWW-Authenticate`, so a client knows to obtain a new token
 * and, from a server bound to a resource, where to read its metadata.
 *
 * @param api - The resource server that declined the credential.
 */
function rejected(api: BearerSchemeServer): AuthSchemeFailure {
	return {
		status: "failure",
		code: "invalid_credentials",
		message: "The bearer token was not accepted.",
		challenge: api.challenge?.({ error: "invalid_token" }) ?? INVALID_TOKEN_CHALLENGE,
	};
}

/**
 * A scheme that resolves the request's stored token set into the identity the app's
 * `verify` returns, renewing a set that has reached its end first. A session the provider
 * refuses to renew is signed out; one that carries no refresh token was never renewable
 * and stays signed in on the claims it was written with.
 *
 * @param rp - The relying party holding the credentials a renewal presents.
 * @param options - The app's `verify`, and the name the scheme reports.
 * @returns The scheme to list in `auth({ schemes })`.
 * @throws {AuthError} When the issuer cannot serve its own documents, so an outage stays
 *   a fault the app answers rather than a person being signed out.
 * @example
 * sessionScheme(rp, { verify: (auth) => users.getBySubject(auth.idToken.subject) });
 */
export function sessionScheme<identity>(
	rp: Pick<RelyingParty<unknown>, "renew">,
	options: SessionSchemeOptions<identity>,
): AuthScheme<identity> {
	return {
		name: options.name ?? DEFAULT_SESSION_SCHEME_NAME,

		/**
		 * Resolves the request's stored token set, renewing it first where it has
		 * reached its end.
		 *
		 * @param context - The request being authenticated.
		 * @returns The identity, the rejection, or nothing at all for a signed-out
		 *   request, which leaves the schemes behind this one their turn.
		 */
		async authenticate(context): Promise<AuthSchemeAuthenticateResult<identity>> {
			let auth = AuthSession.from(sessionOf(context));
			if (!auth) return null;

			if (auth.expired) {
				let refusal = await rp.renew(auth);
				if (refusal) {
					return { status: "failure", code: "invalid_credentials", message: refusal.message };
				}
			}

			let identity = await options.verify(auth);
			if (identity === null || identity === undefined) {
				return {
					status: "failure",
					code: "invalid_credentials",
					message: "The session's subject resolves to no identity in this app",
				};
			}

			return { status: "success", identity };
		},
	};
}

/**
 * A scheme that resolves the request's bearer token into the identity the app's `verify`
 * returns. A request carrying no bearer credential is left to the next scheme, and one
 * the server declines stops here with `api.challenge({ error: "invalid_token" })`.
 *
 * @param api - The resource server whose audiences the token is held to.
 * @param options - The app's `verify`, and the method name to report.
 * @returns The scheme to list in `auth({ schemes })`.
 * @throws {AuthError} When the issuer cannot serve its own documents, so an outage
 *   stays a fault the app handles.
 * @example
 * bearerScheme(api, { verify: (token) => users.getBySubject(token.subject) });
 * @example
 * bearerScheme(api, { verify: (token) => (token.issuedToService ? service : null) });
 */
export function bearerScheme<identity>(
	api: BearerSchemeServer,
	options: BearerSchemeOptions<identity>,
): AuthScheme<identity> {
	return {
		name: options.name ?? DEFAULT_BEARER_SCHEME_NAME,

		/**
		 * Resolves the request's credential and asks the app who is holding it.
		 *
		 * @param context - The request being authenticated.
		 * @returns The identity, the rejection, or nothing at all for a request
		 *   carrying no bearer credential.
		 */
		async authenticate(context): Promise<AuthSchemeAuthenticateResult<identity>> {
			let token = await wrap(() => api.verifyRequest(context.request));

			if (isFailure(token)) {
				if (AuthError.is(token.error, AuthErrorCode.InvalidToken)) return rejected(api);
				throw token.error;
			}

			if (token.data === null) return null;

			let identity = await options.verify(token.data, context);
			if (identity === null) return rejected(api);

			return { status: "success", identity };
		},
	};
}

/**
 * A `requireAuth({ onFailure })` handler answering a request that reached a protected
 * route unauthenticated with a `401` whose challenge points at the server's metadata, so
 * a client that sent no token learns where to get one. A challenge the body already
 * carries wins, then a scheme's own (a rejected token's), then the anonymous one.
 *
 * @param api - The resource server whose challenge is sent.
 * @param body - Builds the response, whose status and body are kept; a bare `401` when omitted.
 * @returns The handler to pass as `onFailure`.
 * @example
 * requireAuth({ onFailure: bearerFailure(api) });
 * @example
 * requireAuth({ onFailure: bearerFailure(api, () => problems.unauthorized()) });
 */
export function bearerFailure(
	api: Pick<ResourceServer, "challenge">,
	body: (context: RequestContext) => Response | Promise<Response> = () =>
		new Response("Unauthorized", { status: UNAUTHORIZED }),
): (context: RequestContext, auth?: BadAuth) => Promise<Response> {
	return async (context, auth) => {
		let answer = await body(context);
		if (answer.headers.has("WWW-Authenticate")) return answer;

		let response = new Response(answer.body, answer);
		response.headers.set("WWW-Authenticate", auth?.error?.challenge ?? api.challenge());
		return response;
	};
}

/**
 * The resource server a bearer scheme verifies against. `challenge` is optional, so a
 * stand-in exposing `verifyRequest` alone still answers a rejection, with RFC 6750's
 * plain `invalid_token` challenge.
 */
export interface BearerSchemeServer extends Pick<ResourceServer, "verifyRequest"> {
	challenge?: ResourceServer["challenge"];
}

/** How a session scheme turns a signed-in session into the app's identity. */
export interface SessionSchemeOptions<identity> {
	/**
	 * Resolves the app's identity from the session's tokens.
	 *
	 * @param auth - The signed-in session, holding a live access token.
	 * @returns The identity, or `null` for a subject this app knows nothing about.
	 */
	verify(auth: AuthSession): Promise<identity | null | undefined> | identity | null | undefined;
	/**
	 * The name reported as `auth.method`.
	 *
	 * @default "oidc-session"
	 */
	name?: string;
}

/** How a bearer scheme turns an accepted token into the app's identity. */
export interface BearerSchemeOptions<identity> {
	/**
	 * Turns a token the server accepted into the identity a route reads, answering
	 * `null` for a caller the app itself declines.
	 *
	 * @param token - The verified or introspected access token.
	 * @param context - The request being authenticated.
	 */
	verify(token: AccessToken, context: RequestContext): identity | null | Promise<identity | null>;
	/**
	 * The method name the resolved auth state reports, which tells apart two
	 * resource servers in one app.
	 *
	 * @default "bearer"
	 */
	name?: string;
}
