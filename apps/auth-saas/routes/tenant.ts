/**
 * The centralized, type-safe route table for requests already resolved to one
 * tenant: discovery, JWKS, `/userinfo`, the token endpoint, `/authorize`, and the
 * hosted sign-in, consent and error pages served under `/u/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

/**
 * The tenant route map. `/userinfo` gets two leaf routes over the same pattern,
 * one per method it accepts, both mapped to the same controller; `/u/sign-in` and
 * `/u/consent` do the same for their form's GET and POST.
 *
 * @example
 * routes.token.href();
 */
export default route({
	openidConfiguration: get("/.well-known/openid-configuration"),
	oauthAuthorizationServer: get("/.well-known/oauth-authorization-server"),
	jwks: get("/.well-known/jwks.json"),
	userinfoGet: get("/userinfo"),
	userinfoPost: post("/userinfo"),
	token: post("/oauth/token"),
	authorize: get("/authorize"),
	hostedSignInShow: get("/u/sign-in"),
	hostedSignInSubmit: post("/u/sign-in"),
	hostedSignInPasskeyOptions: post("/u/sign-in/passkey/options"),
	hostedSignInPasskeyVerify: post("/u/sign-in/passkey/verify"),
	hostedConsentShow: get("/u/consent"),
	hostedConsentSubmit: post("/u/consent"),
	hostedError: get("/u/error"),
});
