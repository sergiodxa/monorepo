import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";

import action from "../../../lib/action";
import { RecordNotFoundError } from "../../../lib/db-errors";
import { toIsoString } from "../../../lib/timestamp";
import Client from "../../../models/client";
import Grant from "../../../models/grant";
import Subject from "../../../models/subject";

export const index = action<"GET", "/api/subjects/:id/grants">(async ({ db, params, logger }) => {
	let log = logger.loader("/api/subjects/:id/grants");

	let subject = await Subject.show(db, params.id);
	if (!subject) {
		log.info("Subject not found", { subjectId: params.id });
		return notFound({ error: "Subject not found" });
	}

	let grants = await Grant.listBySubject(db, params.id);

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

	log.info("Grants listed", { subjectId: params.id, count: grants.length });

	return ok(enrichedGrants);
});

export const destroy = action<"DELETE", "/api/subjects/:id/grants/:grantId">(
	async ({ db, params, logger }) => {
		let log = logger.action("/api/subjects/:id/grants/:grantId");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let grant = await Grant.show(db, params.grantId);
		if (!grant) {
			log.info("Grant not found", { subjectId: params.id, grantId: params.grantId });
			return notFound({ error: "Grant not found" });
		}

		if (grant.subject_id !== params.id) {
			log.info("Grant does not belong to subject", {
				subjectId: params.id,
				grantId: params.grantId,
			});
			return notFound({ error: "Grant not found" });
		}

		try {
			await Grant.destroy(db, params.grantId);
			log.info("Grant revoked", {
				subjectId: params.id,
				grantId: params.grantId,
				clientId: grant.client_id,
			});
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Grant not found" });
			}
			throw error;
		}
	},
);
