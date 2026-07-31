/**
 * Background job that runs one HTTP monitor check end to end: it loads the monitor and
 * its enabled content checks, performs a region-hinted fetch through `GeoFetchDO`,
 * classifies the result
 * (up/degraded/down) against the expected status, degraded threshold, and content
 * checks, records it to both `monitor_results` and Analytics Engine, caches its outcome
 * on the monitor row, and dispatches
 * alerts on a down/degraded result or a recovery back to up. Usage ingestion is not
 * wired up yet.
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
 * the analytics data point, the cached status on the monitor row, and alert dispatch — is
 * best-effort, because a redelivery would short-circuit rather than repeat it.
 *
 * Only infrastructure faults (D1, the Durable Object, an unexpected exception) ask the
 * queue to redeliver. A monitored endpoint that times out, refuses the connection, or
 * answers with the wrong status is a valid monitoring result: it gets stored, alerted
 * on, and acknowledged.
 *
 * Nothing here consults billing. Whether a check is allowed to run is settled by
 * whoever enqueues it, so this job never has to ask Polar and a message reaching it is
 * always one to carry out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Job } from "@pkg/jobs";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { Resend } from "resend";

import type { MonitorStatus, SelectMonitor } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import { DO_WALL_TIME_HEADER, PROBE_OUTCOME_HEADER } from "~/app/do/geo-fetch";
import { notifyHttpResult } from "~/app/services/alerts";
import { writeHttpPingResult } from "~/app/services/analytics";
import { monitorContentChecks, monitorResults, monitors } from "~/database/schema";

const MS_PER_SECOND = 1000;
/**
 * Location hints whose `GeoFetchDO` is pinned to Cloudflare's EU jurisdiction, which is
 * Europe's two hints and nothing else (ADR-013).
 *
 * A jurisdiction is a hard constraint on where the object runs; a location hint is only a
 * preference, and the jurisdiction wins when they disagree. `enam` — eastern *North
 * America* — was in this set, so a monitor asking to be probed from North America was
 * probed from Europe and its `response_time_ms` measured the wrong continent.
 *
 * Whether the pin belongs here at all is deliberately still open. It cannot be an
 * obligation about stored personal data: this object has no storage, no alarms and no
 * state that outlives the request — it proxies a fetch, times it, and returns — while the
 * personal data in this system lives in D1 and KV, neither of which is
 * jurisdiction-scoped. ADR-013 records the product question; until it is answered the two
 * European hints keep the pin, because dropping it is the change that needs the answer.
 */
const EU_LOCATION_HINTS = new Set(["eeur", "weur"]);

/**
 * How many `GeoFetchDO` instances share the probing for one location hint (ADR-009).
 *
 * A single Durable Object is a single-threaded actor, so without this every monitor in a
 * region queues behind one object and one hung target degrades the whole region. Eight
 * raises that ceiling ~8× while leaving enough monitors per shard for concurrent probes
 * to keep amortising the object's billed duration window.
 *
 * A constant rather than configuration on purpose: changing it re-hashes every monitor
 * onto a different object, which puts a step change in every latency series for no reason
 * a user can see, so it should be a deliberate code change with a changelog note.
 */
const SHARDS_PER_REGION = 8;

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

/**
 * What one region-hinted fetch observed. `failed` covers everything that stopped the
 * request from producing a response at all — timeout, DNS failure, refused connection.
 */
interface CheckOutcome {
	responseStatus: number | null;
	responseTimeMs: number | null;
	/**
	 * How long the Durable Object's handler ran, which is the billing metric, against
	 * `responseTimeMs`'s product metric (ADR-019 §2). A LOWER BOUND on the billed
	 * window — see {@link DO_WALL_TIME_HEADER}. `null` when the object never reported
	 * one, which is the case when this side's timeout aborted the call.
	 */
	doWallTimeMs: number | null;
	body: string;
	failed: boolean;
}

