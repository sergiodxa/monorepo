import type { RequestContext } from "remix/fetch-router";

import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { toIsoString } from "../../shared/lib/timestamp";
import Connection from "../models/connection";
import Subject from "../models/subject";

export const index = createAction(
	routes.api.subjects.connections.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
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
				createdAt: toIsoString(connection.created_at),
				updatedAt: toIsoString(connection.updated_at),
			})),
		);
	}),
);

export const destroy = createAction(
	routes.api.subjects.connections.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string; connectionId: string }>;
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
	}),
);
