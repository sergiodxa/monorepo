/**
 * The daily session sweep: deletes every session row whose `expires_at` has passed.
 * A session id **is** a refresh token, so an expired row is spent credential material the
 * table keeps holding — this job bounds the table and reports itself to the cron monitor
 * watching that it still runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import Session from "~/app/data/session";
import jobs from "~/app/jobs";

/**
 * Reads the expired ids first so the run's record reports what the sweep actually
 * removed, and records the counts alone: a session id stays a live refresh token until
 * it expires.
 */
export default createJobHandler(jobs.cleanExpiredSessions, async (ctx) => {
	let expiredSessions = await Session.findExpiredSessions(ctx.database);
	ctx.log.set({ sessions: { expired: expiredSessions.length } });

	if (expiredSessions.length === 0) return;

	let deletedCount = await Session.deleteExpiredSessions(ctx.database);
	ctx.log.set({ sessions: { deleted: deletedCount } });
});
