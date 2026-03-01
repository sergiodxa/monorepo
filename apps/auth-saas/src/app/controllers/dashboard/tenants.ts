import action from "~/lib/action";

export default {
	show: action<"GET", "/dashboard/tenants/:id">(({ params }) => {
		return new Response(`Show tenant ${params.id}`);
	}),

	new: action<"GET", "/dashboard/tenants/new">(() => {
		return new Response("Show new tenant form");
	}),

	create: action<"POST", "/dashboard/tenants">(() => {
		return new Response("Create tenant");
	}),

	edit: action<"GET", "/dashboard/tenants/:id/edit">(({ params }) => {
		return new Response(`Show edit tenant form for ${params.id}`);
	}),

	update: action<"PUT", "/dashboard/tenants/:id">(({ params }) => {
		return new Response(`Update tenant ${params.id}`);
	}),
};
