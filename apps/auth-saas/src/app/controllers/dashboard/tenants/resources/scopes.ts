import action from "~/lib/action";

export default {
	new: action<"GET", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/new">(
		({ params }) => {
			return new Response(
				`Show new scope form for resource ${params.resourceId} in tenant ${params.tenantId}`,
			);
		},
	),

	create: action<"POST", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes">(
		({ params }) => {
			return new Response(
				`Create scope for resource ${params.resourceId} in tenant ${params.tenantId}`,
			);
		},
	),

	edit: action<"GET", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id/edit">(
		({ params }) => {
			return new Response(
				`Show edit scope form for ${params.id} in resource ${params.resourceId} in tenant ${params.tenantId}`,
			);
		},
	),

	update: action<"PUT", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id">(
		({ params }) => {
			return new Response(
				`Update scope ${params.id} for resource ${params.resourceId} in tenant ${params.tenantId}`,
			);
		},
	),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/resources/:resourceId/scopes/:id">(
		({ params }) => {
			return new Response(
				`Delete scope ${params.id} for resource ${params.resourceId} in tenant ${params.tenantId}`,
			);
		},
	),
};
