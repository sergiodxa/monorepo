/**
 * Form actions for alert create/update/delete. Each follows the validate → mutate →
 * flash → redirect pattern: on validation failure the visitor is sent back to the form
 * with an error toast; on success, to the alerts list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound, unprocessableEntity } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import type { AlertConfig } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import {
	AlertIdSchema,
	CreateAlertSchema,
	type CreateAlertValues,
	UpdateAlertSchema,
} from "~/app/http/validators/alert";
import { trackAlertConfigured } from "~/app/services/funnel-events";
import routes from "~/routes/web";

/** Builds the strategy-specific `AlertConfig` JSON column from the flat form values. */
function buildConfig(values: CreateAlertValues): AlertConfig {
	switch (values.strategy) {
		case "email":
			return {
				strategy: "email",
				config: { to: values.email_to ?? "", subjectPrefix: values.email_subject_prefix ?? "" },
			};
		case "webhook":
			return {
				strategy: "webhook",
				config: { url: values.webhook_url ?? "", secret: values.webhook_secret ?? "" },
			};
		case "slack":
			return {
				strategy: "slack",
				config: {
					webhookUrl: values.slack_webhook_url ?? "",
					channel: values.slack_channel || undefined,
				},
			};
		case "discord":
			return { strategy: "discord", config: { webhookUrl: values.discord_webhook_url ?? "" } };
	}
}

/** POST /actions/:team/create-alert */
export const createAlert = createAction(routes.actions.alert.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateAlertSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the alert details and try again.",
		});
		return redirect(routes.app.team.alerts.new.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);

	let existingCount = await Alert.countByTeam(db, ctx.team.id);
	if (existingCount >= MAX_ALERTS_PER_TEAM) {
		return unprocessableEntity(`A team supports at most ${MAX_ALERTS_PER_TEAM} alerts.`);
	}

	let alert = await Alert.create(db, ctx.team.id, {
		name: result.data.name,
		monitor_id: result.data.monitor_id || null,
		notify_on_recovery: result.data.notify_on_recovery,
		cooldown_minutes: result.data.cooldown_minutes,
		config: buildConfig(result.data),
	});

	/**
	 * The count comes from the cap check above rather than a second query, plus this one: the
	 * cap already read it and nothing between the two can have changed it for this team.
	 * Neither the destination nor any part of the config is recorded — three of the four
	 * strategies configure a secret webhook URL and the fourth an address.
	 */
	trackAlertConfigured(ctx.logger, {
		teamId: ctx.team.id,
		alertId: alert.id,
		strategy: result.data.strategy,
		monitorScoped: alert.monitor_id !== null,
		alertCount: existingCount + 1,
	});

	session?.flash("toast", { intent: "success", message: `Alert "${alert.name}" created.` });
	return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/update-alert */
export const updateAlert = createAction(routes.actions.alert.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateAlertSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the alert details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.alerts.index.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let existing = await Alert.findByIdForTeam(db, ctx.team.id, result.data.alert_id);
	if (!existing) return notFound("Not Found");

	await Alert.updateById(db, result.data.alert_id, {
		name: result.data.name,
		monitor_id: result.data.monitor_id || null,
		notify_on_recovery: result.data.notify_on_recovery,
		cooldown_minutes: result.data.cooldown_minutes,
		config: buildConfig(result.data),
	});

	session?.flash("toast", { intent: "success", message: "Alert updated." });
	return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/delete-alert */
export const deleteAlert = createAction(routes.actions.alert.delete, async (ctx) => {
	let result = await validate(ctx.formData, AlertIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await Alert.findByIdForTeam(db, ctx.team.id, result.data.alert_id);
	if (!existing) return notFound("Not Found");

	await Alert.deleteById(db, result.data.alert_id);

	session?.flash("toast", { intent: "success", message: `Alert "${existing.name}" deleted.` });
	return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
