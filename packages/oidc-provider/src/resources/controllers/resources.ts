/**
 * Management API controller for protected resources (`/api/resources`).
 *
 * Exposes the CRUD actions for API resources and their scopes, validating request
 * bodies and normalizing stored scopes/timestamps in responses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { noContent } from "@sdxc/http/response";
import { badRequest, created, notFound, ok } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import routes from "../../routes.js";
import { RecordNotFoundError } from "../../shared/lib/db-errors.js";
import { isResponse, safeJsonParse } from "../../shared/lib/safe-json.js";
import { LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Resource from "../models/resource.js";

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

/**
 * `GET /api/resources` — lists all resources with parsed scopes.
 * @returns A JSON `Response` with the array of resources.
 */
export const index = createAction(
	routes.api.resources.index,
	inject([Database] as const, async (db) => {
		let { log } = getContext();
		let resources = await Resource.list(db);
		let result = resources.map(normalizeResource);
		log.note("admin.resource.listed", { count: result.length });
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
		let { params, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		log.set({ resource: { id } });
		let resource = await Resource.show(db, id);
		if (!resource) {
			log.warn("admin.resource.not_found");
			return notFound({ error: "Resource not found" });
		}
		log.note("admin.resource.retrieved");
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
		let { request, log } = getContext();
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.warn("http.invalid_json");
			return body;
		}

		let result = await validate(body, CreateResourceSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id } = await Resource.create(db, result.data);
		log.note("admin.resource.created", {
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
		let { params, request, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		log.set({ resource: { id } });
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.warn("http.invalid_json");
			return body;
		}

		let result = await validate(body, UpdateResourceSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		try {
			await Resource.update(db, id, result.data);
			let resource = await Resource.show(db, id);
			if (!resource) {
				log.warn("admin.resource.not_found");
				return notFound({ error: "Resource not found" });
			}
			log.note("admin.resource.updated");
			return ok(normalizeResource(resource));
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.resource.not_found");
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
		let { params, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		log.set({ resource: { id } });
		try {
			await Resource.destroy(db, id);
			log.note("admin.resource.deleted");
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.resource.not_found");
				return notFound({ error: "Resource not found" });
			}
			throw error;
		}
	}),
);
