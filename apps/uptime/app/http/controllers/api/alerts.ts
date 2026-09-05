/**
 * API v1 collection endpoints for alerts: `GET /api/v1/alerts` lists a team's alerts
 * with sensitive channel config (webhook URLs, secrets) stripped, and
 * `POST /api/v1/alerts` creates one for the email/webhook/slack/discord strategy,
 * enforcing the per-team limit. Requires `alerts:read`/`alerts:write` via
 * `requireApiKey`.
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

import type { MonitorScope, MonitorScopeType } from "~/app/lib/monitor-scope";
import type { AlertConfig, SelectAlert } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import { isResolvableScope } from "~/app/data/scope-monitors";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { DEFAULT_COOLDOWN_MINUTES } from "~/app/lib/alert-policy";
import { MONITOR_SCOPE_TYPES, storedMonitorScope } from "~/app/lib/monitor-scope";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { decodeMonitorId, encodeId, encodeMonitorId } from "~/app/services/typed-id";
import routes from "~/routes/web";

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

/** Maps an alert row to a list/get response, stripping webhook URLs and secrets. */
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
			...(alert.config.strategy === "slack" && { channel: alert.config.config.channel }),
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

const commonAlertFields = {
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	notifyOnRecovery: s.defaulted(s.boolean(), true),
	/**
	 * Defaults to {@link DEFAULT_COOLDOWN_MINUTES}, matching the dashboard form's
	 * cadence, so alerts behave consistently regardless of the creating surface.
	 * Callers wanting immediate repeats can still send `0` explicitly.
	 */
	cooldownMinutes: s.defaulted(
		s.number().pipe(checks.min(0), checks.max(1440)),
		DEFAULT_COOLDOWN_MINUTES,
	),
	/**
	 * Which monitor table `monitorId` names, or the whole type to watch on its own.
	 * Optional for compatibility: `monitorId` shipped first and always meant an
	 * HTTP monitor, so an id sent alone still resolves that way (see {@link apiScopeFrom}).
	 */
	monitorType: s.optional(s.enum_(MONITOR_SCOPE_TYPES)),
	monitorId: s.optional(s.string()),
};

const emailAlertSchema = s.object({
	strategy: s.literal("email"),
	email: s.string().pipe(checks.email()),
	subjectPrefix: s.optional(s.string().pipe(checks.maxLength(100))),
	...commonAlertFields,
});

const webhookAlertSchema = s.object({
	strategy: s.literal("webhook"),
	url: s.string().pipe(checks.url()),
	secret: s.optional(s.string().pipe(checks.maxLength(255))),
	...commonAlertFields,
});

const slackAlertSchema = s.object({
	strategy: s.literal("slack"),
	webhookUrl: s.string().pipe(checks.url()),
	channel: s.optional(s.string().pipe(checks.maxLength(100))),
	...commonAlertFields,
});

const discordAlertSchema = s.object({
	strategy: s.literal("discord"),
	webhookUrl: s.string().pipe(checks.url()),
	...commonAlertFields,
});

const CreateAlertSchema = s.variant("strategy", {
	email: emailAlertSchema,
	webhook: webhookAlertSchema,
	slack: slackAlertSchema,
	discord: discordAlertSchema,
});

/**
 * Restates `CreateAlertSchema`'s guaranteed shape by hand: `s.variant()`'s inferred
 * output widens the merged `strategy` field to `string`, so this type gives
 * `buildConfig`'s switch back the literal discriminant it needs to narrow.
 */
type CreateAlertValues =
	| { strategy: "email"; email: string; subjectPrefix?: string; monitorId?: string }
	| { strategy: "webhook"; url: string; secret?: string; monitorId?: string }
	| { strategy: "slack"; webhookUrl: string; channel?: string; monitorId?: string }
	| { strategy: "discord"; webhookUrl: string; monitorId?: string };

/** Builds the strategy-specific `AlertConfig` JSON column from validated input. */
function buildConfig(values: CreateAlertValues): AlertConfig {
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
			return {
				strategy: "slack",
				config: { webhookUrl: values.webhookUrl, channel: values.channel },
			};
		case "discord":
			return { strategy: "discord", config: { webhookUrl: values.webhookUrl } };
	}
}

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const alertsRoutes = {
	alertsIndex: routes.api.v1.alerts.index,
	alertsCreate: routes.api.v1.alerts.create,
};

export default createController(alertsRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/alerts — lists the team's alerts with sensitive config stripped. */
		alertsIndex: {
			middleware: [requireApiKey("alerts:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let alerts = await Alert.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ alerts: alerts.map(serializeAlertSafe) });
			},
		},

		/** POST /api/v1/alerts — creates an alert for the team, up to {@link MAX_ALERTS_PER_TEAM}. */
		alertsCreate: {
			middleware: [requireApiKey("alerts:write")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);

				let existingCount = await Alert.countByTeam(db, ctx.apiTeam.id);
				if (existingCount >= MAX_ALERTS_PER_TEAM) {
					return apiError(
						"LIMIT_EXCEEDED",
						`Maximum of ${MAX_ALERTS_PER_TEAM} alerts per team`,
						BadRequest,
					);
				}

				let result = await validate(ctx.request, CreateAlertSchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				let scope = apiScopeFrom(result.data);
				if (scope === null || !(await isResolvableScope(db, ctx.apiTeam.id, scope))) {
					return apiError("NOT_FOUND", "Monitor not found", NotFound);
				}

				/**
				 * `CreateAlertSchema`'s inferred output loses its per-branch literal discriminant
				 * (see `CreateAlertValues`'s comment); the runtime shape is still guaranteed by
				 * that same schema, so this restates it for `buildConfig`'s exhaustive switch.
				 */
				let alert = await Alert.create(db, ctx.apiTeam.id, {
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
