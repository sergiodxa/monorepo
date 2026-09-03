/**
 * The 08:00 UTC run: yesterday's monitor digest, for every team. Its own job, and not a
 * field on a shared one, so it reports to its own cron-job monitor — a monitor watches
 * one schedule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { sendTeamDigests } from "~/app/jobs/send-team-digests";

export default createJobHandler(jobs.sendTeamDailyDigests, async (ctx) => {
	await sendTeamDigests(ctx, "daily");
});
