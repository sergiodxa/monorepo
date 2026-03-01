import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import Connection from "~/tenant/models/connection";
import Subject from "~/tenant/models/subject";

export const index = action<"GET", "/api/subjects/:id/connections">(
	async ({ db, params, logger }) => {
		let log = logger.loader("/api/subjects/:id/connections");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let connections = await Connection.listBySubject(db, params.id);

		log.info("Connections listed", { subjectId: params.id, count: connections.length });

		return ok(
			connections.map((connection) => ({
				id: connection.id,
				provider: connection.provider,
				providerUserId: connection.provider_user_id,
				createdAt: connection.created_at,
				updatedAt: connection.updated_at,
			})),
		);
	},
);

export const destroy = action<"DELETE", "/api/subjects/:id/connections/:connectionId">(
	async ({ db, params, logger }) => {
		let log = logger.action("/api/subjects/:id/connections/:connectionId");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let connections = await Connection.listBySubject(db, params.id);
		let connection = connections.find((c) => c.id === params.connectionId);

		if (!connection) {
			log.info("Connection not found", {
				subjectId: params.id,
				connectionId: params.connectionId,
			});
			return notFound({ error: "Connection not found" });
		}

		try {
			await Connection.destroy(db, params.connectionId);
			log.info("Connection deleted", {
				subjectId: params.id,
				connectionId: params.connectionId,
				provider: connection.provider,
			});
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Connection not found" });
			}
			throw error;
		}
	},
);
