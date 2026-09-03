/**
 * Management API controller for OAuth clients (`/api/clients`).
 *
 * Exposes the CRUD actions for registering and configuring clients, validating
 * request bodies and normalizing timestamps in responses.
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
import { httpsUrl, LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Client from "../models/client.js";

type ClientRow = Awaited<ReturnType<typeof Client.list>>[number];

/**
 * Normalizes a client row for API responses, converting stored timestamps to ISO strings.
 * @param client - The raw client record.
 * @returns The client with `created_at`/`updated_at` as ISO strings.
 */
function normalizeClient(client: ClientRow) {
	return {
		...client,
		created_at: toIsoString(client.created_at),
		updated_at: toIsoString(client.updated_at),
	};
}

let nameSchema = s.string().pipe(minLength(LIMITS.name.min), maxLength(LIMITS.name.max));
let descriptionSchema = s.string().pipe(maxLength(LIMITS.description.max));
let logoUrlSchema = s.string().pipe(maxLength(LIMITS.url.max), httpsUrl());
let scopeSchema = s.string().pipe(minLength(LIMITS.scope.min), maxLength(LIMITS.scope.max));

let CreateClientSchema = s.object({
	name: nameSchema,
	type: s.enum_(["public", "confidential", "m2m"]),
	description: s.optional(descriptionSchema),
	logoUrl: s.optional(logoUrlSchema),
	allowedScopes: s.optional(s.array(scopeSchema)),
	allowedResources: s.optional(s.array(s.string().pipe(maxLength(LIMITS.url.max)))),
	isManagementClient: s.optional(s.boolean()),
});

let UpdateClientSchema = s.object({
	name: s.optional(nameSchema),
	type: s.optional(s.enum_(["public", "confidential", "m2m"])),
	description: s.optional(s.nullable(descriptionSchema)),
	logoUrl: s.optional(s.nullable(logoUrlSchema)),
	allowedScopes: s.optional(s.nullable(s.array(scopeSchema))),
	allowedResources: s.optional(s.nullable(s.array(s.string().pipe(maxLength(LIMITS.url.max))))),
	isManagementClient: s.optional(s.boolean()),
});

/**
 * `GET /api/clients` — lists all registered clients.
 * @returns A JSON `Response` with the array of clients.
 */
export const index = createAction(
	routes.api.clients.index,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/api/clients");
		let list = await Client.list(db);
		log.info("Clients listed", { count: list.length });
		return ok(list.map(normalizeClient));
	}),
);

/**
 * `GET /api/clients/:id` — retrieves a single client.
 * @returns A JSON `Response` with the client, or `notFound`.
 */
export const show = createAction(
	routes.api.clients.show,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/clients/:id");
		let client = await Client.show(db, id);
		if (client) {
			log.info("Client retrieved", { clientId: id });
			return ok(normalizeClient(client));
		}
		log.info("Client not found", { clientId: id });
		return notFound({ error: "Client not found" });
	}),
);

/**
 * `POST /api/clients` — creates a new client from a validated JSON body.
 * @returns A JSON `Response` with the new client `id`, or an error `Response`.
 */
export const create = createAction(
	routes.api.clients.create,
	inject([Database] as const, async (db) => {
		let { request, logger } = getContext();
		let log = logger.action("/api/clients");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body");
			return body;
		}

		let result = await validate(body, CreateClientSchema);
		if (isFailure(result)) {
			log.info("Invalid request body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let data = result.data;

		try {
			let { id } = await Client.create(db, {
				name: data.name,
				type: data.type,
				description: data.description,
				logoUrl: data.logoUrl,
				allowedScopes: data.allowedScopes,
				allowedResources: data.allowedResources,
				isManagementClient: data.isManagementClient,
			});

			log.info("Client created", { clientId: id, type: data.type });
			return created({ id });
		} catch (error) {
			if (error instanceof Client.InvalidLogoUrlError) {
				log.info("Invalid logo URL", { error: error.message });
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);

/**
 * `PATCH/PUT /api/clients/:id` — updates a client from a validated JSON body.
 * @returns A JSON `Response` with the updated client, or an error `Response`.
 */
export const update = createAction(
	routes.api.clients.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/clients/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { clientId: id });
			return body;
		}

		let result = await validate(body, UpdateClientSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let data = result.data;

		try {
			await Client.update(db, id, {
				name: data.name,
				type: data.type,
				description: data.description,
				logoUrl: data.logoUrl,
				allowedScopes: data.allowedScopes,
				allowedResources: data.allowedResources,
				isManagementClient: data.isManagementClient,
			});

			let client = await Client.show(db, id);
			log.info("Client updated", { clientId: id });
			return ok(client ? normalizeClient(client) : null);
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Client not found", { clientId: id });
				return notFound({ error: "Client not found" });
			}
			if (error instanceof Client.InvalidLogoUrlError) {
				log.info("Invalid logo URL", { clientId: id, error: error.message });
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);

/**
 * `DELETE /api/clients/:id` — deletes a client.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.clients.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.action("/api/clients/:id");
		try {
			await Client.destroy(db, id);
			log.info("Client deleted", { clientId: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Client not found", { clientId: id });
				return notFound({ error: "Client not found" });
			}
			throw error;
		}
	}),
);
