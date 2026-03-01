import action from "~/lib/action";

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/new">(
		({ params }) => {
			return new Response(
				`Show new logout URI form for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris">(
		({ params }) => {
			return new Response(
				`Create logout URI for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id/edit">(
		({ params }) => {
			return new Response(
				`Show edit logout URI form for ${params.id} in client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id">(
		({ params }) => {
			return new Response(
				`Update logout URI ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:clientId/logout-uris/:id">(
		({ params }) => {
			return new Response(
				`Delete logout URI ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),
};
