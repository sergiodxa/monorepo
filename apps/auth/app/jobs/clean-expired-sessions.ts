/**
 * Clean-expired-sessions job for the auth app. A scheduled job that finds and
 * deletes sessions past their expiry, logging the outcome (and a no-op when
 * none exist), so stale refresh-token sessions are purged from the database on
 * a recurring cron/queue trigger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { env } from "cloudflare:workers";

import database from "~/db/index";
import Session from "~/models/session";

export class CleanExpiredSessionsJob extends Job {
	static override monitorId = "74f508a2-e6e9-4f01-8c25-2884330e7870";

	async perform(): Promise<void> {
		let db = database(env.DB);

		let expiredSessions = await Session.findExpiredSessions(db);

		if (expiredSessions.length === 0) {
			return this.logger.info("job.clean_expired_sessions.no_expired");
		}

		await Session.deleteExpiredSessions(db);

		this.logger.info("job.clean_expired_sessions.completed", {
			deletedCount: expiredSessions.length,
		});
	}
}
