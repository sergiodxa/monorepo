import action from "~/lib/action";

export default {
	index: action<"GET", "/dashboard/tenants/:tenantId/resources">(({ params }) => {
		return new Response(`List resources for tenant ${params.tenantId}`);
	}),

	show: action<"GET", "/dashboard/tenants/:tenantId/resources/:id">(({ params }) => {
		return new Response(`Show resource ${params.id} for tenant ${params.tenantId}`);
	}),

	new: action<"GET", "/dashboard/tenants/:tenantId/resources/new">(({ params }) => {
		return new Response(`Show new resource form for tenant ${params.tenantId}`);
	}),

	create: action<"POST", "/dashboard/tenants/:tenantId/resources">(({ params }) => {
		return new Response(`Create resource for tenant ${params.tenantId}`);
	}),

	edit: action<"GET", "/dashboard/tenants/:tenantId/resources/:id/edit">(({ params }) => {
		return new Response(`Show edit resource form for ${params.id} in tenant ${params.tenantId}`);
	}),

	update: action<"PUT", "/dashboard/tenants/:tenantId/resources/:id">(({ params }) => {
		return new Response(`Update resource ${params.id} for tenant ${params.tenantId}`);
	}),

	destroy: action<"DELETE", "/dashboard/tenants/:tenantId/resources/:id">(({ params }) => {
		return new Response(`Delete resource ${params.id} for tenant ${params.tenantId}`);
	}),
};
