/**
 * Background job that claims the DNS monitors whose configured `interval_seconds` has come
 * round and sweeps those, rather than sweeping every enabled monitor on a cadence of its
 * own (ADR-006). Each claimed monitor resolves every supported record type at every name it
 * tracks, diffs the answers against the stored records, applies that diff, records one
 * result row via `DnsMonitor.recordCheckResult`, and enqueues a `notify` message for a
 * changed/error result or a recovery back to ok.
 *
 * Delivered every minute, which is the finest interval a monitor can be configured with.
 * Running that often is cheaper than a fixed full sweep, not more expensive: the claim is an
 * indexed range that matches nothing in most minutes, and it is also what stops the several
 * deliveries a single minute's cron produces from checking the same monitor more than once.
 *
 * The check of a single monitor is not implemented here: it is the shared pipeline in
 * `app/services/dns-discovery.ts` that every entry point runs, so an hourly check and one a
 * customer pressed the button for cannot drift apart. What this job adds is everything about
 * spending one invocation across many monitors.
 *
 * A domain monitor is itself a fan-out — a name costs `QUERIES_PER_NAME` outbound queries —
 * so this sweep is bounded twice over: names run in bounded-concurrency batches inside a
 * monitor, monitors run in bounded-concurrency batches inside the invocation, and both draw
 * from one hard query budget sized against the platform's per-invocation subrequest ceiling
 * (ADR-026 §9a). Work that does not fit is deferred to the next delivery or reported as a
 * partial sweep; it is never silently read as "these records are gone".
 *
 * Every check the sweep completes is one ping — one per monitor per check, not one per
 * query, because the resolver is free and we charge the way we are charged (ADR-026 §9). It
 * is metered against the team's allowance and written to Analytics Engine, both after the
 * fact and both for the checks that finished.
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
import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { DnsCheckPlan } from "~/app/services/dns-discovery";
import type { BillablePing } from "~/app/services/ping-meter";

import DnsMonitor from "~/app/data/dns-monitor";
import Team from "~/app/data/team";
import { mapWithConcurrency } from "~/app/lib/concurrency";
import { enqueueNotifications } from "~/app/lib/notify-queue";
import { shouldNotifyDnsResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { QUERIES_PER_NAME } from "~/app/services/dns-check";
import {
	INVOCATION_QUERY_BUDGET,
	planDnsCheck,
	recordDnsCheck,
} from "~/app/services/dns-discovery";
import { ingestPings } from "~/app/services/ping-meter";
import { dnsMonitors } from "~/database/schema";

/**
 * Monitors swept at once inside one invocation. Each one is itself a fan-out of names, and
 * the product of the two is what has to stay bounded: at most
 * `MONITOR_CONCURRENCY × NAME_CONCURRENCY × QUERIES_PER_NAME` queries are outstanding, with
 * the per-check half of that ceiling owned by the shared check pipeline.
 */
const MONITOR_CONCURRENCY = 2;

/**
 * What one completed check produced, beyond the row it wrote: the alert its outcome
 * warrants, if any, and the id of the result row that alert-independent billing keys on.
 *
 * The two travel together because they have the same precondition — a check that ran to
 * completion — and separating them would mean either running the sweep's fan-out twice or
 * matching results back to monitors by index.
 *
 * A monitor the invocation had no query budget left for is `deferred` instead: it was not
 * checked at all, so it writes no result row, reports no status and bills nothing.
 */
type CheckedMonitor =
	| { deferred: true }
	| { deferred: false; notification: NotifyMessage | null; resultId: string };

/**
 * The invocation's remaining query allowance, handed out in whole names because a name is
 * the smallest unit a sweep can be honest about: half a name swept is a name whose records
 * we have no complete answer for.
 */
interface QueryBudget {
	/** Grants at most `names` names' worth of queries, returning how many were granted. */
	takeNames(names: number): number;
}

/**
 * Creates the budget one delivery spends. Reservations are synchronous and happen before
 * any await, so concurrent monitors cannot both be granted the same last name.
 */
