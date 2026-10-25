/**
 * Daily retention job for cron-job ping history. Ping rows are kept for
 * `PING_RETENTION_DAYS` since the docs and monitor detail page depend on a year of
 * history, while `source_ip` and `user_agent` are redacted sooner because they only
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DAY_MS } from "@sdxc/dates/zone";
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { PING_RETENTION_DAYS } from "~/app/models/cron-job-pings";
import { apportionCost } from "~/app/services/cost";
import { deleteOlderThan, redactOlderThan } from "~/app/services/retention";

/**
 * How long a ping keeps the request details it was recorded with, before they are nulled
 * and only the timing is kept. Widening this only stops future redaction — it cannot
 * bring back details already cleared.
 */
const PING_DETAIL_RETENTION_DAYS = 30;

/** Columns cleared once a ping passes {@link PING_DETAIL_RETENTION_DAYS}. */
const PING_DETAIL_COLUMNS = ["source_ip", "user_agent"];

/**
 * Charges the apportioned per-team monitor count at run time, since cost is billed when
 * the sweep happens rather than accrued continuously.
 */
export default createJobHandler(jobs.cleanCronJobPings, async (ctx) => {
	let now = Date.now();

	apportionCost(await ctx.models.teams.countMonitorsByTeam());

	let deleted = await deleteOlderThan(
		ctx.db,
		"cron_job_pings",
		"created_at",
		now - PING_RETENTION_DAYS * DAY_MS,
	);

	let redacted = await redactOlderThan(
		ctx.db,
		"cron_job_pings",
		"created_at",
		PING_DETAIL_COLUMNS,
		now - PING_DETAIL_RETENTION_DAYS * DAY_MS,
	);

	ctx.log.set({
		pings: {
			deleted: deleted.rowsAffected,
			redacted: redacted.rowsAffected,
			batches: deleted.batches + redacted.batches,
			reached_ceiling: deleted.reachedCeiling || redacted.reachedCeiling,
		},
	});
});
