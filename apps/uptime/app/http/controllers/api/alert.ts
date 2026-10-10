/**
 * API v1 item endpoints for a single alert: get/update/delete (`alerts:read`/
 * `alerts:write`) and its delivery-event history (`alerts:read`). `PATCH` reads a JSON
 * merge patch over the alert as its create body spells it, channel settings included;
 * `PUT` writes only `name`/`notifyOnRecovery`/`cooldownMinutes` and the scope pair.
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

import type { CreateAlertValues } from "~/app/http/controllers/api/alerts";
import type { InsertAlert, SelectAlert } from "~/database/schema";

import {
	apiScopeFrom,
	buildConfig,
	serializeAlertSafe,
	serializeAlertStrategyOnly,
} from "~/app/http/controllers/api/alerts";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { ALERT_ID_PARAMS, CREATE_ALERT_BODY, UPDATE_ALERT_BODY } from "~/app/http/openapi/alerts";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { readApiUpdate } from "~/app/services/api-update";
import { refuseUndeliverableRecipient } from "~/app/services/email-address";
import { apiPage, newestFirst, PAGING } from "~/app/services/pagination";
import { isResolvableScope } from "~/app/services/scope-monitors";
import { encodeId, encodeMonitorId } from "~/app/services/typed-id";
import { alertRoutes } from "~/routes/api-groups";

/** The members that make up an alert's channel, rebuilt together when any of them changes. */
const CHANNEL_MEMBERS = [
	"strategy",
	"email",
	"subjectPrefix",
	"url",
	"secret",
	"webhookUrl",
	"routingKey",
] as const;

/**
 * The alert's writable members as its create body spells them, the target an update's
 * merge patch applies to. The channel's secrets are part of it so the patched alert still
 * validates; they never leave the server.
 */
function writableAlert(alert: SelectAlert) {
	let scope = storedMonitorScope(alert);
	return {
		name: alert.name,
		notifyOnRecovery: alert.notify_on_recovery,
		cooldownMinutes: alert.cooldown_minutes,
		monitorType: scope.monitorType,
		monitorId:
			scope.monitorId === null ? null : encodeMonitorId(scope.monitorType, scope.monitorId),
		...writableChannel(alert),
	};
}

/** The stored channel config in the create body's flat spelling. */
function writableChannel(alert: SelectAlert) {
	switch (alert.config.strategy) {
		case "email":
			return {
				strategy: "email",
				email: alert.config.config.to,
				subjectPrefix: alert.config.config.subjectPrefix,
			};
		case "webhook":
			return {
				strategy: "webhook",
				url: alert.config.config.url,
				secret: alert.config.config.secret,
			};
		case "slack":
			return { strategy: "slack", webhookUrl: alert.config.config.webhookUrl };
		case "discord":
			return { strategy: "discord", webhookUrl: alert.config.config.webhookUrl };
		case "pagerduty":
			return { strategy: "pagerduty", routingKey: alert.config.config.routingKey };
	}
}

/**
 * Applies a `PATCH` merge patch to one alert, writing only the members it changed.
 * A changed `monitorType` alone widens to the whole type, a removed `monitorId` alone
 * widens to every monitor, and any changed channel member rebuilds the channel config.
 *
 * @param ctx - The request, after `requireApiKey("alerts:write")`.
 * @returns The updated alert; a 404 for an alert outside the team, before the body is read.
 */
async function patchAlert(ctx: RequestContext): Promise<Response> {
	let { alertId } = s.parse(ALERT_ID_PARAMS, ctx.params);
	let existing = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
	if (!existing)
		return apiProblems.notFound({ detail: "Alert not found", instance: problemInstance() });

	let update = await readApiUpdate(ctx.request, writableAlert(existing), CREATE_ALERT_BODY);
	if (update instanceof Response) return update;
	let { value, changed } = update;

	let changes: Partial<InsertAlert> = {};
	if (changed.has("name")) changes.name = value.name;
	if (changed.has("notifyOnRecovery")) changes.notify_on_recovery = value.notifyOnRecovery;
	if (changed.has("cooldownMinutes")) changes.cooldown_minutes = value.cooldownMinutes;

	/** Checked only when the patch sets the recipient, so an unrelated edit costs no lookup. */
	if (value.strategy === "email" && changed.has("email")) {
		let undeliverable = await refuseUndeliverableRecipient(value.email, "/email");
		if (undeliverable) return undeliverable;
	}

	/**
	 * `CREATE_ALERT_BODY`'s inferred output loses its per-branch literal discriminant (see
	 * `CreateAlertValues`); the same schema just validated the runtime shape.
	 */
	if (CHANNEL_MEMBERS.some((member) => changed.has(member)))
		changes.config = buildConfig(value as CreateAlertValues);

	if (changed.has("monitorType") || changed.has("monitorId")) {
		let scope = apiScopeFrom({
			monitorType: changed.has("monitorType") ? value.monitorType : undefined,
			monitorId: changed.has("monitorId") ? (value.monitorId ?? null) : undefined,
		});
		if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
			return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
		}

		changes.monitor_type = scope.monitorType;
		changes.monitor_id = scope.monitorId;
	}

	let alert = unwrap(await ctx.models.alerts.update(alertId, changes));
	return apiSuccess({ alert: serializeAlertStrategyOnly(alert) });
}

