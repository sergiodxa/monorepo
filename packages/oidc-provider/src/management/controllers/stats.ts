/**
 * Management API statistics endpoint controller.
 *
 * Aggregates tenant usage counts (users, clients, sessions, active sessions, and
 * monthly active users) for the control-plane dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ok } from "@sdxc/http/response/json";
import { inject } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import Client from "../../clients/models/client";
import Session from "../../oauth/models/session";
import routes from "../../routes";
import Subject from "../../subjects/models/subject";

/**
 * `GET /api/stats` action returning aggregate tenant usage counts as JSON.
 * @returns A JSON `Response` with user, client, and session statistics.
 */
export const show = createAction(
	routes.api.stats,
	inject([Database] as const, async (db) => {
		let { logger } = getContext();
		let log = logger.loader("/api/stats");

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
	}),
);
