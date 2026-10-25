/**
 * Every-minute sweep that claims the HTTP monitors whose next due time has come round and
 * fans one `checkHttp` message out per monitor.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import { enqueueMany } from "~/app/initializers/queue";
import jobs from "~/app/jobs";
import { scheduledJobId } from "~/app/models/monitors";
import { apportionCostByTeam } from "~/app/services/cost";

export default createJobHandler(jobs.enqueueDueChecks, async (ctx) => {
	/**
	 * One instant for the claim and for every message it produces, so the ids below all
	 * name the same minute.
	 */
	let now = Date.now();
	let due = await ctx.models.monitors.findDue(now);

	/**
	 * The claim, this delivery, and the messages below are split by due monitors per team:
	 * a customer with one 1-minute monitor absorbing nearly the whole scan is the
	 * cost signal this split exists to surface.
	 */
	apportionCostByTeam(due.map((monitor) => monitor.team_id));

	await enqueueMany(
		jobs.checkHttp,
		due.map((monitor) => ({
			/**
			 * Keyed to the monitor and the minute, so every delivery within that minute
			 * collides onto the same id — see `scheduledJobId` for why this sweep can
			 * run more than once a minute.
			 */
			id: scheduledJobId(monitor.id, now),
			monitorId: monitor.id,
			scheduledAt: now,
		})),
	);

	ctx.log.set({ checks: { enqueued: due.length } });
});