/** The outcome for a monitor that never answered: no status, no timing, classified down. */
const UNREACHABLE: CheckOutcome = {
	responseStatus: null,
	responseTimeMs: null,
	doWallTimeMs: null,
	body: "",
	failed: true,
};

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

		let contentChecks = await db.findMany(monitorContentChecks, {
			where: { monitor_id: job.monitorId, is_enabled: true },
		});
		let hasContentChecks = contentChecks.length > 0;

		let outcome = await this.fetchMonitor(monitor, hasContentChecks);
		let contentChecksPassed =
			!hasContentChecks || ContentCheck.evaluate(contentChecks, outcome.body);
		let status = classify(monitor, outcome, contentChecksPassed);

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

		writeHttpPingResult({
			monitorId: job.monitorId,
			teamId: monitor.team_id,
			status,
			responseTimeMs: outcome.responseTimeMs ?? 0,
			responseStatus: outcome.responseStatus ?? 0,
			expectedStatus: monitor.expected_status,
		});

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
	 * Fetches the monitor's URL through a `GeoFetchDO` instance pinned to its configured
	 * region, which is what measures the response time. Which of that region's
	 * {@link SHARDS_PER_REGION} instances is decided by {@link shardFor}, so the monitor
	 * always probes through the same one.
	 *
	 * Throws only when the Durable Object itself is unavailable, which is an
	 * infrastructure fault the queue should retry rather than a statement about the
	 * monitored endpoint. The two ways the endpoint itself can fail both come back as an
	 * unreachable {@link CheckOutcome}: the object reports a request it couldn't complete
	 * as an `unreachable` response, and the monitor's own timeout aborts the call here.
	 */
	private async fetchMonitor(
		monitor: SelectMonitor,
		hasContentChecks: boolean,
	): Promise<CheckOutcome> {
		let locationHint = monitor.location_hint as DurableObjectLocationHint;
		/**
		 * The namespace is chosen before the id is minted, because a jurisdiction is a
		 * property of the id: the same name yields a different id in each jurisdiction, and
		 * `get` errors when the id's jurisdiction and the namespace's differ. Minting off
		 * `env.GEO_FETCH` and then calling `get` on the EU subnamespace is that mismatch.
		 */
		let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
			? env.GEO_FETCH.jurisdiction("eu")
			: env.GEO_FETCH;
		let id = namespace.idFromName(
			`${monitor.location_hint}:${shardFor(monitor.id, SHARDS_PER_REGION)}`,
		);
		let stub = namespace.get(id, { locationHint });

		/** A content check needs the body, so HEAD becomes GET to retrieve one. */
		let method = hasContentChecks && monitor.method === "HEAD" ? "GET" : monitor.method;
		let signal = AbortSignal.timeout(monitor.timeout_seconds * MS_PER_SECOND);

		try {
			let response = await stub.fetch(monitor.url, { method, signal });

			/**
			 * The object reached us but couldn't reach the monitor: a `down` result. Its
			 * wall time is kept anyway — a probe that failed still occupied the object, and
			 * that is the expensive case worth watching.
			 */
			if (response.headers.get(PROBE_OUTCOME_HEADER) === "unreachable") {
				return { ...UNREACHABLE, doWallTimeMs: readWallTime(response) };
			}

			let body = hasContentChecks ? await response.text().catch(() => "") : "";

			return {
				responseStatus: response.status,
				responseTimeMs: Number(response.headers.get("X-Response-Time") ?? 0),
				doWallTimeMs: readWallTime(response),
				body,
				failed: false,
			};
		} catch (error) {
			// The monitor's configured timeout elapsed, which is also a `down` result.
			if (signal.aborted) return UNREACHABLE;
			/**
			 * Anything else means the call to the Durable Object failed rather than the
			 * request it was asked to make, so nothing was learned about the monitor.
			 * Propagate it as the infrastructure fault it is instead of recording a `down`
			 * the endpoint didn't earn.
			 */
			throw error;
		}
	}

	/**
	 * Commits the result under the job id. Returns false when that id is already taken,
	 * which means a delivery of this same job won the race and everything downstream of
	 * the commit has been handled (or will be) by that one.
	 */
	private async record(
		db: Database,
		job: CheckHttpJob.Input,
		outcome: CheckOutcome,
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
		outcome: CheckOutcome,
		status: MonitorStatus,
	): Promise<void> {
		try {
			let resend = getServiceContainer().get(Resend);
			await notifyHttpResult(db, resend, monitor, previousStatus, {
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

/**
 * Which of `shards` objects within a region a monitor's probes go through.
 *
 * FNV-1a over the id, which is all this needs: an even spread over a handful of buckets
 * and, more importantly, the same answer for the same monitor forever. A monitor that
 * drifted between shards would show a step change in its response times that nothing the
 * user did explains, so this is derived from the id and never from a counter, the clock,
 * or randomness.
 */
function shardFor(id: string, shards: number): number {
	let hash = 0x811c9dc5;

	for (let index = 0; index < id.length; index++) {
		hash ^= id.charCodeAt(index);
		// `Math.imul` because the FNV prime overflows a double's exact integer range.
		hash = Math.imul(hash, 0x01000193);
	}

	return (hash >>> 0) % shards;
}

/** Classifies a check as up/degraded/down per `docs/http-monitors.md`'s status model. */
function classify(
	monitor: { expected_status: number; degraded_after_ms: number },
	outcome: CheckOutcome,
	contentChecksPassed: boolean,
): MonitorStatus {
	if (outcome.failed) return "down";
	if (outcome.responseStatus !== monitor.expected_status) return "down";
	if (!contentChecksPassed) return "down";
	if ((outcome.responseTimeMs ?? 0) >= monitor.degraded_after_ms) return "degraded";
	return "up";
}

/**
 * Reads the Durable Object's reported handler duration off a probe response.
 *
 * Returns `null` rather than 0 when the header is missing or unparseable, because a
 * measurement that didn't happen and a handler that took no time are different facts
 * and averaging the two would understate the billed window further than it already is.
 */
function readWallTime(response: Response): number | null {
	let header = response.headers.get(DO_WALL_TIME_HEADER);
	if (header === null) return null;

	let value = Number(header);
	return Number.isFinite(value) ? value : null;
}

/** Whether `error` is SQLite rejecting an insert whose primary key is already taken. */
function isDuplicateKey(error: unknown): boolean {
	let message = error instanceof Error ? error.message : String(error);
	return message.includes("UNIQUE constraint failed");
}