export default createController(alertRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/alerts/:alertId — a single alert with sensitive config stripped. */
		alertShow: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(ALERT_ID_PARAMS, ctx.params);
				let alert = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
				if (!alert)
					return apiProblems.notFound({ detail: "Alert not found", instance: problemInstance() });
				return apiSuccess({ alert: serializeAlertSafe(alert) });
			},
		},

		/** PATCH /api/v1/alerts/:alertId — merge-patches an alert. */
		alertPatch: {
			middleware: [requireApiKey("alerts:write")],
			handler: patchAlert,
		},

		/** PUT /api/v1/alerts/:alertId — updates an alert's non-channel fields. */
		alertUpdate: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(ALERT_ID_PARAMS, ctx.params);
				let existing = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
				if (!existing)
					return apiProblems.notFound({ detail: "Alert not found", instance: problemInstance() });

				let result = await validate(ctx.request, UPDATE_ALERT_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let changes: Partial<InsertAlert> = {};
				if (result.data.name !== undefined) changes.name = result.data.name;
				if (result.data.notifyOnRecovery !== undefined)
					changes.notify_on_recovery = result.data.notifyOnRecovery;
				if (result.data.cooldownMinutes !== undefined)
					changes.cooldown_minutes = result.data.cooldownMinutes;

				/**
				 * The scope moves as a unit: sending either field rewrites both together, so
				 * narrowing an alert to a whole type also clears the previous monitor id, and
				 * omitting both fields keeps the alert's current scope.
				 */
				if (result.data.monitorType !== undefined || result.data.monitorId !== undefined) {
					let scope = apiScopeFrom(result.data);
					if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
						return apiProblems.notFound({
							detail: "Monitor not found",
							instance: problemInstance(),
						});
					}

					changes.monitor_type = scope.monitorType;
					changes.monitor_id = scope.monitorId;
				}

				let alert = unwrap(await ctx.models.alerts.update(alertId, changes));
				return apiSuccess({ alert: serializeAlertStrategyOnly(alert) });
			},
		},

		/** DELETE /api/v1/alerts/:alertId — deletes an alert. */
		alertDestroy: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let { alertId } = s.parse(ALERT_ID_PARAMS, ctx.params);
				let existing = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
				if (!existing)
					return apiProblems.notFound({ detail: "Alert not found", instance: problemInstance() });

				unwrap(await ctx.models.alerts.delete(alertId));
				return apiSuccess({ deleted: true });
			},
		},

		/** GET /api/v1/alerts/:alertId/events — delivery-event history for one alert. */
		alertEvents: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let { alertId } = s.parse(ALERT_ID_PARAMS, ctx.params);
				let alert = await ctx.models.alerts.inTeam(ctx.apiTeam.id).find(alertId);
				if (!alert)
					return apiProblems.notFound({ detail: "Alert not found", instance: problemInstance() });

				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				let page = await Pagination.byKeyset(ctx.models.alertEvents.forAlert(alertId), {
					orderBy: newestFirst("sent_at"),
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

				let events = page.data.items.map((event) => ({
					id: encodeId("evt", event.id),
					alertId: encodeId("alt", event.alert_id),
					monitorId: encodeMonitorId(event.monitor_type, event.monitor_id),
					eventType: event.event_type,
					status: event.status,
					sentAt: event.sent_at,
					errorMessage: event.error_message,
					createdAt: event.created_at,
				}));

				return apiPage({ events }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
				});
			},
		},
	},
});
