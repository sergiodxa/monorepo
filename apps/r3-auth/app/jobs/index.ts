/**
 * Every background job this worker runs, declared in one map. The key each job is filed
 * under is the message `type` on the wire, so a key is as frozen as any HTTP payload:
 * bodies enqueued by one deploy are consumed by the next.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { job, jobs } from "@sdxc/jobs";

/** What a job a cron monitor watches declares, so every one of them spells it the same way. */
interface Monitored {
	monitorId: string;
}

export default jobs({
	/**
	 * The daily session sweep, at midnight UTC. The cron monitor exists under this id and
	 * alerts on a missed run, so this exact value is what keeps the alert pointed at this
	 * job.
	 */
	cleanExpiredSessions: job({
		cron: "0 0 * * *",
		meta: { monitorId: "74f508a2-e6e9-4f01-8c25-2884330e7870" } satisfies Monitored,
	}),
});
