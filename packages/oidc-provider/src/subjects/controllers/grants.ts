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

import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Client from "../../clients/models/client";
import Grant from "../../oauth/models/grant";
import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { toIsoString } from "../../shared/lib/timestamp";
import Subject from "../models/subject";

/**
 * `GET /api/subjects/:id/grants` — lists a subject's grants with client info.
 * @returns A JSON `Response` with the grants, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.grants.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/subjects/:id/grants");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let grants = await Grant.listBySubject(db, id);

		// Fetch all unique client IDs in a single query to avoid N+1
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

		log.info("Grants listed", { subjectId: id, count: grants.length });

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
		let { params, logger } = getContext();
		let { id, grantId } = s.parse(s.object({ id: s.string(), grantId: s.string() }), params);
		let log = logger.action("/api/subjects/:id/grants/:grantId");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let grant = await Grant.show(db, grantId);
		if (!grant) {
			log.info("Grant not found", { subjectId: id, grantId });
			return notFound({ error: "Grant not found" });
		}

		if (grant.subject_id !== id) {
			log.info("Grant does not belong to subject", {
				subjectId: id,
				grantId,
			});
			return notFound({ error: "Grant not found" });
		}

		try {
			await Grant.destroy(db, grantId);
			log.info("Grant revoked", {
				subjectId: id,
				grantId,
				clientId: grant.client_id,
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
