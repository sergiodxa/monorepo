/**
 * Daily background job that re-evaluates SSL certificate status for every HTTP
 * monitor with SSL monitoring enabled. There is no TLS handshake here — Workers can't
 * read certificate details from `fetch()` — it just re-runs `calculateSslStatus`
 * against the manually entered expiry date, so status transitions (and repeated
 * expiry-warning alerts) fire on schedule without the user revisiting the settings
 * form. See `app/services/ssl-info.ts` and `docs/ssl-monitoring.md`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import Monitor from "~/app/data/monitor";
import { notifySslResult } from "~/app/services/alerts";
import { calculateSslStatus } from "~/app/services/ssl-info";

export class CheckSslJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let resend = getServiceContainer().get(Resend);
		let monitors = await Monitor.listSslEnabled(db);

		let successCount = 0;
		let errorCount = 0;

		for (let monitor of monitors) {
			try {
				let { status, daysUntilExpiry } = calculateSslStatus(
					monitor.ssl_expires_at,
					monitor.ssl_expiry_warning_days,
				);

				await Monitor.updateById(db, monitor.id, {
					ssl_status: status,
					ssl_last_checked_at: Date.now(),
				});

				await notifySslResult(db, resend, monitor, status, daysUntilExpiry);
				successCount++;
			} catch (error) {
				errorCount++;
				this.logger.error("job.check_ssl.monitor_failed", {
					monitorId: monitor.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.logger.info("job.check_ssl.completed", {
			total: monitors.length,
			successCount,
			errorCount,
		});
	}
}
