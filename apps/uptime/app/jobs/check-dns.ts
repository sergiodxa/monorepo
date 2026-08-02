/**
 * Background job that claims the DNS monitors whose configured `interval_seconds` has come
 * round and checks those, rather than sweeping every enabled monitor on a cadence of its own
 * (ADR-006). Resolves each domain, classifies the result, records it via
 * `DnsMonitor.recordCheckResult`, and enqueues a `notify` message for a changed/error result
 * or a recovery back to ok.
 *
 * Delivered every minute, which is the finest interval a monitor can be configured with.
 * Running that often is cheaper than the old hourly full sweep, not more expensive: the claim
 * is an indexed range that matches nothing in most minutes, and it is also what stops the
 * several deliveries a single minute's cron produces from checking the same monitor more
 * than once.
 *
 * Monitors are resolved in bounded-concurrency batches rather than one at a time, and
 * alerts are dispatched by the `notify` consumer rather than inline, so the sweep's wall
 * time is no longer the sum of every lookup plus every email send it triggers (ADR-008).
 *
 * Every check the sweep completes is also a ping: it is metered against the team's
 * allowance and written to Analytics Engine, both after the fact and both for the checks
 * that finished. A lookup that threw left no result row, so it bills nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { ClaimedDnsMonitor } from "~/app/data/dns-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckStatus, DnsRecordType } from "~/app/services/dns-check";
import type { BillablePing } from "~/app/services/ping-meter";

import DnsMonitor from "~/app/data/dns-monitor";
import Team from "~/app/data/team";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyDnsResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { checkDns } from "~/app/services/dns-check";
import { ingestPings } from "~/app/services/ping-meter";

/**
 * What one completed check produced, beyond the row it wrote: the alert its outcome
 * warrants, if any, and the id of the result row that alert-independent billing keys on.
 *
 * The two travel together because they have the same precondition — a check that ran to
 * completion — and separating them would mean either running the sweep's fan-out twice or
 * matching results back to monitors by index.
 */
interface CheckedMonitor {
	notification: NotifyMessage | null;
	resultId: string;
}

export class CheckDnsJob extends Job {
	/** The "Check DNS Records" cron monitor this sweep reports itself to when it completes. */
	static override monitorId = "3a620acd-43f9-4f48-9a32-b9a87698e44e";

	async perform(): Promise<void> {
		let db = getServiceContainer().get(Database);
		let polar = getServiceContainer().get(PolarClient);
		/**
		 * Claimed as of now rather than as of the cron's `scheduledTime`: the claim advances
		 * each monitor from its own previous due time, so what this instant decides is only
		 * which monitors are owed a check, and the queue hop between the trigger and here is
		 * seconds. Nothing downstream keys off it, unlike the HTTP sweep's per-minute job id.
		 */
		let monitors = await DnsMonitor.claimDue(db, Date.now());
		/**
		 * The sweep's fixed cost — the claim, the invocation, its share of the batch — is
		 * split across the teams whose monitors it took, in proportion to how many it took
		 * from each (ADR-007 §5). A delivery that claimed nothing is platform cost.
		 */
		apportionCostByTeam(monitors.map((monitor) => monitor.team_id));

		/**
		 * One query for the whole sweep, run before the checks so nothing waits on it
		 * afterwards: a ping is billed to the team's owner, who is the Polar customer, and
		 * looking that up per monitor would put a D1 read on every check in the batch.
		 */
		let ownerIds = await Team.ownerIdsByTeamIds(
			db,
			monitors.map((monitor) => monitor.team_id),
		);

		let notifications: NotifyMessage[] = [];
		let pings: BillablePing[] = [];
		let successCount = 0;
		let errorCount = 0;

		let settled = await mapWithConcurrency(monitors, (monitor) => this.check(db, monitor));

		for (let outcome of settled) {
			if (outcome.ok) {
				successCount++;
				if (outcome.value.notification !== null) notifications.push(outcome.value.notification);

				let ownerId = ownerIds.get(outcome.item.team_id);
				/**
				 * A monitor whose team names no owner cannot be billed — there is no Polar
				 * customer to ingest against — but its check already ran and is recorded, so
				 * this drops the event and says so rather than failing the sweep.
				 */
				if (ownerId === undefined) {
					this.logger.error("job.check_dns.unbillable_team", {
						monitorId: outcome.item.id,
						teamId: outcome.item.team_id,
					});
					continue;
				}

				pings.push({
					externalId: `ping:${outcome.value.resultId}`,
					ownerId,
					teamId: outcome.item.team_id,
					monitorId: outcome.item.id,
					type: "dns",
				});
				continue;
			}

			errorCount++;
			this.logger.error("job.check_dns.monitor_failed", {
				monitorId: outcome.item.id,
				error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
			});
		}

		await enqueueNotifications(notifications);
		/** Every ping in one call, so a sweep of eighty monitors costs one subrequest. */
		await ingestPings(polar, pings);

		this.logger.info("job.check_dns.completed", {
			total: monitors.length,
			successCount,
			errorCount,
			notified: notifications.length,
			ingested: pings.length,
		});
	}

	/**
	 * Resolves one monitor and records its result, returning what the sweep needs from a
	 * completed check: the notification its outcome warrants (`null` when it isn't
	 * alert-worthy) and the result row's id. The previous status is read before the write,
	 * since that's what makes a recovery detectable.
	 *
	 * Throwing here is what marks a monitor as failed, so everything this returns describes
	 * a check that finished — which is why the caller can bill for it unconditionally.
	 */
	private async check(db: Database, monitor: ClaimedDnsMonitor): Promise<CheckedMonitor> {
		/** Both columns are declared as plain text enums, so their value sets are asserted here. */
		let previousStatus = monitor.last_status as DnsCheckStatus | null;
		let result = await checkDns(
			monitor.domain,
			monitor.record_type as DnsRecordType,
			monitor.expected_value,
			monitor.last_value,
		);

		let resultId = await DnsMonitor.recordCheckResult(db, monitor.id, result);

		/**
		 * DNS's own `ok`/`changed`/`error` vocabulary goes into the dataset as-is: nothing
		 * reads a status without filtering to one ping type first, and remapping these onto
		 * HTTP's up/degraded/down would record an outcome no lookup observed.
		 */
		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "dns",
			status: result.status,
			responseTimeMs: result.responseTimeMs,
		});

		if (!shouldNotifyDnsResult(previousStatus, result.status)) {
			return { notification: null, resultId };
		}

		return {
			notification: {
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus,
				newStatus: result.status,
			},
			resultId,
		};
	}
}
