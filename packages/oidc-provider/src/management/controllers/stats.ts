import { ok } from "@pkg/http/response/json";

import Client from "../../clients/models/client";
import Session from "../../oauth/models/session";
import action from "../../shared/lib/action";
import Subject from "../../subjects/models/subject";

export const show = action<"GET", "/api/stats">(async ({ db, logger }) => {
	let log = logger.loader("/api/stats");

	// Fetch all counts in parallel for better performance
	let [totalUsers, totalClients, totalSessions, activeSessions, monthlyActiveUsers] =
		await Promise.all([
			Subject.count(db),
			Client.count(db),
			Session.count(db),
			Session.countActive(db),
			Session.countMonthlyActiveUsers(db),
		]);

	let stats = {
		total_users: totalUsers,
		total_clients: totalClients,
		total_sessions: totalSessions,
		active_sessions: activeSessions,
		monthly_active_users: monthlyActiveUsers,
	};

	log.info("Stats retrieved", stats);

	return ok(stats);
});
