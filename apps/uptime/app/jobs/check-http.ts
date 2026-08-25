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
	/** When the check was scheduled; the run itself may happen later. */
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
			 * An infrastructure fault that left no committed result reaches here;
			 * monitored-endpoint outcomes are classified into a stored result
			 * before this point, so the queue should redeliver.
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
		 * Everything this delivery costs belongs to this monitor's team, including
		 * the two lookups above that ran before the team was known, so attribution
		 * is declared once here and settled at flush (ADR-007 §5).
		 */
		apportionCostByTeam([monitor.team_id]);

		let contentChecks = await db.findMany(monitorContentChecks, {
			where: { monitor_id: job.monitorId, is_enabled: true },
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

		let committed = await this.record(db, job, outcome);
		if (!committed) {
			this.logger.info("job.check_http.duplicate", { jobId: job.id, monitorId: job.monitorId });
			return;
		}

		try {
			/**
			 * Swallowed for the same reason alert dispatch below is: past the commit
			 * point a redelivery short-circuits on the job id, so throwing here would
			 * only ask for a retry that can only spin.
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
		 * `responseTimeMs` and `doWallTimeMs` are logged separately: the first is
		 * what the monitored site's users experience, the second is what the
		 * Durable Object bills for — a lower bound on it, see {@link DO_WALL_TIME_HEADER}.
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
	 * Bills the team for the check this delivery performed, deduped on
	 * `externalId` (the job id) so a redelivery can't double-bill. Best-effort,
	 * since a Polar outage must not fail an already-recorded check.
	 */
	private async meter(db: Database, job: CheckHttpJob.Input, teamId: string): Promise<void> {
		let owners = await Team.ownerIdsByTeamIds(db, [teamId]);
		let ownerId = owners.get(teamId);

		/**
		 * A check ran for a team whose row is gone — a delete that raced this delivery. There
		 * is no customer to bill, and inventing one would be worse than losing the ping, so
		 * this is recorded for visibility.
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
	 * Dispatches alerts for a committed result. Best-effort by design: the
	 * result is already durable, so a redelivery would short-circuit on the job
	 * id instead of reaching here; per-alert failures are already recorded to `alert_events`.
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
