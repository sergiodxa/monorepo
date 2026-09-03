/**
 * Background job that runs one HTTP monitor check end to end: probes via
 * `HttpCheck`, records the result, caches status on the monitor row, bills the
 * team, and dispatches alerts. The probe steps live in
 * `app/services/http-check.ts`, shared with the ad-hoc ping endpoint; this
 * file owns dedup, history, alerting, and billing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CurrentJobContext } from "@sdxc/jobs";

import { createJobHandler } from "@sdxc/jobs";
import { Mailer } from "@sdxc/mail";
import { getServiceContainer } from "@sdxc/service-container";

import type { CheckHttpInput } from "~/app/jobs";
import type { HttpProbeOutcome } from "~/app/services/http-check";
import type { MonitorStatus, SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import Team from "~/app/data/team";
import jobs from "~/app/jobs";
import { polar } from "~/app/lib/billing";
import { notifyHttpResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { HttpCheck } from "~/app/services/http-check";
import { ingestPings } from "~/app/services/ping-meter";
import { monitorContentChecks, monitorResults, monitors } from "~/database/schema";

/** The context this job's handler and the helpers it splits its work across share. */
type CheckHttpContext = CurrentJobContext & { readonly input: CheckHttpInput };

export default createJobHandler(jobs.checkHttp, async (ctx) => {
	try {
		await execute(ctx);
	} catch (error) {
		/**
		 * An infrastructure fault that left no committed result reaches here;
		 * monitored-endpoint outcomes are classified into a stored result
		 * before this point, so the queue should redeliver.
		 */
		ctx.logger.error("job.check_http.infrastructure_error", {
			jobId: ctx.input.id,
			monitorId: ctx.input.monitorId,
			error: error instanceof Error ? error.message : String(error),
		});
		ctx.retry({ cause: error });
	}
});

async function execute(ctx: CheckHttpContext): Promise<void> {
	if (await ctx.database.findOne(monitorResults, { where: { id: ctx.input.id } })) {
		ctx.logger.info("job.check_http.duplicate", {
			jobId: ctx.input.id,
			monitorId: ctx.input.monitorId,
		});
		return;
	}

	let monitor = await ctx.database.findOne(monitors, { where: { id: ctx.input.monitorId } });
	if (!monitor) {
		ctx.logger.info("job.check_http.monitor_not_found", { monitorId: ctx.input.monitorId });
		return;
	}

	/**
	 * Everything this delivery costs belongs to this monitor's team, including
	 * the two lookups above that ran before the team was known, so attribution
	 * is declared once here and settled at flush (ADR-007 §5).
	 */
	apportionCostByTeam([monitor.team_id]);

	let contentChecks = await ctx.database.findMany(monitorContentChecks, {
		where: { monitor_id: ctx.input.monitorId, is_enabled: true },
	});

	/**
	 * The probe, evaluation, and classification steps live in `HttpCheck`,
	 * shared with the ad-hoc ping endpoint. They run individually here so
	 * the code below can read `outcome` and `status` separately.
	 */
	let check = HttpCheck.forMonitor(monitor, contentChecks);
	let outcome = await check.probe();
	let contentChecksPassed = check.evaluate(outcome);
	let status = check.classify(outcome, contentChecksPassed);

	/**
	 * The status this check is transitioning from, read off the monitor row
	 * before the write below overwrites it. `null` marks a first-time check;
	 * the column is a plain text enum, so its value set is asserted here.
	 */
	let previousStatus = monitor.last_status as MonitorStatus | null;

	let committed = await record(ctx, outcome);
	if (!committed) {
		ctx.logger.info("job.check_http.duplicate", {
			jobId: ctx.input.id,
			monitorId: ctx.input.monitorId,
		});
		return;
	}

	try {
		/**
		 * Swallowed for the same reason alert dispatch below is: past the commit
		 * point a redelivery short-circuits on the job id, so throwing here would
		 * only ask for a retry that can only spin.
		 */
		await Monitor.recordCheckStatus(
			ctx.database,
			ctx.input.monitorId,
			status,
			outcome.responseTimeMs,
		);
	} catch (error) {
		ctx.logger.error("job.check_http.status_write_failed", {
			monitorId: ctx.input.monitorId,
			error: error instanceof Error ? error.message : String(error),
		});
	}

	writePingResult({
		monitorId: ctx.input.monitorId,
		teamId: monitor.team_id,
		type: "http",
		status,
		responseTimeMs: outcome.responseTimeMs ?? 0,
		responseStatus: outcome.responseStatus ?? 0,
		expectedStatus: monitor.expected_status,
	});

	await meter(ctx, monitor.team_id);
	await notify(ctx, monitor, previousStatus, outcome, status);

	/**
	 * `responseTimeMs` and `doWallTimeMs` are logged separately: the first is
	 * what the monitored site's users experience, the second is what the
	 * Durable Object bills for — a lower bound on it, see {@link DO_WALL_TIME_HEADER}.
	 */
	ctx.logger.info("job.check_http.completed", {
		jobId: ctx.input.id,
		monitorId: ctx.input.monitorId,
		status,
		responseStatus: outcome.responseStatus,
		responseTimeMs: outcome.responseTimeMs,
		doWallTimeMs: outcome.doWallTimeMs,
	});
}

