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

import type { Database } from "remix/data-table";
import type { RequestContext } from "remix/router";

import { Created } from "@sdxc/http/status-code";
import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertFlowMonitor, SelectFlowMonitor } from "~/database/schema";

import FlowMonitor from "~/app/data/flow-monitor";
import TeamDomain from "~/app/data/team-domain";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	CREATE_FLOW_MONITOR_BODY,
	FLOW_MONITOR_ID_PARAMS,
	UPDATE_FLOW_MONITOR_BODY,
	WRITABLE_FLOW_MONITOR,
} from "~/app/http/openapi/flow-monitors";
import { apiProblems, invalidField, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { inspectFlowSource } from "~/app/services/flow-check";
import { apiPage, NEWEST_FIRST, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { flowMonitorsRoutes } from "~/routes/api-groups";

/**
 * Maps a flow monitor row to its public camelCase JSON shape.
 *
 * `source` is deliberately absent: a spec holds whatever the flow signs in with, and every
 * read path on this resource goes through here, so one omission covers all of them.
 */
function serializeFlowMonitor(monitor: SelectFlowMonitor) {
	return {
		id: encodeId("flow", monitor.id),
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
 * The flow monitor's writable members as the API reads them, the target a `PATCH` merge
 * patch applies to. `source` is here even though no response carries it, since a patch
 * leaving it out must keep the stored spec.
 */
function writableFlowMonitor(monitor: SelectFlowMonitor) {
	return {
		name: monitor.name,
		source: monitor.source,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
	};
}

/**
 * Applies a `PATCH` merge patch to one flow monitor. Only the members the patch changed
 * are written, so re-sending `isEnabled: true` keeps the schedule, and a changed `source`
 * passes the reach rule before anything is stored.
 *
 * @param ctx - The request, after `requireApiKey("flow-monitors:write")`.
 * @returns The updated monitor; a 404 for a monitor outside the team, before the body is read.
 */
async function patchFlowMonitor(ctx: RequestContext): Promise<Response> {
	let { flowMonitorId } = s.parse(FLOW_MONITOR_ID_PARAMS, ctx.params);
	let existing = await FlowMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, flowMonitorId);
	if (!existing)
		return apiProblems.notFound({ detail: "Flow monitor not found", instance: problemInstance() });

	let update = await readApiUpdate(
		ctx.request,
		writableFlowMonitor(existing),
		WRITABLE_FLOW_MONITOR,
	);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	if (changed.has("source")) {
		let refusal = await refuseUnreachableSource(ctx.db, ctx.apiTeam.id, value.source);
		if (refusal) return refusal;
	}

	let changes: Partial<InsertFlowMonitor> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("source")) changes.source = value.source;
	if (changed.has("intervalSeconds")) changes.interval_seconds = value.intervalSeconds;
	if (changed.has("isEnabled")) changes.is_enabled = value.isEnabled;

	let monitor = await FlowMonitor.updateById(ctx.db, flowMonitorId, changes);
	return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) });
}

export default createController(flowMonitorsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/flow-monitors — lists the team's flow monitors. */
		flowMonitorsIndex: {
			middleware: [requireApiKey("flow-monitors:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = FlowMonitor.listByTeamQuery(ctx.db, ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				return apiPage({ flowMonitors: page.data.items.map(serializeFlowMonitor) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/flow-monitors — creates a flow monitor for the team. */
		flowMonitorsCreate: {
			middleware: [requireApiKey("flow-monitors:write"), idempotent],
			handler: async (ctx) => {
				let result = await validate(ctx.request, CREATE_FLOW_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let refusal = await refuseUnreachableSource(ctx.db, ctx.apiTeam.id, result.data.source);
				if (refusal) return refusal;

				let monitor = await FlowMonitor.create(ctx.db, ctx.apiTeam.id, {
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
				let { flowMonitorId } = s.parse(FLOW_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await FlowMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, flowMonitorId);
				if (!monitor)
					return apiProblems.notFound({
						detail: "Flow monitor not found",
						instance: problemInstance(),
					});
				return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) });
			},
		},

		/** PATCH /api/v1/flow-monitors/:flowMonitorId — merge-patches a flow monitor. */
		flowMonitorPatch: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: patchFlowMonitor,
		},

		/** PUT /api/v1/flow-monitors/:flowMonitorId — updates a flow monitor's editable fields. */
		flowMonitorUpdate: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FLOW_MONITOR_ID_PARAMS, ctx.params);
				let existing = await FlowMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, flowMonitorId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Flow monitor not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_FLOW_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				if (result.data.source !== undefined) {
					let refusal = await refuseUnreachableSource(ctx.db, ctx.apiTeam.id, result.data.source);
					if (refusal) return refusal;
				}

				let changes: Partial<InsertFlowMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.source !== undefined) changes.source = result.data.source;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;

				let monitor = await FlowMonitor.updateById(ctx.db, flowMonitorId, changes);
				return apiSuccess({ flowMonitor: serializeFlowMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/flow-monitors/:flowMonitorId — deletes a flow monitor. */
		flowMonitorDestroy: {
			middleware: [requireApiKey("flow-monitors:write")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FLOW_MONITOR_ID_PARAMS, ctx.params);
				let existing = await FlowMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, flowMonitorId);
				if (!existing)
					return apiProblems.notFound({
						detail: "Flow monitor not found",
						instance: problemInstance(),
					});

				await FlowMonitor.deleteById(ctx.db, flowMonitorId);
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/flow-monitors/:flowMonitorId/results — check-result history. */
		flowMonitorResults: {
			middleware: [requireApiKey("flow-monitors:read")],
			handler: async (ctx) => {
				let { flowMonitorId } = s.parse(FLOW_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await FlowMonitor.findByIdForTeam(ctx.db, ctx.apiTeam.id, flowMonitorId);
				if (!monitor)
					return apiProblems.notFound({
						detail: "Flow monitor not found",
						instance: problemInstance(),
					});

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(FlowMonitor.resultsQuery(ctx.db, flowMonitorId), {
					orderBy: newestFirst("checked_at"),
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				let results = page.data.items.map((row) => ({
					id: encodeId("flowres", row.id),
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
				}));

				return apiPage({ results }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
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
	return invalidField(inspection.message, "/source");
}
