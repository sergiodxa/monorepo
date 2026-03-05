import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
import { toIsoString } from "~/lib/timestamp";
import Client from "~/tenant/models/client";
import Session from "~/tenant/models/session";
import Subject from "~/tenant/models/subject";

export const index = action<"GET", "/api/subjects/:id/sessions">(async ({ db, params, logger }) => {
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
});

export const destroy = action<"DELETE", "/api/subjects/:id/sessions/:sessionId">(
	async ({ db, params, logger }) => {
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
	},
);
