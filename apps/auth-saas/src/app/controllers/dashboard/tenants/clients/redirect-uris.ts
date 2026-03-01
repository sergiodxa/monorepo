import action from "~/lib/action";

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/new">(
		({ params }) => {
			return new Response(
				`Show new redirect URI form for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris">(
		({ params }) => {
			return new Response(
				`Create redirect URI for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id/edit">(
		({ params }) => {
			return new Response(
				`Show edit redirect URI form for ${params.id} in client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id">(
		({ params }) => {
			return new Response(
				`Update redirect URI ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:clientId/redirect-uris/:id">(
		({ params }) => {
			return new Response(
				`Delete redirect URI ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),
};
