/**
 * Every-minute sweep that claims the HTTP monitors whose next due time has come round and
 * fans one `checkHttp` message out per monitor. Claiming advances each monitor's next due
 * time in the same statement, so a second delivery within the same minute enqueues nothing
 * more, and billing is already decided by `next_due_at` (ADR-005).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@pkg/jobs-next";

import Monitor from "~/app/data/monitor";
import jobs from "~/app/jobs";
import { enqueueMany } from "~/app/lib/queue";
import { apportionCostByTeam } from "~/app/services/cost";

export default createJobHandler(jobs.enqueueDueChecks, async (ctx) => {
	/**
	 * One instant for the claim and for every message it produces, so the ids below all
	 * name the same minute.
	 */
	let now = Date.now();
	let due = await Monitor.findDue(ctx.database, now);

	/**
	 * The claim, this delivery, and the messages below are split by due monitors per team
	 * (ADR-007 §5): a customer with one 1-minute monitor absorbing nearly the whole scan is
	 * the signal ADR-003 exists to surface.
	 */
	apportionCostByTeam(due.map((monitor) => monitor.team_id));

	await enqueueMany(
		jobs.checkHttp,
		due.map((monitor) => ({
			/**
			 * Keyed to the monitor and the minute, so every delivery within that minute
			 * collides onto the same id — see `Monitor.scheduledJobId` for why this sweep can
			 * run more than once a minute.
			 */
			id: Monitor.scheduledJobId(monitor.id, now),
			monitorId: monitor.id,
			scheduledAt: now,
		})),
	);

	ctx.logger.info("job.enqueue_due_checks.enqueued", { count: due.length });
});
