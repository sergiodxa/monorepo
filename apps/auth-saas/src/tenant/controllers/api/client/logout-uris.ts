import { noContent } from "@pkg/http/response";
import { badRequest, created, notFound, ok } from "@pkg/http/response/json";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Client from "~/tenant/models/client";
import LogoutUri from "~/tenant/models/client/logout-uri";

let CreateLogoutUriSchema = s.object({
	uri: s.string(),
	type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
	sessionRequired: s.optional(s.boolean()),
	environment: s.optional(s.string()),
});

export const index = action<"GET", "/api/clients/:clientId/logout-uris">(
	async ({ params, db, logger }) => {
		let log = logger.loader("/api/clients/:clientId/logout-uris");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let logoutUris = await LogoutUri.list(db, params.clientId);
		log.info("Logout URIs listed", { clientId: params.clientId, count: logoutUris.length });
		return ok(logoutUris);
	},
);

export const create = action<"POST", "/api/clients/:clientId/logout-uris">(
	async ({ params, db, formData, logger }) => {
		let log = logger.action("/api/clients/:clientId/logout-uris");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateLogoutUriSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: params.clientId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let writeResult = await LogoutUri.create(db, params.clientId, result.data);

		log.info("Logout URI created", {
			clientId: params.clientId,
			logoutUriId: writeResult.insertId,
			type: result.data.type,
		});
		return created({ id: writeResult.insertId });
	},
);

export const destroy = action<"DELETE", "/api/clients/:clientId/logout-uris/:id">(
	async ({ params, db, logger }) => {
		let log = logger.action("/api/clients/:clientId/logout-uris/:id");

		// Verify client exists
		let client = await Client.show(db, { id: params.clientId });
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		try {
			await LogoutUri.destroy(db, { id: params.id });
			log.info("Logout URI deleted", { clientId: params.clientId, logoutUriId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Logout URI not found", { clientId: params.clientId, logoutUriId: params.id });
				return notFound({ error: "Logout URI not found" });
			}
			throw error;
		}
	},
);
