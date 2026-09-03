/**
 * The Monday 09:00 UTC run: the same digest over the seven days that just ended. Its own
 * job, and not a field on a shared one, so it reports to its own cron-job monitor — a
 * monitor watches one schedule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { sendTeamDigests } from "~/app/jobs/send-team-digests";

export default createJobHandler(jobs.sendTeamWeeklyDigests, async (ctx) => {
	await sendTeamDigests(ctx, "weekly");
});
