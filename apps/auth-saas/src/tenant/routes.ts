import { form, get, post, resource, resources, route } from "remix/fetch-router/routes";

export default route({
	verifyEmail: get("verify-email"),

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
				only: ["index", "show", "update", "destroy"],
			}),

			verifyEmail: post("api/subjects/:id/verify-email"),
		},

		resources: resources("api/resources", {
			only: ["index", "show", "create", "update", "destroy"],
		}),

		brand: resource("api/brand", { only: ["show", "update"] }),
	},
});
