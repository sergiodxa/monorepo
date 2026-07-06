/**
 * Authentication module for the blog. Builds a remix-auth Authenticator wired to
 * an OAuth2 strategy against the auth.sergiodxa.com provider, requesting openid,
 * profile and email scopes and returning the raw OAuth2 tokens. It exists to
 * centralize the OAuth2 login flow so routes can trigger it with a single call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { Authenticator } from "remix-auth";
import { OAuth2Strategy } from "remix-auth-oauth2";

export type OAuth2Tokens = OAuth2Strategy.VerifyOptions["tokens"];

export function authenticate(request: Request) {
	let authenticator = new Authenticator<OAuth2Tokens>();
	let url = new URL(request.url);

	authenticator.use(
		new OAuth2Strategy(
			{
				clientId: env.CLIENT_ID,
				clientSecret: env.CLIENT_SECRET,
				redirectURI: new URL("/auth/callback", url),
				authorizationEndpoint: new URL("https://auth.sergiodxa.com/authorize"),
				tokenEndpoint: new URL("https://auth.sergiodxa.com/oauth/token"),
				scopes: ["openid", "profile", "email"],
			},
			async ({ tokens }) => tokens,
		),
	);

	return authenticator.authenticate("oauth2", request);
}
