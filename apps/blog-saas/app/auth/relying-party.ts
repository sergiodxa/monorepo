/**
 * The dashboard's OIDC client: the issuer every sign-in is verified against, held for
 * the life of the isolate so its discovery document and key set are read once, and the
 * per-request relying party that drives the login, callback, and sign-out routes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Issuer } from "@pkg/auth/issuer";
import { RelyingParty } from "@pkg/auth/relying-party";
import { env } from "cloudflare:workers";

import routes from "~/routes/web";

/** Reused for the life of the isolate, so a second read of the metadata is free. */
let instance: Issuer | null = null;

/**
 * The provider the platform's accounts live at, and the `iss` its tokens carry.
 *
 * @returns The issuer the relying party is built on.
 */
function issuer(): Issuer {
	instance ??= new Issuer(env.OIDC_ISSUER);
	return instance;
}

/**
 * The client for the request's own origin, so a local run and production each present
 * the callback URL they are registered under, and a login that names no destination
 * lands on the dashboard.
 *
 * Claims come from the verified ID token, and a provider that leaves the display
 * claims out of it is read at the userinfo endpoint instead, since the account record
 * holds the email address and the display name a login resolves.
 *
 * @param url - The current request's URL, which the callback URL is built against.
 * @returns The client the auth routes drive.
 * @example let grant = await relyingParty(ctx.url).callback(ctx);
 */
export function relyingParty(url: URL): RelyingParty {
	return new RelyingParty(issuer(), {
		clientId: env.OIDC_CLIENT_ID,
		clientSecret: env.OIDC_CLIENT_SECRET,
		redirectUri: new URL(routes.auth.callback.href(), url),
		userInfo: "when-missing",
		fallbackReturnTo: routes.dashboard.index.href(),
	});
}
