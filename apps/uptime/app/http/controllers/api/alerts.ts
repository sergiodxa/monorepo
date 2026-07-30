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

import { BadRequest, Created, NotFound } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/fetch-router";

import type { AlertConfig, SelectAlert } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** Maps an alert row to a list/get response, stripping webhook URLs and secrets. */
export function serializeAlertSafe(alert: SelectAlert) {
	return {
		id: alert.id,
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
		monitorId: alert.monitor_id,
		createdAt: alert.created_at,
		updatedAt: alert.updated_at,
	};
}

/** Maps an alert row to a create/update response, exposing only the strategy name. */
export function serializeAlertStrategyOnly(alert: SelectAlert) {
	return {
		id: alert.id,
		name: alert.name,
		notifyOnRecovery: alert.notify_on_recovery,
		cooldownMinutes: alert.cooldown_minutes,
		monitorId: alert.monitor_id,
		config: { strategy: alert.config.strategy },
		createdAt: alert.created_at,
		updatedAt: alert.updated_at,
	};
}

const commonAlertFields = {
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	notifyOnRecovery: s.defaulted(s.boolean(), true),
	cooldownMinutes: s.defaulted(s.number().pipe(checks.min(0), checks.max(1440)), 0),
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
 * `s.variant()`'s inferred output loses the per-branch literal discriminant when the
 * branches are combined into a union (the merged `strategy` field widens to `string`),
 * so `buildConfig` below can't narrow via a plain `switch`. The runtime validation via
 * `CreateAlertSchema` already guarantees one of these four shapes; this type restates
 * that guarantee by hand so the exhaustive switch narrows correctly.
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

				if (result.data.monitorId) {
					let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, result.data.monitorId);
					if (!monitor) return apiError("NOT_FOUND", "Monitor not found", NotFound);
				}

				/**
				 * `CreateAlertSchema`'s inferred output loses its per-branch literal discriminant
				 * (see `CreateAlertValues`'s comment); the runtime shape is still guaranteed by
				 * that same schema, so this restates it for `buildConfig`'s exhaustive switch.
				 */
				let alert = await Alert.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					monitor_id: result.data.monitorId ?? null,
					notify_on_recovery: result.data.notifyOnRecovery,
					cooldown_minutes: result.data.cooldownMinutes,
					config: buildConfig(result.data as CreateAlertValues),
				});

				return apiSuccess({ alert: serializeAlertStrategyOnly(alert) }, Created);
			},
		},
	},
});
