/**
 * Reads one monitor's certificate expiry from Certificate Transparency logs right after its
 * SSL settings switch to the logs. Alerts stay on the daily check's reminder schedule, so
 * this job persists the certificate and status and enqueues nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import jobs from "~/app/jobs";
import { certificateTransparency } from "~/app/services/certificate-transparency";
import { checkSslMonitor } from "~/app/services/ssl-check";

export default createJobHandler(jobs.checkCertificate, async (ctx) => {
	let monitor = await ctx.models.monitors.find(ctx.input.monitorId);
	if (!monitor || !monitor.ssl_monitoring_enabled || monitor.ssl_expiry_source !== "transparency") {
		ctx.log.set({ transparency: { skipped: true } });
		return;
	}

	let { lookup } = await checkSslMonitor(ctx.models, certificateTransparency(), monitor);
	ctx.log.set({ transparency: { status: lookup?.status ?? null } });
});
