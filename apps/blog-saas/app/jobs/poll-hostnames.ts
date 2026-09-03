/**
 * The hostname-polling job: refreshes the validation/SSL status of pending custom
 * hostnames from Cloudflare and activates the custom domain once a hostname goes live,
 * so custom-domain onboarding is hands-off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { HostnameClient } from "@sdxc/hostname";
import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import Hostname from "~/app/models/hostname";

/**
 * Refreshes pending custom-hostname validation and flips a blog to its custom domain
 * once the hostname and SSL both report active. A per-hostname error is recorded and
 * skipped, so a transient Cloudflare failure is retried by the next poll rather than
 * stopping the hostnames behind it.
 */
export default createJobHandler(jobs.pollHostnames, async (ctx) => {
	let pending = await Hostname.findIncomplete(ctx.database);

	for (let hostname of pending) {
		if (ctx.signal.aborted) ctx.ack("The next poll refreshes the hostnames left.");

		try {
			let status = await ctx.hostnames.status(hostname.id);
			await Hostname.setStatus(ctx.database, hostname.id, status.status, status.sslStatus);
			if (HostnameClient.isActive(status)) {
				await ctx.provisioner.activateCustomHostname(hostname.blog_id, hostname.hostname);
			}
		} catch (error) {
			ctx.logger.error("hostname.poll_failed", {
				hostname: hostname.hostname,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	ctx.logger.info("hostnames.polled", { count: pending.length });
});
