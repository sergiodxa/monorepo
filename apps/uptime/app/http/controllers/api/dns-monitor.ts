/**
 * API v1 item endpoints for a single DNS monitor: get/update/delete
 * (`dns-monitors:read`/`dns-monitors:write`) and check-result history
 * (`dns-monitors:read`), scoped to a monitor owned by the caller's team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import * as s from "@sdxc/json-schema";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { InsertDnsMonitor, SelectDnsMonitor } from "~/database/schema";

import { serializeDnsMonitor } from "~/app/http/controllers/api/dns-monitors";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import {
	DNS_MONITOR_ID_PARAMS,
	UPDATE_DNS_MONITOR_BODY,
	WRITABLE_DNS_MONITOR,
} from "~/app/http/openapi/dns-monitors";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { dnsMonitorRoutes } from "~/routes/api-groups";

/**
 * The DNS monitor's writable members as the API reads them, the target an update's merge
 * patch applies to.
 */
function writableDnsMonitor(monitor: SelectDnsMonitor) {
	return {
		name: monitor.name,
		domain: monitor.domain,
		intervalSeconds: monitor.interval_seconds,
		isEnabled: monitor.is_enabled,
		registrationWarningDays: monitor.registration_warning_days,
	};
}

/**
 * Applies a `PATCH` merge patch to one DNS monitor. Only the members the patch changed
 * are written, so re-sending the current interval or `isEnabled` leaves the schedule alone.
 *
 * @param ctx - The request, after `requireApiKey("dns-monitors:write")`.
 * @returns The updated monitor; a 404 for a monitor outside the team, before the body is read.
 */
async function patchDnsMonitor(ctx: RequestContext): Promise<Response> {
	let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
	let existing = await ctx.models.dnsMonitors
		.inTeam(ctx.apiTeam.id)
		.where({ id: dnsMonitorId })
		.first();
	if (!existing)
		return apiProblems.notFound({ detail: "DNS monitor not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableDnsMonitor(existing), WRITABLE_DNS_MONITOR);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertDnsMonitor> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("domain")) changes.domain = value.domain;
	if (changed.has("intervalSeconds")) changes.interval_seconds = value.intervalSeconds;
	if (changed.has("isEnabled")) changes.is_enabled = value.isEnabled;
	if (changed.has("registrationWarningDays")) {
		changes.registration_warning_days = value.registrationWarningDays;
	}

	let monitor = unwrap(await ctx.models.dnsMonitors.update(dnsMonitorId, changes));
	return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
}

export default createController(dnsMonitorRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/dns-monitors/:dnsMonitorId — a single DNS monitor. */
		dnsMonitorShow: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** PATCH /api/v1/dns-monitors/:dnsMonitorId — merge-patches a DNS monitor. */
		dnsMonitorPatch: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: patchDnsMonitor,
		},

		/** PUT /api/v1/dns-monitors/:dnsMonitorId — updates a DNS monitor's editable fields. */
		dnsMonitorUpdate: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let existing = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!existing)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				let result = await validate(ctx.request, UPDATE_DNS_MONITOR_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertDnsMonitor> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.domain !== undefined) changes.domain = result.data.domain;
				if (result.data.intervalSeconds !== undefined)
					changes.interval_seconds = result.data.intervalSeconds;
				if (result.data.isEnabled !== undefined) changes.is_enabled = result.data.isEnabled;
				let warningDays = result.data.registrationWarningDays;
				if (warningDays !== undefined && warningDays !== existing.registration_warning_days) {
					changes.registration_warning_days = warningDays;
				}

				let monitor = unwrap(await ctx.models.dnsMonitors.update(dnsMonitorId, changes));
				return apiSuccess({ dnsMonitor: serializeDnsMonitor(monitor) });
			},
		},

		/** DELETE /api/v1/dns-monitors/:dnsMonitorId — deletes a DNS monitor. */
		dnsMonitorDestroy: {
			middleware: [requireApiKey("dns-monitors:write")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let existing = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!existing)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				unwrap(await ctx.models.dnsMonitors.delete(dnsMonitorId));
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/dns-monitors/:dnsMonitorId/results — check-result history. */
		dnsMonitorResults: {
			middleware: [requireApiKey("dns-monitors:read")],
			handler: async (ctx) => {
				let { dnsMonitorId } = s.parse(DNS_MONITOR_ID_PARAMS, ctx.params);
				let monitor = await ctx.models.dnsMonitors
					.inTeam(ctx.apiTeam.id)
					.where({ id: dnsMonitorId })
					.first();
				if (!monitor)
					return apiProblems.notFound({
						detail: "DNS monitor not found",
						instance: problemInstance(),
					});

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(
					ctx.models.dnsMonitorResults.forMonitor(dnsMonitorId),
					{
						orderBy: newestFirst("checked_at"),
						cursor: params.data.cursor,
						limit: params.data.perPage,
					},
				);

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
					id: encodeId("res", row.id),
					status: row.status,
					recordsChecked: row.records_checked,
					recordsChanged: row.records_changed,
					recordsMissing: row.records_missing,
					recordsNew: row.records_new,
					queriesFailed: row.queries_failed,
					responseTimeMs: row.response_time_ms,
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
