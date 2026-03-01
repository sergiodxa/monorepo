import action from "~/lib/action";

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/users">(({ params }) => {
		return new Response(`List users for tenant ${params.tenantId}`);
	}),

	show: action<"GET", "/dashboard/tenants/:tenantId/users/:id">(({ params }) => {
		return new Response(`Show user ${params.id} for tenant ${params.tenantId}`);
	}),

	edit: action<"GET", "/dashboard/tenants/:tenantId/users/:id/edit">(({ params }) => {
		return new Response(`Show edit user form for ${params.id} in tenant ${params.tenantId}`);
	}),

	update: action<"PUT", "/dashboard/tenants/:tenantId/users/:id">(({ params }) => {
		return new Response(`Update user ${params.id} for tenant ${params.tenantId}`);
	}),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/users/:id">(({ params }) => {
		return new Response(`Delete user ${params.id} for tenant ${params.tenantId}`);
	}),
};
