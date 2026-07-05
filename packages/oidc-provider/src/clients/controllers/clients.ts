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
import { httpsUrl, LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks";
import { toIsoString } from "../../shared/lib/timestamp";
import Client from "../models/client";

type ClientRow = Awaited<ReturnType<typeof Client.list>>[number];

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

export const show = createAction(
	routes.api.clients.show,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.loader("/api/clients/:id");
		let client = await Client.show(db, params.id);
		if (client) {
			log.info("Client retrieved", { clientId: params.id });
			return ok(normalizeClient(client));
		}
		log.info("Client not found", { clientId: params.id });
		return notFound({ error: "Client not found" });
	}),
);

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

export const update = createAction(
	routes.api.clients.update,
	inject([Database] as const, async (db) => {
		let { params, request, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.action("/api/clients/:id");
		let body = await safeJsonParse(request);
		if (isResponse(body)) {
			log.info("Invalid JSON body", { clientId: params.id });
			return body;
		}

		let result = await validate(body, UpdateClientSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: params.id });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let data = result.data;

		try {
			await Client.update(db, params.id, {
				name: data.name,
				type: data.type,
				description: data.description,
				logoUrl: data.logoUrl,
				allowedScopes: data.allowedScopes,
				allowedResources: data.allowedResources,
				isManagementClient: data.isManagementClient,
			});

			let client = await Client.show(db, params.id);
			log.info("Client updated", { clientId: params.id });
			return ok(client ? normalizeClient(client) : null);
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Client not found", { clientId: params.id });
				return notFound({ error: "Client not found" });
			}
			if (error instanceof Client.InvalidLogoUrlError) {
				log.info("Invalid logo URL", { clientId: params.id, error: error.message });
				return badRequest({ error: error.message });
			}
			throw error;
		}
	}),
);

export const destroy = createAction(
	routes.api.clients.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.action("/api/clients/:id");
		try {
			await Client.destroy(db, params.id);
			log.info("Client deleted", { clientId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Client not found", { clientId: params.id });
				return notFound({ error: "Client not found" });
			}
			throw error;
		}
	}),
);
