import action from "~/lib/action";

export const index = action<"GET", "/api/resources">(() => {
	return new Response("List resources");
});

export const show = action<"GET", "/api/resources/:id">(({ params }) => {
	return new Response(`Show resource ${params.id}`);
});

export const create = action<"POST", "/api/resources">(() => {
	return new Response("Create resource");
});

export const update = action<"PUT", "/api/resources/:id">(({ params }) => {
	return new Response(`Update resource ${params.id}`);
});

export const destroy = action<"DELETE", "/api/resources/:id">(({ params }) => {
	return new Response(`Delete resource ${params.id}`);
});
