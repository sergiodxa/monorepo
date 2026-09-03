/**
 * API v1 endpoints for flow monitors: list/create on `/api/v1/flow-monitors`, get/update/delete
 * on one monitor, and its check history, gated by `flow-monitors:read`/`flow-monitors:write` via
 * `requireApiKey`.
 *
 * `source` is accepted but never returned, on the same reading the alert resource applies to a
 * webhook's secret: a spec carries the credentials the flow signs in with, so a key that may
 * list monitors does not thereby read them back.
 *
 * A write runs `inspectFlowSource`, the same rule the dashboard form and the scheduled sweep
 * apply, so a monitor created here can never reach somewhere one created there could not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created, NotFound } from "@sdxc/http/status-code";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { InsertFlowMonitor, SelectFlowMonitor } from "~/database/schema";

import FlowMonitor from "~/app/data/flow-monitor";
import TeamDomain from "~/app/data/team-domain";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { MAX_SOURCE_LENGTH } from "~/app/http/validators/flow-monitor";
import { DEFAULT_FLOW_INTERVAL_SECONDS, FLOW_INTERVALS_SECONDS } from "~/app/lib/pricing";
import { apiError, apiSuccess, parsePaginationQuery } from "~/app/services/api-response";
import { inspectFlowSource } from "~/app/services/flow-check";
import routes from "~/routes/web";

const FlowMonitorIdParams = s.object({ flowMonitorId: s.string() });

/**
 * Maps a flow monitor row to its public camelCase JSON shape.
 *
 * `source` is deliberately absent: a spec holds whatever the flow signs in with, and every
 * read path on this resource goes through here, so one omission covers all of them.
 */
function serializeFlowMonitor(monitor: SelectFlowMonitor) {
	return {
		id: monitor.id,
		name: monitor.name,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		lastCheckedAt: monitor.last_checked_at,
		lastStatus: monitor.last_status,
		createdAt: monitor.created_at,
		updatedAt: monitor.updated_at,
	};
}

/**
 * The interval is an enum of {@link FLOW_INTERVALS_SECONDS} rather than a bounded number,
 * since each selectable value carries its own price — an unlisted one is refused, so nobody
 * discovers their monitor runs hourly after asking for every minute.
 */
const IntervalSecondsSchema = s.enum_(FLOW_INTERVALS_SECONDS);

const SourceSchema = s.string().pipe(checks.minLength(1), checks.maxLength(MAX_SOURCE_LENGTH));

const CreateFlowMonitorSchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	source: SourceSchema,
	intervalSeconds: s.defaulted(IntervalSecondsSchema, DEFAULT_FLOW_INTERVAL_SECONDS),
	isEnabled: s.defaulted(s.boolean(), true),
});

const UpdateFlowMonitorSchema = s.object({
	name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
	source: s.optional(SourceSchema),
	intervalSeconds: s.optional(IntervalSecondsSchema),
	isEnabled: s.optional(s.boolean()),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const flowMonitorsRoutes = {
	flowMonitorsIndex: routes.api.v1.flowMonitors.index,
	flowMonitorsCreate: routes.api.v1.flowMonitors.create,
	flowMonitorShow: routes.api.v1.flowMonitors.show,
	flowMonitorUpdate: routes.api.v1.flowMonitors.update,
	flowMonitorDestroy: routes.api.v1.flowMonitors.destroy,
	flowMonitorResults: routes.api.v1.flowMonitors.results,
};

export default createController(flowMonitorsRoutes, {
	actions: {
		/** GET /api/v1/flow-monitors — lists the team's flow monitors. */
		flowMonitorsIndex: {
			middleware: [requireApiKey("flow-monitors:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let monitors = await FlowMonitor.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ flowMonitors: monitors.map(serializeFlowMonitor) });
			},
		},

		/** POST /api/v1/flow-monitors — creates a flow monitor for the team. */
		flowMonitorsCreate: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CreateFlowMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let db = getServiceContainer().get(Database);
				let refusal = await refuseUnreachableSource(db, ctx.apiTeam.id, result.data.source);
				if (refusal) return refusal;

				let monitor = await FlowMonitor.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					source: result.data.source,
					interval_seconds: result.data.intervalSeconds,
					is_enabled: result.data.isEnabled,
				});

				return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) }, Created);
			},
		},

		/** GET /api/v1/flow-monitors/:flowMonitorId — a single flow monitor. */
		flowMonitorShow: {
			middleware: [requireApiKey("flow-monitors:read")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FlowMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await FlowMonitor.findByIdForTeam(db, ctx.apiTeam.id, flowMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "Flow monitor not found", NotFound);
				return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) });
			},
		},

		/** PUT /api/v1/flow-monitors/:flowMonitorId — updates a flow monitor's editable fields. */
		flowMonitorUpdate: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FlowMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await FlowMonitor.findByIdForTeam(db, ctx.apiTeam.id, flowMonitorId);
				if (!existing) return apiError("NOT_FOUND", "Flow monitor not found", NotFound);

				let result = await validate(ctx.request, UpdateFlowMonitorSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				if (result.data.source !== undefined) {
					let refusal = await refuseUnreachableSource(db, ctx.apiTeam.id, result.data.source);
					if (refusal) return refusal;
				}

				let changes: Partial<InsertFlowMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.source !== undefined) changes.source = result.data.source;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = await FlowMonitor.updateById(db, flowMonitorId, changes);
				return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/flow-monitors/:flowMonitorId — deletes a flow monitor. */
		flowMonitorDestroy: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FlowMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let existing = await FlowMonitor.findByIdForTeam(db, ctx.apiTeam.id, flowMonitorId);
				if (!existing) return apiError("NOT_FOUND", "Flow monitor not found", NotFound);

				await FlowMonitor.deleteById(db, flowMonitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/flow-monitors/:flowMonitorId/results — check-result history. */
		flowMonitorResults: {
			middleware: [requireApiKey("flow-monitors:read")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FlowMonitorIdParams, ctx.params);
				let db = getServiceContainer().get(Database);
				let monitor = await FlowMonitor.findByIdForTeam(db, ctx.apiTeam.id, flowMonitorId);
				if (!monitor) return apiError("NOT_FOUND", "Flow monitor not found", NotFound);

				let { limit } = parsePaginationQuery(ctx.url, { defaultLimit: 50, maxLimit: 200 });
				let results = await FlowMonitor.listResults(db, flowMonitorId, limit);

				return apiSuccess({
					results: results.map((row) => ({
						id: row.id,
						status: row.status,
						testsTotal: row.tests_total,
						testsPassed: row.tests_passed,
						testsFailed: row.tests_failed,
						requestsMade: row.requests_made,
						failedTest: row.failed_test,
						failedAtLine: row.failed_at_line,
						failureDetail: row.failure_detail,
						durationMs: row.duration_ms,
						errorMessage: row.error_message,
						checkedAt: row.checked_at,
					})),
				});
			},
		},
	},
});

/**
 * Refuses a source the team may not run, in the rule's own words.
 *
 * The team's verified domains are read fresh on every write, so un-verifying a domain closes
 * this endpoint to it at the very next call rather than at the next check.
 *
 * @returns The refusal to return, or `null` when the source is one this team may run.
 */
async function refuseUnreachableSource(
	db: Database,
	teamId: string,
	source: string,
): Promise<Response | null> {
	let verifiedDomains = await TeamDomain.verifiedHostnamesForTeam(db, teamId);
	let inspection = inspectFlowSource(source, verifiedDomains);
	if (inspection.ok) return null;
	return apiError("VALIDATION_ERROR", inspection.message, BadRequest);
}
