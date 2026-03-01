import action from "~/lib/action";

export const index = action<"GET", "/api/clients/:clientId/logout-uris">(({ params }) => {
	return new Response(`List logout URIs for client ${params.clientId}`);
});

export const create = action<"POST", "/api/clients/:clientId/logout-uris">(({ params }) => {
	return new Response(`Create logout URI for client ${params.clientId}`);
});

export const destroy = action<"DELETE", "/api/clients/:clientId/logout-uris/:id">(({ params }) => {
	return new Response(`Delete logout URI ${params.id} for client ${params.clientId}`);
});
