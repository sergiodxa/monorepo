import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";

import action from "~/lib/action";
import Client from "~/tenant/models/client";

export const index = action<"GET", "/api/clients">(async (ctx) => {
	let list = await Client.list(ctx.db);
	return ok(list);
});

export const show = action<"GET", "/api/clients/:id">(async ({ params, db }) => {
	let client = await Client.show(db, params.id);
	if (client) return ok(client);
	return notFound({ message: "Client not found" });
});

export const create = action<"POST", "/api/clients">(async ({ db, formData }) => {
	let result = await validate(formData, Client.table);
	if (isFailure(result)) return badRequest(result.error.issues);
	let writeResult = await Client.create(db, result.data);
	return created({ id: writeResult.insertId });
});

export const update = action<"PUT", "/api/clients/:id">(async ({ params, db, formData }) => {
	let result = await validate(formData, Client.table);
	if (isFailure(result)) return badRequest(result.error.issues);
	let client = await Client.update(db, params.id, result.data);
	return ok(client);
});

export const destroy = action<"DELETE", "/api/clients/:id">(async ({ params, db }) => {
	let deleted = await Client.destroy(db, params.id);
	if (deleted) return noContent();
	return badRequest({ message: "Failed to delete client" });
});
