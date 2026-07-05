/**
 * Management API controller for a client's logout URIs
 * (`/api/clients/:clientId/logout-uris`).
 *
 * Lists, creates (with URI validation), and deletes the post-logout, back-channel,
 * and front-channel logout endpoints registered for a client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
import { httpsUrl, LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks";
import { toIsoString } from "../../shared/lib/timestamp";
import Client from "../models/client";
import LogoutUri from "../models/logout-uri";

type LogoutUriRow = Awaited<ReturnType<typeof LogoutUri.list>>[number];

/**
 * Normalizes a logout-URI row for API responses (timestamp to ISO string).
 * @param logoutUri - The raw logout-URI record.
 * @returns The record with `created_at` as an ISO string.
 */
function normalizeLogoutUri(logoutUri: LogoutUriRow) {
	return {
		...logoutUri,
		created_at: toIsoString(logoutUri.created_at),
	};
}

/** Validation schema for the create-logout-URI request body. */
let CreateLogoutUriSchema = s.object({
	uri: s.string().pipe(minLength(LIMITS.url.min), maxLength(LIMITS.url.max), httpsUrl()),
	type: s.enum_(["post_logout", "backchannel", "frontchannel"]),
	sessionRequired: s.optional(s.boolean()),
	environment: s.optional(s.string().pipe(maxLength(50))),
});

/**
 * `GET /api/clients/:clientId/logout-uris` — lists a client's logout URIs.
 * @returns A JSON `Response` with the logout URIs, or `notFound` if the client is missing.
 */
export const index = createAction(
	routes.api.clients["logout-uris"].index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ clientId: string }>;
		let log = logger.loader("/api/clients/:clientId/logout-uris");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let logoutUris = await LogoutUri.list(db, params.clientId);
		log.info("Logout URIs listed", { clientId: params.clientId, count: logoutUris.length });
		return ok(logoutUris.map(normalizeLogoutUri));
	}),
);

/**
 * `POST /api/clients/:clientId/logout-uris` — adds a logout URI to a client.
 * @returns A JSON `Response` with the new URI's id, or an error `Response`.
 */
export const create = createAction(
	routes.api.clients["logout-uris"].create,
	inject([Database] as const, async (db) => {
		let { params, formData, logger } = getContext() as RequestContext<{ clientId: string }>;
		let log = logger.action("/api/clients/:clientId/logout-uris");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateLogoutUriSchema);
		if (isFailure(result)) {
			log.info("Invalid request body", { clientId: params.clientId });
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id } = await LogoutUri.create(db, params.clientId, result.data);

		log.info("Logout URI created", {
			clientId: params.clientId,
			logoutUriId: id,
			type: result.data.type,
		});
		return created({ id });
	}),
);

/**
 * `DELETE /api/clients/:clientId/logout-uris/:id` — removes a logout URI.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.clients["logout-uris"].destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ clientId: string; id: string }>;
		let log = logger.action("/api/clients/:clientId/logout-uris/:id");

		// Verify client exists
		let client = await Client.show(db, params.clientId);
		if (!client) {
			log.info("Client not found", { clientId: params.clientId });
			return notFound({ error: "Client not found" });
		}

		try {
			await LogoutUri.destroy(db, params.id);
			log.info("Logout URI deleted", { clientId: params.clientId, logoutUriId: params.id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.info("Logout URI not found", { clientId: params.clientId, logoutUriId: params.id });
				return notFound({ error: "Logout URI not found" });
			}
			throw error;
		}
	}),
);
