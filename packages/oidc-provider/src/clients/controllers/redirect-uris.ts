/**
 * Management API controller for a client's redirect URIs
 * (`/api/clients/:clientId/redirect-uris`).
 *
 * Lists, creates (with URI validation), and deletes the redirect URIs that a
 * client is allowed to use in the authorization-code flow.
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
import { LIMITS, maxLength, minLength, url } from "../../shared/lib/schema-checks.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Client from "../models/client.js";
import RedirectUri from "../models/redirect-uri.js";

type RedirectUriRow = Awaited<ReturnType<typeof RedirectUri.list>>[number];

/**
 * Normalizes a redirect-URI row for API responses (timestamp to ISO string).
 * @param redirectUri - The raw redirect-URI record.
 * @returns The record with `created_at` as an ISO string.
 */
function normalizeRedirectUri(redirectUri: RedirectUriRow) {
	return {
		...redirectUri,
		created_at: toIsoString(redirectUri.created_at),
	};
}

let CreateRedirectUriSchema = s.object({
	uri: s.string().pipe(minLength(LIMITS.url.min), maxLength(LIMITS.url.max), url()),
	environment: s.optional(s.string().pipe(maxLength(50))),
});

/**
 * `GET /api/clients/:clientId/redirect-uris` — lists a client's redirect URIs.
 * @returns A JSON `Response` with the redirect URIs, or `notFound` if the client is missing.
 */
export const index = createAction(
	routes.api.clients["redirect-uris"].index,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let redirectUris = await RedirectUri.list(db, clientId);
		log.note("admin.client.redirect_uri.listed", {
			count: redirectUris.length,
		});
		return ok(redirectUris.map(normalizeRedirectUri));
	}),
);

/**
 * `POST /api/clients/:clientId/redirect-uris` — adds a redirect URI to a client.
 * @returns A JSON `Response` with the new URI's id, or an error `Response`.
 */
export const create = createAction(
	routes.api.clients["redirect-uris"].create,
	inject([Database] as const, async (db) => {
		let { params, formData, log } = getContext();
		let { clientId } = s.parse(s.object({ clientId: s.string() }), params);
		log.set({ client: { id: clientId } });

		let client = await Client.show(db, clientId);
		if (!client) {
			log.warn("client.not_found");
			return notFound({ error: "Client not found" });
		}

		let result = await validate(Object.fromEntries(formData), CreateRedirectUriSchema);
		if (isFailure(result)) {
			log.warn("http.invalid_body");
			return badRequest({ error: "Invalid request", issues: result.error.issues });
		}

		let { id } = await RedirectUri.create(db, clientId, result.data.uri, result.data.environment);

		log.note("admin.client.redirect_uri.created", {
			redirect_uri_id: id,
		});
		return created({ id });
	}),
);

/**
 * `DELETE /api/clients/:clientId/redirect-uris/:id` — removes a redirect URI.
 * @returns A `204 No Content` `Response`, or `notFound`.
 */
export const destroy = createAction(
	routes.api.clients["redirect-uris"].destroy,
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
			await RedirectUri.destroy(db, id);
			log.note("admin.client.redirect_uri.deleted", {
				redirect_uri_id: id,
			});
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				log.warn("admin.client.redirect_uri.not_found", {
					redirect_uri_id: id,
				});
				return notFound({ error: "Redirect URI not found" });
			}
			throw error;
		}
	}),
);
