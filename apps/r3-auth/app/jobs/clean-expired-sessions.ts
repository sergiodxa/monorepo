/**
 * The daily session sweep: deletes every session row whose `expires_at` has passed.
 * A session id **is** a refresh token, so an expired row is spent credential material the
 * table keeps holding — this job bounds the table and reports itself to the cron monitor
 * watching that it still runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@pkg/jobs";

import Session from "~/app/data/session";
import jobs from "~/app/jobs";

/**
 * Reads the expired ids first so the log line reports what the sweep actually removed,
 * and logs the count alone: a session id stays a live refresh token until it expires.
 */
export default createJobHandler(jobs.cleanExpiredSessions, async (ctx) => {
	let expiredSessions = await Session.findExpiredSessions(ctx.database);

	if (expiredSessions.length === 0) {
		ctx.logger.info("job.clean_expired_sessions.no_expired");
		return;
	}

	let deletedCount = await Session.deleteExpiredSessions(ctx.database);

	ctx.logger.info("job.clean_expired_sessions.completed", { deletedCount });
});
