/**
 * Management API controller for a client's secrets (`/api/clients/:clientId/secrets`).
 *
 * Lists secret metadata and creates or deletes secrets; the plaintext secret is
 * returned only once, at creation time.
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
import { LIMITS, maxLength } from "../../shared/lib/schema-checks.js";
import Client from "../models/client.js";
import Secret from "../models/secret.js";

/**
 * Validation schema for the create-secret request body.
 * `expiresAt` is an ISO date string.
 */
let CreateSecretSchema = s.object({
	name: s.optional(s.string().pipe(maxLength(LIMITS.name.max))),
	expiresAt: s.optional(s.string().pipe(maxLength(30))),
});

/**
 * `GET /api/clients/:clientId/secrets` — lists a client's secret metadata.
 * @returns A JSON `Response` with the secrets, or `notFound` if the client is missing.
 */
export const index = createAction(
	routes.api.clients.secrets.index,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let secrets = await Secret.list(db, clientId);
		log.note("admin.client.secret.listed", { count: secrets.length });
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
		let { params, formData, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateSecretSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id, plainSecret } = await Secret.create(
			db,
			clientId,
			result.data.name,
			result.data.expiresAt,
		);

		log.note("admin.client.secret.created", { secret_id: id });

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
		let { params, log } = getContext();
		let { clientId, id } = s.parse(s.object({ clientId: s.string(), id: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		try {
			await Secret.destroy(db, id);
			log.note("admin.client.secret.deleted", { secret_id: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.client.secret.not_found", { secret_id: id });
				return notFound({ error: "Secret not found" });
			}
			throw error;
		}
	}),
);
