import { del, form, get, post, resources, route } from "remix/fetch-router/routes";

export default route({
	index: get("/"),
	health: get("/health"),
	logout: post("/logout"),

	api: {
		webhooks: {
			polar: post("/api/webhooks/polar"),
		},
	},

	onboarding: {
		index: get("/onboarding"),
		callback: get("/onboarding/callback"),
	},

	dashboard: {
		index: get("/dashboard"),
		tenants: {
			...resources("/dashboard/tenants", { only: ["show", "new", "create", "edit", "update"] }),

			clients: {
				...resources("/dashboard/tenants/:tenantId/clients", {
					only: ["index", "show", "new", "create", "edit", "update", "destroy"],
				}),

				"redirect-uris": {
					...resources("/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris", {
						only: ["new", "create", "edit", "update", "destroy"],
					}),
				},

				"logout-uris": {
					...resources("/dashboard/tenants/:tenantId/clients/:clientId/logout-uris", {
						only: ["new", "create", "edit", "update", "destroy"],
					}),
				},

				secrets: {
					...resources("/dashboard/tenants/:tenantId/clients/:clientId/secrets", {
						only: ["new", "create", "edit", "update", "destroy"],
					}),
				},
			},

			users: {
				...resources("/dashboard/tenants/:tenantId/users", {
					only: ["index", "show", "edit", "update", "destroy"],
				}),

				sessions: {
					destroy: del("/dashboard/tenants/:tenantId/users/:userId/sessions/:id"),
				},

				passkeys: {
					destroy: del("/dashboard/tenants/:tenantId/users/:userId/passkeys/:id"),
				},

				grants: {
					destroy: del("/dashboard/tenants/:tenantId/users/:userId/grants/:id"),
				},
			},

			resources: {
				...resources("/dashboard/tenants/:tenantId/resources", {
					only: ["index", "show", "new", "create", "edit", "update", "destroy"],
				}),

				scopes: {
					...resources("/dashboard/tenants/:tenantId/resources/:resourceId/scopes", {
						only: ["new", "create", "edit", "update", "destroy"],
					}),
				},
			},

			branding: form("/dashboard/tenants/:tenantId/branding"),
			hostname: form("/dashboard/tenants/:tenantId/hostname"),
			billing: form("/dashboard/tenants/:tenantId/billing"),
		},
	},
});
