/**
 * The daily session sweep: deletes every session row whose `expires_at` has passed.
 * A session id **is** a refresh token, so an expired row is spent credential material the
 * table keeps holding — this job bounds the table and reports itself to the cron monitor
 * watching that it still runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import Session from "~/app/data/session";

/** Deletes expired sessions, logging how many rows the sweep removed. */
export class CleanExpiredSessionsJob extends Job {
	/**
	 * The cron monitor this sweep pings when it completes. Frozen: the monitor exists
	 * under this id and alerts on a missed run, so this exact value is what keeps the
	 * alert pointed at this job.
	 */
	static override monitorId = "74f508a2-e6e9-4f01-8c25-2884330e7870";

	/**
	 * Reads the expired ids first so the log line reports what the sweep actually removed,
	 * and logs the count alone: a session id stays a live refresh token until it expires.
	 */
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);

		let expiredSessions = await Session.findExpiredSessions(db);

		if (expiredSessions.length === 0) {
			return this.logger.info("job.clean_expired_sessions.no_expired");
		}

		let deletedCount = await Session.deleteExpiredSessions(db);

		this.logger.info("job.clean_expired_sessions.completed", { deletedCount });
	}
}
