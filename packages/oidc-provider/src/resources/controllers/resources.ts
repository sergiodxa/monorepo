import type { RequestContext } from "remix/fetch-router";

import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json";
import { LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks";
import { toIsoString } from "../../shared/lib/timestamp";
import Resource from "../models/resource";

type ResourceRow = Awaited<ReturnType<typeof Resource.list>>[number];

function normalizeResource(resource: ResourceRow) {
	return {
		...resource,
		scopes: Resource.parseScopes(resource),
		created_at: toIsoString(resource.created_at),
		updated_at: toIsoString(resource.updated_at),
	};
}

let nameSchema = s.string().pipe(minLength(LIMITS.name.min), maxLength(LIMITS.name.max));
let descriptionSchema = s.string().pipe(maxLength(LIMITS.description.max));
let identifierSchema = s.string().pipe(minLength(LIMITS.url.min), maxLength(LIMITS.url.max));

let ScopeSchema = s.object({
	name: s.string().pipe(minLength(LIMITS.scope.min), maxLength(LIMITS.scope.max)),
	description: s.optional(descriptionSchema),
});

let CreateResourceSchema = s.object({
	identifier: identifierSchema,
	name: nameSchema,
	description: s.optional(descriptionSchema),
	scopes: s.array(ScopeSchema),
});

let UpdateResourceSchema = s.object({
	identifier: s.optional(identifierSchema),
	name: s.optional(nameSchema),
	description: s.optional(s.nullable(descriptionSchema)),
	scopes: s.optional(s.array(ScopeSchema)),
});

export const index = createAction(
	routes.api.resources.index,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/api/resources");
		let resources = await Resource.list(db);
		let result = resources.map(normalizeResource);
		log.info("Resources listed", { count: result.length });
		return ok(result);
	}),
);

export const show = createAction(
	routes.api.resources.show,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.loader("/api/resources/:id");
		let resource = await Resource.show(db, params.id);
		if (!resource) {
			log.info("Resource not found", { resourceId: params.id });
			return notFound({ error: "Resource not found" });
		}
		log.info("Resource retrieved", { resourceId: params.id });
		return ok(normalizeResource(resource));
	}),
);

export const create = createAction(
	routes.api.resources.create,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
		let log = logger.action("/api/resources");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body");
			return body;
		}

		let result = await validate(body, CreateResourceSchema);
		if (isFailure(result)) {
			log.info("Invalid request body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id } = await Resource.create(db, result.data);
		log.info("Resource created", {
			resourceId: id,
			identifier: result.data.identifier,
		});
		return created({ id });
	}),
);

export const update = createAction(
	routes.api.resources.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.action("/api/resources/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { resourceId: params.id });
			return body;
		}

		let result = await validate(body, UpdateResourceSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { resourceId: params.id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Resource.update(db, params.id, result.data);
			let resource = await Resource.show(db, params.id);
			if (!resource) {
				log.info("Resource not found after update", { resourceId: params.id });
				return notFound({ error: "Resource not found" });
			}
			log.info("Resource updated", { resourceId: params.id });
			return ok(normalizeResource(resource));
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Resource not found", { resourceId: params.id });
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	}),
);

export const destroy = createAction(
	routes.api.resources.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.action("/api/resources/:id");
		try {
			await Resource.destroy(db, params.id);
			log.info("Resource deleted", { resourceId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Resource not found", { resourceId: params.id });
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	}),
);
