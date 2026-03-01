import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Client from "~/tenant/models/client";
import RedirectUri from "~/tenant/models/client/redirect-uri";

let CreateRedirectUriSchema = s.object({
	uri: s.string(),
	environment: s.optional(s.string()),
});

export const index = action<"GET", "/api/clients/:clientId/redirect-uris">(
	async ({ params, db, logger }) => {
		let log = logger.loader("/api/clients/:clientId/redirect-uris");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let redirectUris = await RedirectUri.list(db, params.clientId);
		log.info("Redirect URIs listed", {
			clientId: params.clientId,
			count: redirectUris.length,
		});
		return ok(redirectUris);
	},
);

export const create = action<"POST", "/api/clients/:clientId/redirect-uris">(
	async ({ params, db, formData, logger }) => {
		let log = logger.action("/api/clients/:clientId/redirect-uris");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateRedirectUriSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: params.clientId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let writeResult = await RedirectUri.create(
			db,
			params.clientId,
			result.data.uri,
			result.data.environment,
		);

		log.info("Redirect URI created", {
			clientId: params.clientId,
			redirectUriId: writeResult.insertId,
		});
		return created({ id: writeResult.insertId });
	},
);

export const destroy = action<"DELETE", "/api/clients/:clientId/redirect-uris/:id">(
	async ({ params, db, logger }) => {
		let log = logger.action("/api/clients/:clientId/redirect-uris/:id");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		try {
			await RedirectUri.destroy(db, { id: params.id });
			log.info("Redirect URI deleted", {
				clientId: params.clientId,
				redirectUriId: params.id,
			});
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Redirect URI not found", {
					clientId: params.clientId,
					redirectUriId: params.id,
				});
				return notFound({ error: "Redirect URI not found" });
			}
			throw error;
		}
	},
);
