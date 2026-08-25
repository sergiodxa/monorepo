/**
 * The route registry: every URL this server answers, declared once so `.href(...)`
 * is typed everywhere and the URL surface can be read in one place. Routes are all
 * declared up front, including ones whose controllers arrive later, because every
 * link and redirect in the app resolves through this map rather than a string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { form, get, post, route } from "remix/routes";

/**
 * The paths below are a frozen contract: relying parties hardcode `/authorize`,
 * `/oauth/token`, `/userinfo`, `/.well-known/jwks.json`, and `/oidc/logout` instead
 * of reading discovery, so moving any of them needs a coordinated client release.
 *
 * @example
 * routes.admin.client.index.href({ clientId });
 */
export default route({
	/** Redirects to {@link routes.authorize}, so the bare domain lands in the flow. */
	home: get("/"),
	healthcheck: get("/healthcheck"),
	userinfo: get("/userinfo"),
	/** GET renders the sign-in UI (or performs SSO); POST logs in with credentials. */
	authorize: form("/authorize"),
	/**
	 * GET renders the confirmation for a still-live token; POST spends it, split so a
	 * mail scanner following the `GET` link cannot burn the token before the person
	 * clicks, and reachable without a session so a valid token never meets a sign-in guard.
	 */
	verifyEmail: form("/verify-email"),

	password: {
		/** GET asks for an address; POST mails a reset link when one belongs to a subject. */
		forgot: form("/password/forgot"),
		/** GET renders the new-password form for a token; POST consumes it and sets the hash. */
		reset: form("/password/reset"),
	},

	auth: {
		provider: post("/auth/:provider"),
		providerCallback: get("/auth/:provider/callback"),
		callback: get("/auth/callback"),
	},

	oauth: {
		token: post("/oauth/token"),
		revoke: post("/oauth/revoke"),
		introspect: post("/oauth/introspect"),
	},

	oidc: {
		/** GET = RP-initiated logout; POST = the interactive logout button. */
		logout: form("/oidc/logout"),
		checkSession: get("/oidc/check-session"),
	},

	wellKnown: {
		openidConfiguration: get("/.well-known/openid-configuration"),
		oauthAuthorizationServer: get("/.well-known/oauth-authorization-server"),
		jwks: get("/.well-known/jwks.json"),
	},

	account: {
		profile: get("/account/profile"),
		profileEdit: form("/account/profile/edit"),
		sessions: form("/account/sessions"),
		grants: form("/account/grants"),
		/** Mails a fresh verification link to the signed-in subject's own address. */
		verifyEmailResend: post("/account/verify-email/resend"),
	},

	admin: {
		dashboard: get("/admin"),
		clients: form("/admin/clients"),
		clientNew: form("/admin/clients/new"),
		client: form("/admin/clients/:clientId"),
		clientEdit: form("/admin/clients/:clientId/edit"),
		subjects: get("/admin/subjects"),
		subject: form("/admin/subjects/:subjectId"),
		subjectEdit: form("/admin/subjects/:subjectId/edit"),
	},

	api: {
		subject: get("/api/subjects/:subjectId"),
	},
});
