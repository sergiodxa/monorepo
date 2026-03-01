import { noContent } from "@pkg/http/response";
import { notFound, ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import { RecordNotFoundError } from "~/lib/db-errors";
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

	log.info("Sessions listed", { subjectId: params.id, count: sessions.length });

	return ok(
		sessions.map((session) => ({
			id: session.id,
			clientId: session.client_id,
			ip: session.ip,
			userAgent: session.user_agent,
			expiresAt: session.expires_at,
			createdAt: session.created_at,
			updatedAt: session.updated_at,
		})),
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
