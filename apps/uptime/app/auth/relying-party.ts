/**
 * The confidential client that signs a person in: the authorization redirect, the ID-token
 * callback, RP-initiated logout, and the session scheme the auth middleware resolves a
 * viewer through. Built per request, so its callback URL is the origin the request hit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { RelyingParty } from "@sdxc/auth/relying-party";
import { env } from "cloudflare:workers";

import { issuer } from "~/app/auth/issuer";
import routes from "~/routes/web";

/**
 * Scopes every login asks for. `offline_access` earns its place: it is what makes the
 * provider issue a refresh token, so the auth middleware renews a lapsed access token on
 * the server and a person stays signed in past its hour.
 */
const LOGIN_SCOPES = ["openid", "profile", "email", "offline_access"];

/**
 * The client for the request's own origin, so a local run and production each
 * present the callback URL they are registered under, and a login that names no
 * destination lands on the dashboard.
 *
 * @param url - The current request's URL, which the callback URL is built against.
 * @example let grant = await relyingParty(ctx.url).callback(ctx);
 */
export function relyingParty(url: URL | string): RelyingParty {
	return new RelyingParty(issuer(), {
		clientId: env.CLIENT_ID,
		clientSecret: env.CLIENT_SECRET,
		redirectUri: new URL(routes.auth.index.href(), url),
		scopes: LOGIN_SCOPES,
		fallbackReturnTo: routes.app.index.href(),
	});
}
