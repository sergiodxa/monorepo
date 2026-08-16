/**
 * Central route table for the OIDC provider, defining every endpoint's method
 * and path.
 *
 * A single typed `route(...)` tree the router and controllers both reference, so
 * paths for OAuth, OIDC, discovery, WebAuthn, and the Management API are declared
 * in exactly one place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { del, form, get, post, put, resource, resources, route } from "remix/routes";

/** Typed route tree consumed by the provider router and controllers. */
export default route({
	index: get("/"),
	verifyEmail: get("verify-email"),

	webauthn: {
		register: {
			options: post("webauthn/register/options"),
			verify: post("webauthn/register/verify"),
		},
		auth: {
			options: post("webauthn/auth/options"),
			verify: post("webauthn/auth/verify"),
		},
	},

	oauth: {
		authorize: form("authorize"),
		token: post("oauth/token"),
		revoke: post("oauth/revoke"),
		introspect: post("oauth/introspect"),
	},

	oidc: {
		userinfo: get("userinfo"),
		logout: get("oidc/logout"),
	},

	discover: {
		jwks: get(".well-known/jwks.json"),
		oidc: get(".well-known/openid-configuration"),
		oauth: get(".well-known/oauth-authorization-server"),
	},

	api: {
		stats: get("api/stats"),
		setup: post("api/setup"),

		clients: {
			...resources("api/clients", {
				only: ["index", "show", "create", "update", "destroy"],
			}),

			secrets: resources("api/clients/:clientId/secrets", {
				only: ["index", "create", "destroy"],
			}),

			"redirect-uris": resources("api/clients/:clientId/redirect-uris", {
				only: ["index", "create", "destroy"],
			}),

			"logout-uris": resources("api/clients/:clientId/logout-uris", {
				only: ["index", "create", "destroy"],
			}),
		},

		subjects: {
			...resources("api/subjects", {
				only: ["index", "show", "create", "update", "destroy"],
			}),

			verifyEmail: post("api/subjects/:id/verify-email"),

			sessions: {
				index: get("api/subjects/:id/sessions"),
				destroy: del("api/subjects/:id/sessions/:sessionId"),
			},

			grants: {
				index: get("api/subjects/:id/grants"),
				destroy: del("api/subjects/:id/grants/:grantId"),
			},

			passkeys: {
				index: get("api/subjects/:id/passkeys"),
				update: put("api/subjects/:id/passkeys/:passkeyId"),
				destroy: del("api/subjects/:id/passkeys/:passkeyId"),
			},

			connections: {
				index: get("api/subjects/:id/connections"),
				destroy: del("api/subjects/:id/connections/:connectionId"),
			},
		},

		resources: resources("api/resources", {
			only: ["index", "show", "create", "update", "destroy"],
		}),

		brand: resource("api/brand", { only: ["show", "update"] }),

		"signing-keys": {
			index: get("api/signing-keys"),
			create: post("api/signing-keys"),
			rotate: post("api/signing-keys/rotate"),
			destroy: del("api/signing-keys/:id"),
		},
	},
});