function createQueryBudget(queries: number): QueryBudget {
	let remaining = queries;

	return {
		takeNames(names: number): number {
			let granted = Math.min(names, Math.floor(remaining / QUERIES_PER_NAME));
			remaining -= granted * QUERIES_PER_NAME;
			return granted;
		},
	};
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

		let budget = createQueryBudget(INVOCATION_QUERY_BUDGET);
		let notifications: NotifyMessage[] = [];
		let pings: BillablePing[] = [];
		let successCount = 0;
		let errorCount = 0;
		let deferredCount = 0;

		let settled = await mapWithConcurrency(
			monitors,
			(monitor) => this.check(db, monitor, budget),
			MONITOR_CONCURRENCY,
		);

		for (let outcome of settled) {
			if (outcome.ok) {
				/** Nothing ran, so there is nothing to count, report or bill. */
				if (outcome.value.deferred) {
					deferredCount++;
					continue;
				}

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

				/**
				 * One ping per check, per monitor, keyed on the result row — never one per
				 * query (ADR-026 §9). The public resolver charges us nothing per query, so
				 * billing a sweep as N pings would charge for a cost we never incur; what a
				 * domain monitor sells is one monitored domain.
				 */
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
			deferredCount,
			notified: notifications.length,
			ingested: pings.length,
		});
	}

	/**
	 * Sweeps one monitor and records its result, returning what the sweep needs from a
	 * completed check: the notification its outcome warrants (`null` when it isn't
	 * alert-worthy) and the result row's id. The previous status is read before the write,
	 * since that's what makes a recovery detectable.
	 *
	 * The check itself is the shared pipeline every entry point runs, so a scheduled check
	 * and one a customer pressed the button for produce the same row for the same monitor.
	 * What is job-specific and stays here is everything about spending one invocation across
	 * many monitors: the budget, the deferral, and the reporting of a partial sweep.
	 *
	 * Throwing here is what marks a monitor as failed, so everything this returns describes
	 * a check that finished — which is why the caller can bill for it unconditionally. A
	 * query that failed is not such a case: the resolver reports failures as values, and
	 * they are counted rather than thrown.
	 */
	private async check(
		db: Database,
		monitor: ClaimedDnsMonitor,
		budget: QueryBudget,
	): Promise<CheckedMonitor> {
		/** The column is declared as a plain text enum, so its value set is asserted here. */
		let previousStatus = monitor.last_status as DnsCheckStatus | null;
		let plan = await this.plan(db, monitor);
		let granted = budget.takeNames(plan.names.length);

		/**
		 * The invocation has nothing left to spend on this monitor, so it is chunked into the
		 * next delivery rather than recorded as a check that found nothing: it was not checked
		 * at all, and an `error` row here would put a healthy domain in the alert pipeline for
		 * a limit of ours. Re-arming `next_due_at` is what makes "the next delivery" a minute
		 * away instead of a whole interval — a scheduling decision this sweep makes about its
		 * own budget, which is why it is written here rather than through the model's
		 * create/edit rules.
		 */
		if (granted === 0) {
			await db.update(dnsMonitors, monitor.id, { next_due_at: Date.now() }, { touch: true });
			this.logger.info("job.check_dns.deferred", {
				monitorId: monitor.id,
				names: plan.names.length,
			});
			return { deferred: true };
		}

		/**
		 * Names this invocation could not pay for, plus any the per-check cap already dropped.
		 * They are handed to the check as unswept rather than quietly left out of the plan:
		 * a name nobody looked at is a query that did not answer, so the check records the
		 * whole thing as partial instead of as a complete sweep that found fewer records.
		 */
		let unswept = plan.names.length - granted + plan.overflow;
		if (unswept > 0) {
			this.logger.info("job.check_dns.sweep_truncated", {
				monitorId: monitor.id,
				names: plan.names.length + plan.overflow,
				swept: granted,
			});
		}

		let run = await recordDnsCheck(db, monitor.id, plan.names.slice(0, granted), unswept);
		let status = run.status;
		let resultId = run.resultId;

		/**
		 * A sweep whose every query failed has no latency to report and the column is nullable
		 * for exactly that, but the dataset's doubles are not — zero is how the rest of the
		 * dataset already spells "no measurement", so it is what goes in.
		 */
		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "dns",
			status,
			responseTimeMs: run.responseTimeMs ?? 0,
		});

		if (!shouldNotifyDnsResult(previousStatus, status))
			return { deferred: false, notification: null, resultId };

		/**
		 * Ids and statuses only, as the queue's contract has it: the consumer rebuilds the
		 * findings from the record rows the diff above just wrote, so a message that sat on the
		 * queue reports what is outstanding when it is read rather than replaying a snapshot
		 * copied from a check that has since been superseded.
		 */
		return {
			deferred: false,
			notification: {
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus,
				newStatus: status,
			},
			resultId,
		};
	}

	/**
	 * The plan the shared pipeline draws up, plus the one thing about it worth logging from
	 * here: a monitor that tracks no names at all, which this sweep then covers by its apex
	 * alone.
	 *
	 * That is not broken — a zone cannot be enumerated from outside it, so a domain nobody
	 * has imported a zone file for legitimately covers its apex and nothing else, and
	 * sweeping the apex is what discovers the first records. The log distinguishes that from
	 * an import that ran and produced nothing, which is a different problem with the same
	 * symptom, and it is written here rather than in the pipeline because only a background
	 * sweep has nobody to tell.
	 */
	private async plan(db: Database, monitor: ClaimedDnsMonitor): Promise<DnsCheckPlan> {
		let plan = await planDnsCheck(db, monitor.id, monitor.domain);
		if (plan.tracked > 0) return plan;

		this.logger.info("job.check_dns.no_tracked_names", {
			monitorId: monitor.id,
			zoneFileImported: monitor.zone_file_imported_at !== null,
		});

		return plan;
	}
}
