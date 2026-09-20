/**
 * The daily sweep ADR-005 calls for: walks every domain still pending verification or
 * certificate issuance and refreshes its status against Cloudflare, promoting one that
 * has gone active and failing one that has sat pending past its seven-day window.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import Domain from "~/app/models/domain";
import { refreshDomainStatus } from "~/app/services/domain";

export default createJobHandler(jobs.refreshPendingDomains, async (ctx) => {
	let pending = await Domain.listPending(ctx.database);
	ctx.log.set({ domains: { pending: pending.length } });

	for (let domain of pending) {
		if (ctx.signal.aborted) ctx.ack("The next sweep refreshes the domains left.");

		try {
			await refreshDomainStatus(ctx.database, ctx.hostnames, domain);
			ctx.log.inc("domains.refreshed");
		} catch (error) {
			ctx.log.inc("domains.failed");
			ctx.log.warn("domain.refresh_failed", {
				hostname: domain.hostname,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}
});
