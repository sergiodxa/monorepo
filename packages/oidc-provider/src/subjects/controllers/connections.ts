/**
 * Management API controller for a subject's external connections
 * (`/api/subjects/:id/connections`).
 *
 * Lists a subject's linked identity-provider accounts and lets an operator unlink
 * an individual connection.
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

import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { toIsoString } from "../../shared/lib/timestamp";
import Connection from "../models/connection";
import Subject from "../models/subject";

/**
 * `GET /api/subjects/:id/connections` — lists a subject's external connections.
 * @returns A JSON `Response` with the connections, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.connections.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		let log = logger.loader("/api/subjects/:id/connections");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let connections = await Connection.listBySubject(db, id);

		log.info("Connections listed", { subjectId: id, count: connections.length });

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

/**
 * `DELETE /api/subjects/:id/connections/:connectionId` — unlinks one of a subject's connections.
 * @returns A `204 No Content` `Response`, or `notFound` if the subject or connection is missing.
 */
export const destroy = createAction(
	routes.api.subjects.connections.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext();
		let { id, connectionId } = s.parse(
			s.object({ id: s.string(), connectionId: s.string() }),
			params,
		);
		let log = logger.action("/api/subjects/:id/connections/:connectionId");

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.info("Subject not found", { subjectId: id });
			return notFound({ error: "Subject not found" });
		}

		let connections = await Connection.listBySubject(db, id);
		let connection = connections.find((c) => c.id === connectionId);

		if (!connection) {
			log.info("Connection not found", {
				subjectId: id,
				connectionId,
			});
			return notFound({ error: "Connection not found" });
		}

		try {
			await Connection.destroy(db, connectionId);
			log.info("Connection deleted", {
				subjectId: id,
				connectionId,
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
