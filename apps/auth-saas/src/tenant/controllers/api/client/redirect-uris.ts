import action from "~/lib/action";

export const index = action<"GET", "/api/clients/:clientId/redirect-uris">(({ params }) => {
	return new Response(`List redirect URIs for client ${params.clientId}`);
});

export const create = action<"POST", "/api/clients/:clientId/redirect-uris">(({ params }) => {
	return new Response(`Create redirect URI for client ${params.clientId}`);
});

export const destroy = action<"DELETE", "/api/clients/:clientId/redirect-uris/:id">(
	({ params }) => {
		return new Response(`Delete redirect URI ${params.id} for client ${params.clientId}`);
	},
);
