import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Resource from "~/tenant/models/resource";

let ScopeSchema = s.object({
	name: s.string(),
	description: s.optional(s.string()),
});

let CreateResourceSchema = s.object({
	identifier: s.string(),
	name: s.string(),
	description: s.optional(s.string()),
	scopes: s.array(ScopeSchema),
});

let UpdateResourceSchema = s.object({
	identifier: s.optional(s.string()),
	name: s.optional(s.string()),
	description: s.optional(s.nullable(s.string())),
	scopes: s.optional(s.array(ScopeSchema)),
});

export const index = action<"GET", "/api/resources">(async ({ db, logger }) => {
	let log = logger.loader("/api/resources");
	let resources = await Resource.list(db);
	// Parse scopes JSON for each resource
	let result = resources.map((r) => ({
		...r,
		scopes: Resource.parseScopes(r),
	}));
	log.info("Resources listed", { count: result.length });
	return ok(result);
});

export const show = action<"GET", "/api/resources/:id">(async ({ params, db, logger }) => {
	let log = logger.loader("/api/resources/:id");
	let resource = await Resource.show(db, { id: params.id });
	if (!resource) {
		log.info("Resource not found", { resourceId: params.id });
		return notFound({ error: "Resource not found" });
	}
	log.info("Resource retrieved", { resourceId: params.id });
	return ok({
		...resource,
		scopes: Resource.parseScopes(resource),
	});
});

export const create = action<"POST", "/api/resources">(async ({ db, request, logger }) => {
	let log = logger.action("/api/resources");
	let body = (await request.json()) as Record<string, unknown>;
	let result = await validate(body, CreateResourceSchema);
	if (isFailure(result)) {
		log.info("Invalid request body");
		return badRequest({ error: "Invalid request", issues: result.error.issues });
	}

	let writeResult = await Resource.create(db, result.data);
	log.info("Resource created", {
		resourceId: writeResult.insertId,
		identifier: result.data.identifier,
	});
	return created({ id: writeResult.insertId });
});

export const update = action<"PUT", "/api/resources/:id">(
	async ({ params, db, request, logger }) => {
		let log = logger.action("/api/resources/:id");
		let body = (await request.json()) as Record<string, unknown>;
		let result = await validate(body, UpdateResourceSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { resourceId: params.id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Resource.update(db, { id: params.id }, result.data);
			let resource = await Resource.show(db, { id: params.id });
			log.info("Resource updated", { resourceId: params.id });
			return ok({
				...resource,
				scopes: resource ? Resource.parseScopes(resource) : [],
			});
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Resource not found", { resourceId: params.id });
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	},
);

export const destroy = action<"DELETE", "/api/resources/:id">(async ({ params, db, logger }) => {
	let log = logger.action("/api/resources/:id");
	try {
		await Resource.destroy(db, { id: params.id });
		log.info("Resource deleted", { resourceId: params.id });
		return noContent();
	} catch (error) {
		if (error instanceof RecordNotFoundError) {
			log.info("Resource not found", { resourceId: params.id });
			return notFound({ error: "Resource not found" });
		}
		throw error;
	}
});
