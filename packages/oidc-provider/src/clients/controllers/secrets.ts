/**
 * Management API controller for a client's secrets (`/api/clients/:clientId/secrets`).
 *
 * Lists secret metadata and creates or deletes secrets; the plaintext secret is
 * returned only once, at creation time.
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
import { LIMITS, maxLength } from "../../shared/lib/schema-checks";
import Client from "../models/client";
import Secret from "../models/secret";

/** Validation schema for the create-secret request body. */
let CreateSecretSchema = s.object({
	name: s.optional(s.string().pipe(maxLength(LIMITS.name.max))),
	expiresAt: s.optional(s.string().pipe(maxLength(30))), // ISO date string
});

/**
 * `GET /api/clients/:clientId/secrets` — lists a client's secret metadata.
 * @returns A JSON `Response` with the secrets, or `notFound` if the client is missing.
 */
export const index = createAction(
	routes.api.clients.secrets.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		let log = logger.loader("/api/clients/:clientId/secrets");

		// Verify client exists
		let client = await Client.show(db, clientId);
		if (!client) {
			log.info("Client not found", { clientId });
			return notFound({ error: "Client not found" });
		}

		let secrets = await Secret.list(db, clientId);
		log.info("Secrets listed", { clientId, count: secrets.length });
		return ok(secrets);
	}),
);

/**
 * `POST /api/clients/:clientId/secrets` — creates a secret, returning it once.
 * @returns A JSON `Response` with the new secret's id and plaintext value, or an error `Response`.
 */
export const create = createAction(
	routes.api.clients.secrets.create,
	inject([Database] as const, async (db) => {
		let { params, formData, logger } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		let log = logger.action("/api/clients/:clientId/secrets");

		// Verify client exists
		let client = await Client.show(db, clientId);
		if (!client) {
			log.info("Client not found", { clientId });
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateSecretSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id, plainSecret } = await Secret.create(
			db,
			clientId,
			result.data.name,
			result.data.expiresAt,
		);

		log.info("Secret created", { clientId, secretId: id });

		// Return the plain secret only once - it cannot be retrieved later
		return created({
			id,
			secret: plainSecret,
			message: "Store this secret securely. It cannot be retrieved again.",
		});
	}),
);

/**
 * `DELETE /api/clients/:clientId/secrets/:id` — deletes a secret.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.clients.secrets.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { clientId, id } = s.parse(s.object({ clientId: s.string(), id: s.string() }), params);
		let log = logger.action("/api/clients/:clientId/secrets/:id");

		// Verify client exists
		let client = await Client.show(db, clientId);
		if (!client) {
			log.info("Client not found", { clientId });
			return notFound({ error: "Client not found" });
		}

		try {
			await Secret.destroy(db, id);
			log.info("Secret deleted", { clientId, secretId: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Secret not found", { clientId, secretId: id });
				return notFound({ error: "Secret not found" });
			}
			throw error;
		}
	}),
);
