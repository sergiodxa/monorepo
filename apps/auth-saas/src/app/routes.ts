import { form, get, resources, route } from "remix/fetch-router/routes";

export default route({
	onboarding: {
		index: form("/onboarding"),
		region: form("/onboarding/region"),
		finish: form("/onboarding/finish"),
	},

	dashboard: {
		index: get("/dashboard"),
		tenants: {
			...resources("/dashboard/tenants", { only: ["show", "new", "create", "edit", "update"] }),

			clients: {
				...resources("/dashboard/tenants/:tenantId/clients", {
					only: ["index", "show", "new", "create", "edit", "update", "destroy"],
				}),

				...resources("/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris", {
					only: ["new", "create", "edit", "update", "destroy"],
				}),

				...resources("/dashboard/tenants/:tenantId/clients/:clientId/logout-uris", {
					only: ["new", "create", "edit", "update", "destroy"],
				}),

				...resources("/dashboard/tenants/:tenantId/clients/:clientId/secrets", {
					only: ["new", "create", "edit", "update", "destroy"],
				}),
			},

			users: {
				...resources("/dashboard/tenants/:tenantId/users", {
					only: ["index", "show", "edit", "update", "destroy"],
				}),
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
		},
	},
});
