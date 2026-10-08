/**
 * API v1 collection endpoints for alerts: `GET /api/v1/alerts` lists a team's alerts
 * with sensitive channel config (webhook URLs, secrets, integration keys) stripped, and
 * `POST /api/v1/alerts` creates one for any channel strategy,
 * enforcing the per-team limit. Requires `alerts:read`/`alerts:write` via
 * `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";
import type { AlertConfig, SelectAlert } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import { isResolvableScope } from "~/app/data/scope-monitors";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import idempotent from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_ALERT_BODY } from "~/app/http/openapi/alerts";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { refuseUndeliverableRecipient } from "~/app/services/email-address";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { decodeMonitorId, encodeId, encodeMonitorId } from "~/app/services/typed-id";
import { alertsRoutes } from "~/routes/api-groups";

/**
 * The monitor scope a request asks for, resolved from `monitorType`/`monitorId`.
 * A `monitorId` alone resolves to HTTP: that pairing was the API's only scoping
 * before `monitorType` existed, and every client sending one still means that.
 *
 * Returns null when the id carries a prefix belonging to another monitor type, which
 * names a monitor that cannot exist. Reporting that separately is what keeps such a
 * request from falling back to a null id, since a null id scopes the rule to every
 * monitor of the type instead of the one that was asked for.
 */
export function apiScopeFrom(input: {
	monitorType?: MonitorScopeType;
	monitorId?: string | null;
}): MonitorScope | null {
	let value = input.monitorId ?? null;
	let monitorType = input.monitorType ?? (value === null ? null : "http");
	if (value === null) return { monitorType, monitorId: null };

	let monitorId = decodeMonitorId(monitorType, value);
	if (monitorId === null) return null;
	return { monitorType, monitorId };
}

/** Maps an alert row to a list/get response, stripping webhook URLs, secrets and integration keys. */
export function serializeAlertSafe(alert: SelectAlert) {
	let scope = storedMonitorScope(alert);
	return {
		id: encodeId("alt", alert.id),
		name: alert.name,
		notifyOnRecovery: alert.notify_on_recovery,
		cooldownMinutes: alert.cooldown_minutes,
		config: {
			strategy: alert.config.strategy,
			...(alert.config.strategy === "email" && {
				to: alert.config.config.to,
				subjectPrefix: alert.config.config.subjectPrefix,
			}),
		},
		monitorType: scope.monitorType,
		monitorId:
			scope.monitorId === null ? null : encodeMonitorId(scope.monitorType, scope.monitorId),
		createdAt: alert.created_at,
		updatedAt: alert.updated_at,
	};
}

/** Maps an alert row to a create/update response, exposing only the strategy name. */
export function serializeAlertStrategyOnly(alert: SelectAlert) {
	let scope = storedMonitorScope(alert);
	return {
		id: encodeId("alt", alert.id),
		name: alert.name,
		notifyOnRecovery: alert.notify_on_recovery,
		cooldownMinutes: alert.cooldown_minutes,
		monitorType: scope.monitorType,
		monitorId:
			scope.monitorId === null ? null : encodeMonitorId(scope.monitorType, scope.monitorId),
		config: { strategy: alert.config.strategy },
		createdAt: alert.created_at,
		updatedAt: alert.updated_at,
	};
}

/**
 * Restates `CREATE_ALERT_BODY`'s guaranteed shape by hand: `s.variant()`'s inferred
 * output widens the merged `strategy` field to `string`, so this type gives
 * `buildConfig`'s switch back the literal discriminant it needs to narrow.
 */
export type CreateAlertValues =
	| { strategy: "email"; email: string; subjectPrefix?: string; monitorId?: string }
	| { strategy: "webhook"; url: string; secret?: string; monitorId?: string }
	| { strategy: "slack"; webhookUrl: string; monitorId?: string }
	| { strategy: "discord"; webhookUrl: string; monitorId?: string }
	| { strategy: "pagerduty"; routingKey: string; monitorId?: string };

/** Builds the strategy-specific `AlertConfig` JSON column from validated input. */
export function buildConfig(values: CreateAlertValues): AlertConfig {
	switch (values.strategy) {
		case "email":
			return {
				strategy: "email",
				config: { to: values.email, subjectPrefix: values.subjectPrefix ?? "" },
			};
		case "webhook":
			return {
				strategy: "webhook",
				config: { url: values.url, secret: values.secret ?? "" },
			};
		case "slack":
			return { strategy: "slack", config: { webhookUrl: values.webhookUrl } };
		case "discord":
			return { strategy: "discord", config: { webhookUrl: values.webhookUrl } };
		case "pagerduty":
			return { strategy: "pagerduty", config: { routingKey: values.routingKey } };
	}
}

export default createController(alertsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/alerts — lists the team's alerts with sensitive config stripped. */
		alertsIndex: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = Alert.listByTeamQuery(ctx.db, ctx.apiTeam.id);

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

				return apiPage({ alerts: page.data.items.map(serializeAlertSafe) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/alerts — creates an alert for the team, up to {@link MAX_ALERTS_PER_TEAM}. */
		alertsCreate: {
			middleware: [requireApiKey("alerts:write"), idempotent],
			handler: async (ctx) => {
				let existingCount = await Alert.countByTeam(ctx.db, ctx.apiTeam.id);
				if (existingCount >= MAX_ALERTS_PER_TEAM) {
					return apiProblems.limitExceeded({
						detail: `Maximum of ${MAX_ALERTS_PER_TEAM} alerts per team`,
						instance: problemInstance(),
					});
				}

				let result = await validate(ctx.request, CREATE_ALERT_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				let scope = apiScopeFrom(result.data);
				if (scope === null || !(await isResolvableScope(ctx.db, ctx.apiTeam.id, scope))) {
					return apiProblems.notFound({ detail: "Monitor not found", instance: problemInstance() });
				}

				if (result.data.strategy === "email") {
					let undeliverable = await refuseUndeliverableRecipient(result.data.email, "/email");
					if (undeliverable) return undeliverable;
				}

				/**
				 * `CREATE_ALERT_BODY`'s inferred output loses its per-branch literal discriminant
				 * (see `CreateAlertValues`'s comment); the runtime shape is still guaranteed by
				 * that same schema, so this restates it for `buildConfig`'s exhaustive switch.
				 */
				let alert = await Alert.create(ctx.db, ctx.apiTeam.id, {
					name: result.data.name,
					monitor_type: scope.monitorType,
					monitor_id: scope.monitorId,
					notify_on_recovery: result.data.notifyOnRecovery,
					cooldown_minutes: result.data.cooldownMinutes,
					config: buildConfig(result.data as CreateAlertValues),
				});

				return apiSuccess({ alert: serializeAlertStrategyOnly(alert) }, Created);
			},
		},
	},
});
