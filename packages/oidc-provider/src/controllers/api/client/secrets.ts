import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "../../../lib/action";
import { RecordNotFoundError } from "../../../lib/db-errors";
import { LIMITS, maxLength } from "../../../lib/schema-checks";
import Client from "../../../models/client";
import Secret from "../../../models/client/secret";

let CreateSecretSchema = s.object({
	name: s.optional(s.string().pipe(maxLength(LIMITS.name.max))),
	expiresAt: s.optional(s.string().pipe(maxLength(30))), // ISO date string
});

export const index = action<"GET", "/api/clients/:clientId/secrets">(
	async ({ params, db, logger }) => {
		let log = logger.loader("/api/clients/:clientId/secrets");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let secrets = await Secret.list(db, params.clientId);
		log.info("Secrets listed", { clientId: params.clientId, count: secrets.length });
		return ok(secrets);
	},
);

export const create = action<"POST", "/api/clients/:clientId/secrets">(
	async ({ params, db, formData, logger }) => {
		let log = logger.action("/api/clients/:clientId/secrets");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateSecretSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: params.clientId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id, plainSecret } = await Secret.create(
			db,
			params.clientId,
			result.data.name,
			result.data.expiresAt,
		);

		log.info("Secret created", { clientId: params.clientId, secretId: id });

		// Return the plain secret only once - it cannot be retrieved later
		return created({
			id,
			secret: plainSecret,
			message: "Store this secret securely. It cannot be retrieved again.",
		});
	},
);

export const destroy = action<"DELETE", "/api/clients/:clientId/secrets/:id">(
	async ({ params, db, logger }) => {
		let log = logger.action("/api/clients/:clientId/secrets/:id");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		try {
			await Secret.destroy(db, params.id);
			log.info("Secret deleted", { clientId: params.clientId, secretId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Secret not found", { clientId: params.clientId, secretId: params.id });
				return notFound({ error: "Secret not found" });
			}
			throw error;
		}
	},
);
