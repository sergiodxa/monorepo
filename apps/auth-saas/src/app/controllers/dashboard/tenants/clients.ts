import action from "~/lib/action";

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/clients">(({ params }) => {
		return new Response(`List clients for tenant ${params.tenantId}`);
	}),

	show: action<"GET", "/dashboard/tenants/:tenantId/clients/:id">(({ params }) => {
		return new Response(`Show client ${params.id} for tenant ${params.tenantId}`);
	}),

	new: action<"GET", "/dashboard/tenants/:tenantId/clients/new">(({ params }) => {
		return new Response(`Show new client form for tenant ${params.tenantId}`);
	}),

	create: action<"POST", "/dashboard/tenants/:tenantId/clients">(({ params }) => {
		return new Response(`Create client for tenant ${params.tenantId}`);
	}),

	edit: action<"GET", "/dashboard/tenants/:tenantId/clients/:id/edit">(({ params }) => {
		return new Response(`Show edit client form for ${params.id} in tenant ${params.tenantId}`);
	}),

	update: action<"PUT", "/dashboard/tenants/:tenantId/clients/:id">(({ params }) => {
		return new Response(`Update client ${params.id} for tenant ${params.tenantId}`);
	}),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/clients/:id">(({ params }) => {
		return new Response(`Delete client ${params.id} for tenant ${params.tenantId}`);
	}),
};
