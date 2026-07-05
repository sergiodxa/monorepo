/**
 * Management API controller for a subject's sessions
 * (`/api/subjects/:id/sessions`).
 *
 * Lists a subject's active sessions (enriched with client info) and lets an
 * operator revoke an individual session.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Client from "../../clients/models/client";
import Session from "../../oauth/models/session";
import routes from "../../routes";
import { RecordNotFoundError } from "../../shared/lib/db-errors";
import { toIsoString } from "../../shared/lib/timestamp";
import Subject from "../models/subject";

/**
 * `GET /api/subjects/:id/sessions` — lists a subject's sessions with client info.
 * @returns A JSON `Response` with the sessions, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.sessions.index,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string }>;
		let log = logger.loader("/api/subjects/:id/sessions");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let sessions = await Session.listBySubject(db, params.id);

		// Fetch all unique client IDs to avoid N+1
		let clientIds = [...new Set(sessions.map((s) => s.client_id))];
		let clients = await Client.listByIds(db, clientIds);
		let clientMap = new Map(clients.map((c) => [c.id, c]));

		log.info("Sessions listed", { subjectId: params.id, count: sessions.length });

		return ok(
			sessions.map((session) => {
				let client = clientMap.get(session.client_id);
				return {
					id: session.id,
					client: client ? { id: client.id, name: client.name } : null,
					ip: session.ip,
					userAgent: session.user_agent,
					expiresAt: toIsoString(session.expires_at),
					createdAt: toIsoString(session.created_at),
					updatedAt: toIsoString(session.updated_at),
				};
			}),
		);
	}),
);

/**
 * `DELETE /api/subjects/:id/sessions/:sessionId` — revokes one of a subject's sessions.
 * @returns A `204 No Content` `Response`, or `notFound` if the subject or session is missing.
 */
export const destroy = createAction(
	routes.api.subjects.sessions.destroy,
	inject([Database] as const, async (db) => {
		let { params, logger } = getContext() as RequestContext<{ id: string; sessionId: string }>;
		let log = logger.action("/api/subjects/:id/sessions/:sessionId");

		let subject = await Subject.show(db, params.id);
		if (!subject) {
			log.info("Subject not found", { subjectId: params.id });
			return notFound({ error: "Subject not found" });
		}

		let session = await Session.show(db, params.sessionId);
		if (!session) {
			log.info("Session not found", { subjectId: params.id, sessionId: params.sessionId });
			return notFound({ error: "Session not found" });
		}

		if (session.subject_id !== params.id) {
			log.info("Session does not belong to subject", {
				subjectId: params.id,
				sessionId: params.sessionId,
			});
			return notFound({ error: "Session not found" });
		}

		try {
			await Session.destroy(db, params.sessionId);
			log.info("Session destroyed", { subjectId: params.id, sessionId: params.sessionId });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Session not found" });
			}
			throw error;
		}
	}),
);
