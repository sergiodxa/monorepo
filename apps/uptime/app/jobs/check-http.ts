/**
 * Background job that runs one HTTP monitor check end to end: it loads the monitor and
 * its enabled content checks, runs the probe/evaluate/classify steps of `HttpCheck`,
 * records the result to both `monitor_results` and Analytics Engine, caches its outcome
 * on the monitor row, bills the team for the ping, and dispatches alerts on a
 * down/degraded result or a recovery back to up.
 *
 * The check itself — the region-hinted fetch through `GeoFetchDO`, the content-check
 * evaluation, the up/degraded/down classification — lives in `app/services/http-check.ts`
 * rather than here, because the ad-hoc `POST /api/v1/ping` endpoint performs the same
 * three steps against a target that has no monitor row. Everything this file still owns
 * is what makes a check a *monitor's* check: the deduplication, the stored history, the
 * cached status, the alerting, and the billing.
 *
 * Whether a result is a recovery depends on what the previous check said, which is read
 * off the monitor row's `last_status` rather than queried from Analytics Engine, and
 * written back once the result is committed.
 *
 * Nothing here decides when the next check happens: the scheduler advances a monitor's
 * next due time when it claims it, not when the check completes, so a slow probe can't
 * push its own cadence out.
 *
 * The queue delivers at least once, so the job id doubles as the `monitor_results`
 * primary key. That row is the commit point: everything before it is safe to redo, so a
 * redelivery short-circuits on the id before re-hitting the monitored endpoint and the
 * primary key itself rejects a delivery that raced another one. Everything after it —
 * the analytics data point, the cached status on the monitor row, the metered ping, and
 * alert dispatch — is best-effort, because a redelivery would short-circuit rather than
 * repeat it.
 *
 * Only infrastructure faults (D1, the Durable Object, an unexpected exception) ask the
 * queue to redeliver. A monitored endpoint that times out, refuses the connection, or
 * answers with the wrong status is a valid monitoring result: it gets stored, alerted
 * on, and acknowledged.
 *
 * Nothing here consults billing to decide *whether* to run. Entitlement is settled by
 * whoever enqueues the message, so a message reaching this job is always one to carry
 * out; the Polar call below reports the check that already happened and never gates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { Mailer } from "@pkg/mail";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";

import type { HttpProbeOutcome } from "~/app/services/http-check";
import type { MonitorStatus, SelectMonitor } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import Team from "~/app/data/team";
import { notifyHttpResult } from "~/app/services/alerts";
import { writePingResult } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import { HttpCheck } from "~/app/services/http-check";
import { ingestPings } from "~/app/services/ping-meter";
import { monitorContentChecks, monitorResults, monitors } from "~/database/schema";

const CheckHttpJobSchema = s.object({
	/**
	 * Globally unique id for this check, reused as the `monitor_results` primary key so
	 * a redelivered message can be recognized and dropped.
	 */
	id: s.string(),
	monitorId: s.string(),
	/** When the check was scheduled, which is not when it ends up running. */
	scheduledAt: s.number(),
});

export class CheckHttpJob extends Job {
	static schema = CheckHttpJobSchema;

