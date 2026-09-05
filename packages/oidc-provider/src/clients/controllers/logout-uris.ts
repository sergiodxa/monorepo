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
import { httpsUrl, LIMITS, maxLength, minLength } from "../../shared/lib/schema-checks.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Client from "../models/client.js";
import LogoutUri from "../models/logout-uri.js";

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
		let { params, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let logoutUris = await LogoutUri.list(db, clientId);
		log.note("admin.client.logout_uri.listed", { count: logoutUris.length });
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
		let { params, formData, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateLogoutUriSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id } = await LogoutUri.create(db, clientId, result.data);

		log.note("admin.client.logout_uri.created", {
			logout_uri_id: id,
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
		let { params, log } = getContext();
		let { clientId, id } = s.parse(s.object({ clientId: s.string(), id: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		try {
			await LogoutUri.destroy(db, id);
			log.note("admin.client.logout_uri.deleted", { logout_uri_id: id });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.client.logout_uri.not_found", { logout_uri_id: id });
				return notFound({ error: "Logout URI not found" });
			}
			throw error;
		}
	}),
);
