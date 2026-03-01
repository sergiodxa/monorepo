import { ok } from "@pkg/http/response/json";

import action from "~/lib/action";
import Client from "~/tenant/models/client";
import Session from "~/tenant/models/session";
import Subject from "~/tenant/models/subject";

export const show = action<"GET", "/api/stats">(async ({ db, logger }) => {
	let log = logger.loader("/api/stats");

	let [subjects, clients, sessions] = await Promise.all([
		Subject.list(db),
		Client.list(db),
		Session.list(db),
	]);

	let now = new Date();
	let thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

	let activeSessions = sessions.filter((s) => new Date(s.expiresAt) > now);
	let activeSubjectIds = new Set(
		activeSessions.filter((s) => new Date(s.updatedAt) > thirtyDaysAgo).map((s) => s.subjectId),
	);

	let stats = {
		total_users: subjects.length,
		total_clients: clients.length,
		total_sessions: sessions.length,
		active_sessions: activeSessions.length,
		monthly_active_users: activeSubjectIds.size,
	};

	log.info("Stats retrieved", stats);

	return ok(stats);
});