	async perform(): Promise<void> {
		let parsed = await validate(this.input, CheckHttpJob.schema);

		if (isFailure(parsed)) {
			this.logger.error("job.check_http.invalid_input", { input: this.input });
			throw new Job.NonRetriableError("Invalid input", { cause: parsed.error });
		}

		let job = parsed.data;

		try {
			await this.execute(job);
		} catch (error) {
			/**
			 * Nothing reaching here is a statement about the monitored endpoint — those are
			 * classified into a stored result instead. This is D1, the Durable Object
			 * namespace, or an unexpected internal fault, all of which left the check
			 * without a committed result, so the queue should redeliver it.
			 */
			this.logger.error("job.check_http.infrastructure_error", {
				jobId: job.id,
				monitorId: job.monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw new Job.RetryError("HTTP check failed before a result was recorded", { cause: error });
		}
	}

	private async execute(job: CheckHttpJob.Input): Promise<void> {
		let db = getServiceContainer().get(Database);

		if (await db.findOne(monitorResults, { where: { id: job.id } })) {
			this.logger.info("job.check_http.duplicate", { jobId: job.id, monitorId: job.monitorId });
			return;
		}

		let monitor = await db.findOne(monitors, { where: { id: job.monitorId } });
		if (!monitor) {
			this.logger.info("job.check_http.monitor_not_found", { monitorId: job.monitorId });
			return;
		}

		/**
		 * Everything this delivery costs belongs to this monitor's team, including the two
		 * statements above that ran before the team was known — which is why attribution is
		 * declared once here and settled at flush rather than passed to each recording site
		 * (ADR-007 §5).
		 */
		apportionCostByTeam([monitor.team_id]);

		let contentChecks = await db.findMany(monitorContentChecks, {
			where: { monitor_id: job.monitorId, is_enabled: true },
		});

		/**
		 * The probe, the content-check evaluation and the classification are the same three
		 * steps the ad-hoc `POST /api/v1/ping` endpoint runs, so they live in `HttpCheck`
		 * rather than here. They are stepped through one at a time instead of via
		 * `HttpCheck.run` only because everything below reads `outcome` and `status`
		 * separately; the composition is identical.
		 */
		let check = HttpCheck.forMonitor(monitor, contentChecks);
		let outcome = await check.probe();
		let contentChecksPassed = check.evaluate(outcome);
		let status = check.classify(outcome, contentChecksPassed);

		/**
		 * The status this check is transitioning from, off the row already loaded above, and
		 * read before the write below overwrites it — this check is about to become the last
		 * one. `null` (never checked) is never a recovery. The column is declared as a plain
		 * text enum, so its value set is asserted here.
		 */
		let previousStatus = monitor.last_status as MonitorStatus | null;

		let committed = await this.record(db, job, outcome);
		if (!committed) {
			this.logger.info("job.check_http.duplicate", { jobId: job.id, monitorId: job.monitorId });
			return;
		}

		try {
			/**
			 * Swallowed for the same reason alert dispatch below is: past the commit point a
			 * redelivery short-circuits on the job id instead of reaching here, so throwing
			 * would ask for a retry that can only spin. The columns then keep the previous
			 * check's status, which is at worst a recovery alerted one check late.
			 */
			await Monitor.recordCheckStatus(db, job.monitorId, status, outcome.responseTimeMs);
		} catch (error) {
			this.logger.error("job.check_http.status_write_failed", {
				monitorId: job.monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
		}

		writePingResult({
			monitorId: job.monitorId,
			teamId: monitor.team_id,
			type: "http",
			status,
			responseTimeMs: outcome.responseTimeMs ?? 0,
			responseStatus: outcome.responseStatus ?? 0,
			expectedStatus: monitor.expected_status,
		});

		await this.meter(db, job, monitor.team_id);
		await this.notify(db, monitor, previousStatus, outcome, status);

		/**
		 * `responseTimeMs` and `doWallTimeMs` are logged side by side rather than
		 * conflated: the first is what the monitored site's users experience, the second is
		 * what the Durable Object bills for — a lower bound on it, see
		 * {@link DO_WALL_TIME_HEADER}. Content checks and large response bodies widen the
		 * second without touching the first, which is currently invisible.
		 */
		this.logger.info("job.check_http.completed", {
			jobId: job.id,
			monitorId: job.monitorId,
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
	private async record(
		db: Database,
		job: CheckHttpJob.Input,
		outcome: HttpProbeOutcome,
	): Promise<boolean> {
		try {
			await db.create(
				monitorResults,
				{
					id: job.id,
					monitor_id: job.monitorId,
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
	 * Bills the team for the check this delivery performed.
	 *
	 * Placed after the commit for the same reason the alert dispatch is: the job id is the
	 * `monitor_results` primary key, so a redelivery short-circuits on it long before
	 * reaching here and can't bill the same check twice. The event's own `externalId` is
	 * that same job id, which makes the guarantee Polar's as well as ours rather than
	 * resting on the short-circuit alone.
	 *
	 * Best-effort, like everything past the commit point: a Polar outage must not fail a
	 * check that already produced a durable result, and throwing would only ask the queue
	 * for a retry that short-circuits. `ingestPings` logs a dropped event itself.
	 */
	private async meter(db: Database, job: CheckHttpJob.Input, teamId: string): Promise<void> {
		let owners = await Team.ownerIdsByTeamIds(db, [teamId]);
		let ownerId = owners.get(teamId);

		/**
		 * A check ran for a team whose row is gone — a delete that raced this delivery. There
		 * is no customer to bill, and inventing one would be worse than losing the ping, so
		 * this is recorded rather than resolved.
		 */
		if (!ownerId) {
			this.logger.error("job.check_http.unbillable_team", { monitorId: job.monitorId, teamId });
			return;
		}

		await ingestPings(getServiceContainer().get(PolarClient), [
			{
				externalId: `ping:${job.id}`,
				ownerId,
				teamId,
				monitorId: job.monitorId,
				type: "http",
			},
		]);
	}

	/**
	 * Dispatches alerts for a committed result. Best-effort by design: the result is
	 * already durable, so a redelivery would short-circuit on the job id instead of
	 * reaching this point, which makes throwing here a retry that can only spin. Per-alert
	 * delivery failures are already recorded to `alert_events` by the alert pipeline
	 * itself; this only catches the lookups that decide which alerts apply.
	 */
	private async notify(
		db: Database,
		monitor: SelectMonitor,
		previousStatus: MonitorStatus | "timeout" | null,
		outcome: HttpProbeOutcome,
		status: MonitorStatus,
	): Promise<void> {
		try {
			let mailer = getServiceContainer().get(Mailer);
			await notifyHttpResult(db, mailer, monitor, previousStatus, {
				status,
				responseStatus: outcome.responseStatus ?? 0,
				responseTimeMs: outcome.responseTimeMs ?? 0,
			});
		} catch (error) {
			this.logger.error("job.check_http.alert_failed", {
				monitorId: monitor.id,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
}

export namespace CheckHttpJob {
	export type Input = s.InferOutput<typeof CheckHttpJobSchema>;
}

/** Whether `error` is SQLite rejecting an insert whose primary key is already taken. */
function isDuplicateKey(error: unknown): boolean {
	let message = error instanceof Error ? error.message : String(error);
	return message.includes("UNIQUE constraint failed");
}
