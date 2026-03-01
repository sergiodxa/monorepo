import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Client from "~/tenant/models/client";
import Grant from "~/tenant/models/grant";
import Subject from "~/tenant/models/subject";

export const index = action<"GET", "/api/subjects/:id/grants">(async ({ db, params, logger }) => {
	let log = logger.loader("/api/subjects/:id/grants");

	let subject = await Subject.show(db, params.id);
	if (!subject) {
		log.info("Subject not found", { subjectId: params.id });
		return notFound({ error: "Subject not found" });
	}

	let grants = await Grant.listBySubject(db, params.id);

	let enrichedGrants = await Promise.all(
		grants.map(async (grant) => {
			let client = await Client.show(db, grant.client_id);
			return {
				id: grant.id,
				client: client ? { id: client.id, name: client.name } : null,
				scopes: grant.scopes ? grant.scopes.split(" ") : [],
				createdAt: grant.created_at,
				updatedAt: grant.updated_at,
			};
		}),
	);

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
