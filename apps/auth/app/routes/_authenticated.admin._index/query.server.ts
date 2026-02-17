import type { Database } from "~/db/index";

import Client from "~/models/client";
import Session from "~/models/session";
import Subject from "~/models/subject";

export async function getDashboardStats(db: Database) {
	let [clientsCount, subjectsCount, activeSessionsCount] = await Promise.all([
		Client.count(db),
		Subject.count(db),
		Session.countActive(db),
	]);

	return {
		clients: clientsCount,
		subjects: subjectsCount,
		activeSessions: activeSessionsCount,
	};
}
