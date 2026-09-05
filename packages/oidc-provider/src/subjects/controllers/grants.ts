/**
 * Management API controller for a subject's consent grants
 * (`/api/subjects/:id/grants`).
 *
 * Lists the clients a subject has authorized (enriched with client info) and lets
 * an operator revoke an individual grant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { noContent } from "@sdxc/http/response";
import { notFound, ok } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client.js";
import Grant from "../../oauth/models/grant.js";
import routes from "../../routes.js";
import { RecordNotFoundError } from "../../shared/lib/db-errors.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Subject from "../models/subject.js";

/**
 * `GET /api/subjects/:id/grants` — lists a subject's grants with client info.
 * Client lookups run in a single batched query to avoid N+1 requests.
 * @returns A JSON `Response` with the grants, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.grants.index,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		log.set({ subject: { id } });

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.warn("subject.not_found");
			return notFound({ error: "Subject not found" });
		}

		let grants = await Grant.listBySubject(db, id);

		let clientIds = [...new Set(grants.map((g) => g.client_id))];
		let clients = await Client.listByIds(db, clientIds);
		let clientMap = new Map(clients.map((c) => [c.id, c]));

		let enrichedGrants = grants.map((grant) => {
			let client = clientMap.get(grant.client_id);
			return {
				id: grant.id,
				client: client ? { id: client.id, name: client.name } : null,
				scopes: grant.scopes ? grant.scopes.split(" ") : [],
				createdAt: toIsoString(grant.created_at),
				updatedAt: toIsoString(grant.updated_at),
			};
		});

		log.note("admin.subject.grant.listed", { count: grants.length });

		return ok(enrichedGrants);
	}),
);

/**
 * `DELETE /api/subjects/:id/grants/:grantId` — revokes one of a subject's grants.
 * @returns A `204 No Content` `Response`, or `notFound` if the subject or grant is missing.
 */
export const destroy = createAction(
	routes.api.subjects.grants.destroy,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { id, grantId } = s.parse(s.object({ id: s.string(), grantId: s.string() }), params);
		log.set({ subject: { id } });

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.warn("subject.not_found");
			return notFound({ error: "Subject not found" });
		}

		let grant = await Grant.show(db, grantId);
		if (!grant) {
			log.warn("admin.subject.grant.not_found", { grant_id: grantId });
			return notFound({ error: "Grant not found" });
		}

		if (grant.subject_id !== id) {
			log.warn("admin.subject.grant.subject_mismatch", {
				grant_id: grantId,
			});
			return notFound({ error: "Grant not found" });
		}

		try {
			await Grant.destroy(db, grantId);
			log.note("admin.subject.grant.revoked", {
				grant_id: grantId,
				client_id: grant.client_id,
			});
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Grant not found" });
			}
			throw error;
		}
	}),
);
