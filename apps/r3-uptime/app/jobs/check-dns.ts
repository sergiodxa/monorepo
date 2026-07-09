/**
 * Background job that sweeps every enabled DNS monitor once per run (the OLD APP's
 * hourly cadence — DNS monitors are not staggered by their individual
 * `interval_seconds`, unlike HTTP monitors). Resolves each domain, classifies the
 * result, records it via `DnsMonitor.recordCheckResult`, and dispatches alerts on a
 * changed/error result or a recovery back to ok.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { DnsCheckStatus, DnsRecordType } from "~/app/services/dns-check";

import DnsMonitor from "~/app/data/dns-monitor";
import { notifyDnsResult } from "~/app/services/alerts";
import { checkDns } from "~/app/services/dns-check";

export class CheckDnsJob extends Job {
	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let resend = getServiceContainer().get(Resend);
		let monitors = await DnsMonitor.listEnabled(db);

		let successCount = 0;
		let errorCount = 0;

		for (let monitor of monitors) {
			try {
				let result = await checkDns(
					monitor.domain,
					monitor.record_type as DnsRecordType,
					monitor.expected_value,
					monitor.last_value,
				);
				await DnsMonitor.recordCheckResult(db, monitor.id, result);
				await notifyDnsResult(
					db,
					resend,
					monitor,
					monitor.last_status as DnsCheckStatus | null,
					result,
				);
				successCount++;
			} catch (error) {
				errorCount++;
				this.logger.error("job.check_dns.monitor_failed", {
					monitorId: monitor.id,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		this.logger.info("job.check_dns.completed", {
			total: monitors.length,
			successCount,
			errorCount,
		});
	}
}
