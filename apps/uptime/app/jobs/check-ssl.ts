/**
 * Daily background job that re-evaluates SSL certificate status for every HTTP monitor with SSL
 * monitoring enabled, refreshing each expiry read from Certificate Transparency logs first, so
 * a renewed certificate moves the badge and alerts without anyone typing a new date.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobHandler } from "@sdxc/jobs";

import type { NotifyMessage } from "~/app/services/notify-queue";

import jobs from "~/app/jobs";
import { certificateTransparency } from "~/app/services/certificate-transparency";
import { mapWithConcurrency } from "~/app/services/concurrency";
import { apportionCostByTeam } from "~/app/services/cost";
import { enqueueNotifications } from "~/app/services/notify-queue";
import { checkSslMonitor } from "~/app/services/ssl-check";

export default createJobHandler(jobs.checkSsl, async (ctx) => {
	let monitors = await ctx.models.monitors.sslMonitored().all();
	apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

	let transparency = certificateTransparency();
	let notifications: NotifyMessage[] = [];
	let lookups = { found: 0, notFound: 0, unavailable: 0 };
	let successCount = 0;
	let errorCount = 0;

	let settled = await mapWithConcurrency(monitors, (monitor) =>
		checkSslMonitor(ctx.models, transparency, monitor),
	);

	for (let outcome of settled) {
		if (outcome.ok) {
			successCount++;
			let { lookup, notification } = outcome.value;
			if (notification !== null) notifications.push(notification);
			if (lookup?.status === "found") lookups.found++;
			if (lookup?.status === "not-found") lookups.notFound++;
			if (lookup?.status === "unavailable") {
				lookups.unavailable++;
				ctx.log.warn("checks.transparency_unavailable", {
					"monitor.id": outcome.item.id,
					reason: lookup.reason,
				});
			}
			continue;
		}

		errorCount++;
		ctx.log.warn("checks.monitor_failed", {
			"monitor.id": outcome.item.id,
			error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
		});
	}

	await enqueueNotifications(notifications);

	ctx.log.set({
		checks: {
			total: monitors.length,
			succeeded: successCount,
			failed: errorCount,
			notified: notifications.length,
		},
		transparency: lookups,
	});
});
