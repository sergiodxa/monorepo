import action from "~/lib/action";

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/secrets/new">(
		async ({ params }) => {
			return new Response(
				`Show new secret form for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients/:clientId/secrets">(({ params }) => {
		return new Response(`Create secret for client ${params.clientId} in tenant ${params.tenantId}`);
	}),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:clientId/secrets/:id/edit">(
		({ params }) => {
			return new Response(
				`Show edit secret form for ${params.id} in client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:clientId/secrets/:id">(
		({ params }) => {
			return new Response(
				`Update secret ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:clientId/secrets/:id">(
		({ params }) => {
			return new Response(
				`Delete secret ${params.id} for client ${params.clientId} in tenant ${params.tenantId}`,
			);
		},
	),
};
