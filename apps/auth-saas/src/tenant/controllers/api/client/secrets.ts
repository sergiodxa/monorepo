import action from "~/lib/action";

export const index = action<"GET", "/api/clients/:clientId/secrets">(({ params }) => {
	return new Response(`List secrets for client ${params.clientId}`);
});

export const create = action<"POST", "/api/clients/:clientId/secrets">(({ params }) => {
	return new Response(`Create secret for client ${params.clientId}`);
});

export const destroy = action<"DELETE", "/api/clients/:clientId/secrets/:id">(({ params }) => {
	return new Response(`Delete secret ${params.id} for client ${params.clientId}`);
});
