/**
 * Background job that claims the DNS monitors whose `interval_seconds` has come round,
 * sweeps each through the shared pipeline in `app/services/dns-discovery.ts` (ADR-006), and
 * bounds its query budget against the platform's per-invocation ceiling (ADR-026 §9a),
 * deferring or partially reporting what a delivery can't cover. Each completed check bills
 * one ping however many queries it took (ADR-026 §9).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@pkg/jobs-next";

import { createJobHandler } from "@pkg/jobs-next";
import { PolarClient } from "@pkg/polar";
import { getServiceContainer } from "@pkg/service-container";

import type { ClaimedDnsMonitor } from "~/app/data/dns-monitor";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckStatus } from "~/app/services/dns-check";
import type { DnsCheckPlan } from "~/app/services/dns-discovery";
import type { BillablePing } from "~/app/services/ping-meter";

import DnsMonitor from "~/app/data/dns-monitor";
import Team from "~/app/data/team";
import jobs from "~/app/jobs";
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
 * Monitors swept at once inside one invocation, bounded because each is itself a fan-out of
 * names: the product of `MONITOR_CONCURRENCY × NAME_CONCURRENCY × QUERIES_PER_NAME` is what
 * stays under the per-invocation query ceiling.
 */
const MONITOR_CONCURRENCY = 2;

/**
 * What one completed check produced beyond its row: the alert its outcome warrants and the
 * result id billing keys on, kept together since separating them means re-running the
 * sweep's fan-out. A monitor with no budget left is `deferred`, writing nothing.
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

export default createJobHandler(jobs.checkDns, async (ctx) => {
	let polar = getServiceContainer().get(PolarClient);
	/**
	 * Claimed as of now: the claim advances each monitor from its own previous due time, so
	 * this instant only decides which monitors are owed a check, tolerant of the few seconds
	 * the queue hop between trigger and here takes.
	 */
	let monitors = await DnsMonitor.claimDue(ctx.database, Date.now());
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
		ctx.database,
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
		(monitor) => check(ctx, monitor, budget),
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
			 * A monitor whose team names no owner has no Polar customer to bill, though its
			 * check already ran and is recorded — so this logs the gap and moves on, keeping
			 * the sweep going.
			 */
			if (ownerId === undefined) {
				ctx.logger.error("job.check_dns.unbillable_team", {
					monitorId: outcome.item.id,
					teamId: outcome.item.team_id,
				});
				continue;
			}

			/**
			 * One ping per check, per monitor, keyed on the result row (ADR-026 §9): the
			 * public resolver's queries are free, so what a domain monitor sells is one
			 * monitored domain, priced per check.
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
		ctx.logger.error("job.check_dns.monitor_failed", {
			monitorId: outcome.item.id,
			error: outcome.error instanceof Error ? outcome.error.message : String(outcome.error),
		});
	}

	await enqueueNotifications(notifications);
	/** Every ping in one call, so a sweep of eighty monitors costs one subrequest. */
	await ingestPings(polar, pings);

	ctx.logger.info("job.check_dns.completed", {
		total: monitors.length,
		successCount,
		errorCount,
		deferredCount,
		notified: notifications.length,
		ingested: pings.length,
	});
});

/**
 * Sweeps one monitor through the shared check pipeline and records its result, reading
 * `last_status` before the write so a recovery is detectable. Throwing here is what marks
 * a monitor as failed; anything this returns is a check the caller can bill for.
 */
async function check(
	ctx: CurrentJobContext,
	monitor: ClaimedDnsMonitor,
	budget: QueryBudget,
): Promise<CheckedMonitor> {
	/** The column is declared as a plain text enum, so its value set is asserted here. */
	let previousStatus = monitor.last_status as DnsCheckStatus | null;
	let plan = await planFor(ctx, monitor);
	let granted = budget.takeNames(plan.names.length);

	/**
	 * With nothing left to spend on this monitor, it's deferred to the next delivery: an
	 * `error` row here would wrongly alert on a healthy domain over our own limit.
	 * Re-arming `next_due_at` brings that retry within a minute, a decision this sweep owns.
	 */
	if (granted === 0) {
		await ctx.database.update(
			dnsMonitors,
			monitor.id,
			{ next_due_at: Date.now() },
			{ touch: true },
		);
		ctx.logger.info("job.check_dns.deferred", {
			monitorId: monitor.id,
			names: plan.names.length,
		});
		return { deferred: true };
	}

	/**
	 * Names this invocation couldn't pay for, plus any the per-check cap already dropped,
	 * are handed to the check as unswept: a name nobody looked at is treated the same as a
	 * query that failed, so the whole thing reports as a partial sweep.
	 */
	let unswept = plan.names.length - granted + plan.overflow;
	if (unswept > 0) {
		ctx.logger.info("job.check_dns.sweep_truncated", {
			monitorId: monitor.id,
			names: plan.names.length + plan.overflow,
			swept: granted,
		});
	}

	let run = await recordDnsCheck(ctx.database, monitor.id, plan.names.slice(0, granted), unswept);
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
	 * Ids and statuses only, per the queue's contract: the consumer rebuilds findings from
	 * the record rows the diff just wrote, so a message read later always reflects what's
	 * currently outstanding.
	 */
	return {
		deferred: false,
		notification: {
			monitorType: "dns",
			monitorId: monitor.id,
			previousStatus,
			newStatus: status,
		},
		resultId,
	};
}

/**
 * Draws the shared pipeline's plan and logs the one thing worth flagging from here: a
 * monitor tracking no names, which a zone genuinely limits to its apex until an import
 * runs — logged here, since only a background sweep has nobody to tell.
 */
async function planFor(ctx: CurrentJobContext, monitor: ClaimedDnsMonitor): Promise<DnsCheckPlan> {
	let plan = await planDnsCheck(ctx.database, monitor.id, monitor.domain);
	if (plan.tracked > 0) return plan;

	ctx.logger.info("job.check_dns.no_tracked_names", {
		monitorId: monitor.id,
		zoneFileImported: monitor.zone_file_imported_at !== null,
	});

	return plan;
}