/**
 * Commits the result under the job id. Returns false when that id is already taken,
 * which means a delivery of this same job won the race and everything downstream of
 * the commit has been handled (or will be) by that one.
 */
async function record(ctx: CheckHttpContext, outcome: HttpProbeOutcome): Promise<boolean> {
	try {
		await ctx.database.create(
			monitorResults,
			{
				id: ctx.input.id,
				monitor_id: ctx.input.monitorId,
				response_status: outcome.responseStatus,
				response_time_ms: outcome.responseTimeMs,
				completed_at: Date.now(),
			},
			{ touch: true, returnRow: true },
		);
		return true;
	} catch (error) {
		if (isDuplicateKey(error)) return false;
		throw error;
	}
}

/**
 * Bills the team for the check this delivery performed, deduped on
 * `externalId` (the job id) so a redelivery can't double-bill. Best-effort,
 * since a Polar outage must not fail an already-recorded check.
 */
async function meter(ctx: CheckHttpContext, teamId: string): Promise<void> {
	let owners = await Team.ownerIdsByTeamIds(ctx.database, [teamId]);
	let ownerId = owners.get(teamId);

	/**
	 * A check ran for a team whose row is gone — a delete that raced this delivery. There
	 * is no customer to bill, and inventing one would be worse than losing the ping, so
	 * this is recorded for visibility.
	 */
	if (!ownerId) {
		ctx.logger.error("job.check_http.unbillable_team", {
			monitorId: ctx.input.monitorId,
			teamId,
		});
		return;
	}

	await ingestPings(polar, [
		{
			externalId: `ping:${ctx.input.id}`,
			ownerId,
			teamId,
			monitorId: ctx.input.monitorId,
			type: "http",
		},
	]);
}

/**
 * Dispatches alerts for a committed result. Best-effort by design: the
 * result is already durable, so a redelivery would short-circuit on the job
 * id instead of reaching here; per-alert failures are already recorded to `alert_events`.
 */
async function notify(
	ctx: CheckHttpContext,
	monitor: SelectMonitor,
	previousStatus: MonitorStatus | "timeout" | null,
	outcome: HttpProbeOutcome,
	status: MonitorStatus,
): Promise<void> {
	try {
		let mailer = getServiceContainer().get(Mailer);
		await notifyHttpResult(ctx.database, mailer, monitor, previousStatus, {
			status,
			responseStatus: outcome.responseStatus ?? 0,
			responseTimeMs: outcome.responseTimeMs ?? 0,
		});
	} catch (error) {
		ctx.logger.error("job.check_http.alert_failed", {
			monitorId: monitor.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/** Whether `error` is SQLite rejecting an insert whose primary key is already taken. */
function isDuplicateKey(error: unknown): boolean {
	let message = error instanceof Error ? error.message : String(error);
	return message.includes("UNIQUE constraint failed");
}
