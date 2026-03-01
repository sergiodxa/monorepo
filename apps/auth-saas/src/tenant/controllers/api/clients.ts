import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Client from "~/tenant/models/client";

let CreateClientSchema = s.object({
	name: s.string(),
	type: s.enum_(["public", "confidential", "m2m"]),
	description: s.optional(s.string()),
	logoUrl: s.optional(s.string()),
	allowedScopes: s.optional(s.array(s.string())),
	allowedResources: s.optional(s.array(s.string())),
	isManagementClient: s.optional(s.boolean()),
});

let UpdateClientSchema = s.object({
	name: s.optional(s.string()),
	type: s.optional(s.enum_(["public", "confidential", "m2m"])),
	description: s.optional(s.nullable(s.string())),
	logoUrl: s.optional(s.nullable(s.string())),
	allowedScopes: s.optional(s.nullable(s.array(s.string()))),
	allowedResources: s.optional(s.nullable(s.array(s.string()))),
	isManagementClient: s.optional(s.boolean()),
});

export const index = action<"GET", "/api/clients">(async ({ db }) => {
	let list = await Client.list(db);
	return ok(list);
});

export const show = action<"GET", "/api/clients/:id">(async ({ params, db }) => {
	let client = await Client.show(db, { id: params.id });
	if (client) return ok(client);
	return notFound({ error: "Client not found" });
});

export const create = action<"POST", "/api/clients">(async ({ db, request }) => {
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, CreateClientSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let data = result.data;

	let writeResult = await Client.create(db, {
		name: data.name,
		type: data.type,
		description: data.description,
		logoUrl: data.logoUrl,
		allowedScopes: data.allowedScopes,
		allowedResources: data.allowedResources,
		isManagementClient: data.isManagementClient,
	});

	return created({ id: writeResult.insertId });
});

export const update = action<"PUT", "/api/clients/:id">(async ({ params, db, request }) => {
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, UpdateClientSchema);
	if (isFailure(result)) {
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let data = result.data;

	try {
		await Client.update(
			db,
			{ id: params.id },
			{
				name: data.name,
				type: data.type,
				description: data.description,
				logoUrl: data.logoUrl,
				allowedScopes: data.allowedScopes,
				allowedResources: data.allowedResources,
				isManagementClient: data.isManagementClient,
			},
		);

		let client = await Client.show(db, { id: params.id });
		return ok(client);
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			return notFound({ error: "Client not found" });
		}
		throw error;
	}
});

export const destroy = action<"DELETE", "/api/clients/:id">(async ({ params, db }) => {
	try {
		await Client.destroy(db, { id: params.id });
		return noContent();
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			return notFound({ error: "Client not found" });
		}
		throw error;
	}
});
