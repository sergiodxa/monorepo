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

import { noContent } from "@sdxc/http/response";
import { notFound, ok } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client.js";
import Session from "../../oauth/models/session.js";
import routes from "../../routes.js";
import { RecordNotFoundError } from "../../shared/lib/db-errors.js";
import { toIsoString } from "../../shared/lib/timestamp.js";
import Subject from "../models/subject.js";

/**
 * `GET /api/subjects/:id/sessions` — lists a subject's sessions with client info.
 * Client lookups run in a single batched query to avoid N+1 requests.
 * @returns A JSON `Response` with the sessions, or `notFound` if the subject is missing.
 */
export const index = createAction(
	routes.api.subjects.sessions.index,
	inject([Database] as const, async (db) => {
		let { params, log } = getContext();
		let { id } = s.parse(s.object({ id: s.string() }), params);
		log.set({ subject: { id } });

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.warn("subject.not_found");
			return notFound({ error: "Subject not found" });
		}

		let sessions = await Session.listBySubject(db, id);

		let clientIds = [...new Set(sessions.map((session) => session.client_id))];
		let clients = await Client.listByIds(db, clientIds);
		let clientMap = new Map(clients.map((c) => [c.id, c]));

		log.note("admin.subject.session.listed", { count: sessions.length });

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
		let { params, log } = getContext();
		let { id, sessionId } = s.parse(s.object({ id: s.string(), sessionId: s.string() }), params);
		log.set({ subject: { id } });

		let subject = await Subject.show(db, id);
		if (!subject) {
			log.warn("subject.not_found");
			return notFound({ error: "Subject not found" });
		}

		let session = await Session.show(db, sessionId);
		if (!session) {
			log.warn("admin.subject.session.not_found", { session_id: sessionId });
			return notFound({ error: "Session not found" });
		}

		if (session.subject_id !== id) {
			log.warn("admin.subject.session.subject_mismatch", {
				session_id: sessionId,
			});
			return notFound({ error: "Session not found" });
		}

		try {
			await Session.destroy(db, sessionId);
			log.note("admin.subject.session.destroyed", { session_id: sessionId });
			return noContent();
		} catch (error) {
			if (error instanceof RecordNotFoundError) {
				return notFound({ error: "Session not found" });
			}
			throw error;
		}
	}),
);
