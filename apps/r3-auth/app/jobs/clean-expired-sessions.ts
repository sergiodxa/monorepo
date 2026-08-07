/**
 * The daily session sweep: deletes every session row whose `expires_at` has passed.
 * A session id **is** a refresh token, so a row that outlives its expiry is a token
 * nobody can use but that still sits in the database — this job is what keeps the table
 * bounded and reports itself to the cron monitor watching that it still runs.
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
	 * The cron monitor this sweep pings when it completes.
	 *
	 * Frozen: the monitor already exists under this id and alerts when a run is missed,
	 * so changing it would silence the alert instead of moving it.
	 */
	static override monitorId = "74f508a2-e6e9-4f01-8c25-2884330e7870";

	/**
	 * Counts the expired rows, then deletes them in one statement.
	 *
	 * The count is read first because it is the only number worth logging, and it is
	 * read as ids rather than as a `COUNT` so the log line reports what was actually
	 * removed. Nothing about a session is logged — a row's id is a live refresh token
	 * until the moment it expires.
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
