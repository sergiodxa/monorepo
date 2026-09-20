/**
 * The centralized, type-safe route table for requests already resolved to one
 * tenant: discovery, JWKS, `/userinfo`, and the token endpoint. `/authorize`'s
 * hosted sign-in and consent pages are not part of this table yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { get, post, route } from "remix/routes";

/**
 * The tenant route map. `/userinfo` gets two leaf routes over the same pattern,
 * one per method it accepts, both mapped to the same controller.
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
});
