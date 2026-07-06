/**
 * Server-only query helper for the admin dashboard. Exposes getDashboardStats, which
 * runs the client, subject and active-session counts in parallel against the database
 * and returns them as a single stats object. Exists to keep the dashboard route's data
 * fetching in one reusable, testable place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
