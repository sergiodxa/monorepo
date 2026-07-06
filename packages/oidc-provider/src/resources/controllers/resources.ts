/**
 * Management API controller for protected resources (`/api/resources`).
 *
 * Exposes the CRUD actions for API resources and their scopes, validating request
 * bodies and normalizing stored scopes/timestamps in responses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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

/**
 * Normalizes a resource row for API responses, parsing scopes and converting
 * timestamps to ISO strings.
 * @param resource - The raw resource record.
 * @returns The resource with parsed `scopes` and ISO `created_at`/`updated_at`.
 */
function normalizeResource(resource: ResourceRow) {
	return {
		...resource,
		scopes: Resource.parseScopes(resource),
		created_at: toIsoString(resource.created_at),
		updated_at: toIsoString(resource.updated_at),
	};
}

/** Reusable check for the resource `name` field. */
let nameSchema = s.string().pipe(minLength(LIMITS.name.min), maxLength(LIMITS.name.max));
/** Reusable check for description fields (resource and scope). */
let descriptionSchema = s.string().pipe(maxLength(LIMITS.description.max));
/** Reusable check for the resource `identifier` (audience) field. */
let identifierSchema = s.string().pipe(minLength(LIMITS.url.min), maxLength(LIMITS.url.max));

/** Validation schema for a single scope entry on a resource. */
let ScopeSchema = s.object({
	name: s.string().pipe(minLength(LIMITS.scope.min), maxLength(LIMITS.scope.max)),
	description: s.optional(descriptionSchema),
});

/** Validation schema for the create-resource request body. */
let CreateResourceSchema = s.object({
	identifier: identifierSchema,
	name: nameSchema,
	description: s.optional(descriptionSchema),
	scopes: s.array(ScopeSchema),
});

/** Validation schema for the update-resource request body (all fields optional). */
let UpdateResourceSchema = s.object({
	identifier: s.optional(identifierSchema),
	name: s.optional(nameSchema),
	description: s.optional(s.nullable(descriptionSchema)),
	scopes: s.optional(s.array(ScopeSchema)),
});

/**
 * `GET /api/resources` — lists all resources with parsed scopes.
 * @returns A JSON `Response` with the array of resources.
 */
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

/**
 * `GET /api/resources/:id` — retrieves a single resource.
 * @returns A JSON `Response` with the resource, or `notFound`.
 */
export const show = createAction(
	routes.api.resources.show,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/resources/:id");
		let resource = await Resource.show(db, id);
		if (!resource) {
			log.info("Resource not found", { resourceId: id });
			return notFound({ error: "Resource not found" });
		}
		log.info("Resource retrieved", { resourceId: id });
		return ok(normalizeResource(resource));
	}),
);

/**
 * `POST /api/resources` — creates a resource from a validated JSON body.
 * @returns A JSON `Response` with the new resource `id`, or an error `Response`.
 */
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

/**
 * `PATCH/PUT /api/resources/:id` — updates a resource from a validated JSON body.
 * @returns A JSON `Response` with the updated resource, or an error `Response`.
 */
export const update = createAction(
	routes.api.resources.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/resources/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { resourceId: id });
			return body;
		}

		let result = await validate(body, UpdateResourceSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { resourceId: id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Resource.update(db, id, result.data);
			let resource = await Resource.show(db, id);
			if (!resource) {
				log.info("Resource not found after update", { resourceId: id });
				return notFound({ error: "Resource not found" });
			}
			log.info("Resource updated", { resourceId: id });
			return ok(normalizeResource(resource));
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Resource not found", { resourceId: id });
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	}),
);

/**
 * `DELETE /api/resources/:id` — deletes a resource.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.resources.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/resources/:id");
		try {
			await Resource.destroy(db, id);
			log.info("Resource deleted", { resourceId: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Resource not found", { resourceId: id });
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	}),
);
