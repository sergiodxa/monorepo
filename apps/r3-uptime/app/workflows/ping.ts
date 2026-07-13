/**
 * The Cloudflare Workflow that runs a single HTTP monitor check end to end: it loads
 * the monitor and its enabled content checks, performs a region-hinted fetch through
 * `GeoFetchDO`, classifies the result (up/degraded/down) against the expected status,
 * degraded threshold, and content checks, records it to both the `monitor_results`
 * "last checked" cache (see `Monitor.findDue`) and Analytics Engine, and dispatches
 * alerts on a down/degraded result or a recovery back to up. Usage ingestion is a
 * later phase (ADR-001 §7).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { Database } from "remix/data-table";

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { BatchedLogger } from "@pkg/logger";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { generateUUID } from "@pkg/uuid";
import { env, WorkflowEntrypoint } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";
import { Resend } from "resend";

import ContentCheck from "~/app/data/content-check";
import { notifyHttpResult } from "~/app/services/alerts";
import { getLatestHttpResult, writeHttpPingResult } from "~/app/services/analytics";
import { monitorContentChecks, monitorResults, monitors } from "~/database/schema";

const MS_PER_SECOND = 1000;
/** Location hints that route through the EU jurisdiction for GDPR compliance. */
const EU_LOCATION_HINTS = new Set(["eeur", "enam"]);

/**
 * Parameters passed to a `Ping` workflow instance when it's triggered.
 */
export namespace Ping {
	export interface WorkflowParams {
		monitorId: string;
	}
}

/**
 * Cloudflare Workflow entrypoint for the `Ping` workflow (see file docblock for what
 * a single run does). Builds its own D1-backed database per run rather than resolving
 * one from the service container, since a workflow step can be replayed independently
 * of the request that triggered it.
 */
export class Ping extends WorkflowEntrypoint<Cloudflare.Env> {
	private getDb(): Database {
		return createDatabase(createD1DatabaseAdapter(env.DB), { now: () => Date.now() });
	}

	override async run(event: WorkflowEvent<Ping.WorkflowParams>, step: WorkflowStep) {
		let { monitorId } = event.payload;
		let logger = new BatchedLogger(`workflow:ping:${event.instanceId}`);

		try {
			await this.execute(monitorId, step, logger);
		} catch (error) {
			logger.error("workflow.ping.error", {
				monitorId,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			logger.flush();
		}
	}

	private async execute(monitorId: string, step: WorkflowStep, logger: BatchedLogger) {
		let db = this.getDb();

		let monitor = await step.do("find monitor", async () => {
			return await db.findOne(monitors, { where: { id: monitorId } });
		});

		if (!monitor) {
			logger.info("workflow.ping.monitor-not-found", { monitorId });
			return;
		}

		let contentChecks = await step.do("find content checks", async () => {
			return await db.findMany(monitorContentChecks, {
				where: { monitor_id: monitorId, is_enabled: true },
			});
		});

		let hasContentChecks = contentChecks.length > 0;

		let checkResult = await step.do(
			"ping monitor",
			{
				retries: { limit: 3, delay: 1000, backoff: "exponential" },
				timeout: monitor.timeout_seconds * MS_PER_SECOND,
			},
			async () => {
				let locationHint = monitor.location_hint as DurableObjectLocationHint;
				let id = env.GEO_FETCH.idFromName(monitor.location_hint);
				let namespace = EU_LOCATION_HINTS.has(monitor.location_hint)
					? env.GEO_FETCH.jurisdiction("eu")
					: env.GEO_FETCH;
				let stub = namespace.get(id, { locationHint });

				/** A content check needs the body, so HEAD becomes GET to retrieve one. */
				let method = hasContentChecks && monitor.method === "HEAD" ? "GET" : monitor.method;
				let signal = AbortSignal.timeout(monitor.timeout_seconds * MS_PER_SECOND);

				try {
					let response = await stub.fetch(monitor.url, { method, signal });
					let body = hasContentChecks ? await response.text().catch(() => "") : "";

					return {
						responseStatus: response.status,
						responseTimeMs: Number(response.headers.get("X-Response-Time") ?? 0),
						body,
						failed: false as const,
					};
				} catch {
					return { responseStatus: null, responseTimeMs: null, body: "", failed: true as const };
				}
			},
		);

		let contentChecksPassed =
			!hasContentChecks || ContentCheck.evaluate(contentChecks, checkResult.body);

		let status = classify(monitor, checkResult, contentChecksPassed);
		let completedAt = Date.now();

		let previousResult = await step.do("get previous status", async () => {
			return await getLatestHttpResult(monitor.team_id, monitorId);
		});
		let previousStatus = isFailure(previousResult) ? null : (previousResult.data?.status ?? null);

		await step.do("record result", async () => {
			await db.create(
				monitorResults,
				{
					id: generateUUID(),
					monitor_id: monitorId,
					response_status: checkResult.responseStatus,
					response_time_ms: checkResult.responseTimeMs,
					completed_at: completedAt,
				},
				{ touch: true, returnRow: true },
			);

			writeHttpPingResult({
				monitorId,
				teamId: monitor.team_id,
				status,
				responseTimeMs: checkResult.responseTimeMs ?? 0,
				responseStatus: checkResult.responseStatus ?? 0,
				expectedStatus: monitor.expected_status,
			});
		});

		await step.do("send alerts", async () => {
			let resend = getServiceContainer().get(Resend);
			await notifyHttpResult(db, resend, monitor, previousStatus, {
				status,
				responseStatus: checkResult.responseStatus ?? 0,
				responseTimeMs: checkResult.responseTimeMs ?? 0,
			});
		});

		logger.info("workflow.ping.completed", {
			monitorId,
			status,
			responseStatus: checkResult.responseStatus,
			responseTimeMs: checkResult.responseTimeMs,
		});
	}
}

interface CheckResult {
	responseStatus: number | null;
	responseTimeMs: number | null;
	failed: boolean;
}

/** Classifies a check as up/degraded/down per `docs/http-monitors.md`'s status model. */
function classify(
	monitor: { expected_status: number; degraded_after_ms: number },
	result: CheckResult,
	contentChecksPassed: boolean,
): "up" | "down" | "degraded" {
	if (result.failed) return "down";
	if (result.responseStatus !== monitor.expected_status) return "down";
	if (!contentChecksPassed) return "down";
	if ((result.responseTimeMs ?? 0) >= monitor.degraded_after_ms) return "degraded";
	return "up";
}
