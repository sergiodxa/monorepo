import action from "~/lib/action";

export const show = action<"GET", "/api/brand">(() => {
	return new Response("Show brand");
});

export const update = action<"PUT", "/api/brand">(() => {
	return new Response("Update brand");
});
