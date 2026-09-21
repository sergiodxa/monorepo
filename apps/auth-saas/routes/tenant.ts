/**
 * The centralized, type-safe route table for requests already resolved to one
 * tenant: discovery, JWKS, `/userinfo`, the token endpoint, `/authorize`, and the
 * hosted sign-in, sign-up, verify, reset, consent and error pages served under `/u/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, get, patch, post, put, route } from "remix/routes";

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
	apiKeysIntrospect: post("/api-keys/introspect"),
	authorize: get("/authorize"),
	hostedSignInShow: get("/u/sign-in"),
	hostedSignInSubmit: post("/u/sign-in"),
	hostedSignInPasskeyOptions: post("/u/sign-in/passkey/options"),
	hostedSignInPasskeyVerify: post("/u/sign-in/passkey/verify"),
	hostedSecondFactorShow: get("/u/second-factor"),
	hostedSecondFactorSubmit: post("/u/second-factor"),
	hostedSecondFactorEnrolSubmit: post("/u/second-factor/enrol"),
	hostedSecondFactorContinueSubmit: post("/u/second-factor/continue"),
	hostedStepUpShow: get("/u/step-up"),
	hostedStepUpSubmit: post("/u/step-up"),
	hostedStepUpEnrolSubmit: post("/u/step-up/enrol"),
	hostedStepUpContinueSubmit: post("/u/step-up/continue"),
	hostedConsentShow: get("/u/consent"),
	hostedConsentSubmit: post("/u/consent"),
	hostedSignUpShow: get("/u/sign-up"),
	hostedSignUpSubmit: post("/u/sign-up"),
	hostedVerifyShow: get("/u/verify"),
	hostedVerifyResend: post("/u/verify/resend"),
	hostedResetShow: get("/u/reset"),
	hostedResetSubmit: post("/u/reset"),
	hostedError: get("/u/error"),

	scimUsersCreate: post("/scim/v2/Users"),
	scimUsersList: get("/scim/v2/Users"),
	scimUsersRead: get("/scim/v2/Users/:id"),
	scimUsersReplace: put("/scim/v2/Users/:id"),
	scimUsersPatch: patch("/scim/v2/Users/:id"),
	scimUsersDelete: del("/scim/v2/Users/:id"),
	scimGroupsCreate: post("/scim/v2/Groups"),
	scimGroupsList: get("/scim/v2/Groups"),
	scimGroupsRead: get("/scim/v2/Groups/:id"),
	scimGroupsReplace: put("/scim/v2/Groups/:id"),
	scimGroupsPatch: patch("/scim/v2/Groups/:id"),
	scimGroupsDelete: del("/scim/v2/Groups/:id"),
	scimServiceProviderConfig: get("/scim/v2/ServiceProviderConfig"),
	scimResourceTypes: get("/scim/v2/ResourceTypes"),
	scimSchemas: get("/scim/v2/Schemas"),
	scimBulk: post("/scim/v2/Bulk"),
	scimMe: get("/scim/v2/Me"),
});
