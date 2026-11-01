/**
 * Form actions for alert create/update/delete. A refused create or update renders its form
 * again with every posted value and an issue beside each field to fix, answered as 400; a
 * success flashes a toast and redirects to the alerts list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound, unprocessableEntity } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { UptimeModels } from "~/app/models";
import type { MonitorScope } from "~/app/services/monitor-scope";
import type { AlertConfig } from "~/database/schema";

import {
	AlertIdSchema,
	CreateAlertSchema,
	type CreateAlertValues,
	UpdateAlertSchema,
} from "~/app/http/validators/alert";
import { translateIssues } from "~/app/http/validators/form-submission";
import { MAX_ALERTS_PER_TEAM } from "~/app/models/alerts";
import { checkEmailAddress } from "~/app/services/email-address";
import { trackAlertConfigured } from "~/app/services/funnel-events";
import { parseMonitorScope } from "~/app/services/monitor-scope";
import { isResolvableScope } from "~/app/services/scope-monitors";
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
				config: {
					url: values.webhook_url ?? "",
					secret: values.webhook_secret ?? "",
					signature: values.webhook_signature,
				},
			};
		case "slack":
			return { strategy: "slack", config: { webhookUrl: values.slack_webhook_url ?? "" } };
		case "discord":
			return { strategy: "discord", config: { webhookUrl: values.discord_webhook_url ?? "" } };
		case "pagerduty":
			return {
				strategy: "pagerduty",
				config: { routingKey: values.pagerduty_routing_key ?? "" },
			};
	}
}

/**
 * Reads the submitted scope, or `null` when it is not one the team can be given.
 * An unparseable value and a monitor the team does not own both resolve to the
 * same `null`, so the alert stays scoped to a monitor the team actually owns.
 */
async function resolveSubmittedScope(
	models: UptimeModels,
	teamId: string,
	value: string,
): Promise<MonitorScope | null> {
	let scope = parseMonitorScope(value);
	if (!scope) return null;
	return (await isResolvableScope(models, teamId, scope)) ? scope : null;
}

/**
 * The domain an email alert's recipient cannot receive mail at, or `null` when the alert
 * sends somewhere else or its recipient's domain receives mail.
 */
async function undeliverableDomain(values: CreateAlertValues): Promise<string | null> {
	if (values.strategy !== "email" || !values.email_to) return null;
	let checked = await checkEmailAddress(values.email_to);
	return isFailure(checked) ? checked.error.domain : null;
}

/** The field each channel requires, where an issue about the channel as a whole is shown. */
const CHANNEL_FIELD: Record<CreateAlertValues["strategy"], string> = {
	email: "email_to",
	webhook: "webhook_url",
	slack: "slack_webhook_url",
	discord: "discord_webhook_url",
	pagerduty: "pagerduty_routing_key",
};

/** The `page.alerts.form.issues` key per field the form can flag. */
const ISSUE_KEYS: Record<string, string> = {
	name: "name",
	scope: "scope",
	strategy: "strategy",
	cooldown_minutes: "cooldownMinutes",
	email_to: "emailTo",
	webhook_url: "webhookUrl",
	slack_webhook_url: "slackWebhookUrl",
	discord_webhook_url: "discordWebhookUrl",
	pagerduty_routing_key: "pagerdutyRoutingKey",
};

/**
 * The submission as the form page renders it again, each schema issue in the page's own
 * words. A rule about the chosen channel names no field, so it lands on the field that
 * channel requires, which is the one the person sees.
 */
function alertSubmission(
	t: (key: string, values?: Record<string, unknown>) => string,
	values: FormData,
	issues: ReadonlyArray<{
		message: string;
		path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
	}>,
): FormSubmission {
	let strategy = values.get("strategy");
	let channelField =
		typeof strategy === "string" && strategy in CHANNEL_FIELD
			? CHANNEL_FIELD[strategy as CreateAlertValues["strategy"]]
			: undefined;

	return {
		values,
		issues: translateIssues(issues, (field) => {
			let target = field ?? channelField;
			let key = target === undefined ? undefined : ISSUE_KEYS[target];
			return key === undefined
				? { field: undefined, message: t("page.alerts.form.issues.generic") }
				: { field: target, message: t(`page.alerts.form.issues.${key}`) };
		}),
	};
}

/** Renders the new-alert form again with `submission`, loading the page only on this path. */
async function sendBackToNew(submission: FormSubmission): Promise<Response> {
	let { renderNewAlertPage } = await import("~/app/http/controllers/app/team/alert-new");
	return renderNewAlertPage(submission);
}

/** POST /actions/:team/create-alert */
export const createAlert = createAction(routes.actions.alert.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateAlertSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return sendBackToNew(alertSubmission(ctx.intl.t, ctx.formData, result.error.issues));
	}

	let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, result.data.scope);
	if (!scope) {
		return sendBackToNew(
			alertSubmission(ctx.intl.t, ctx.formData, [{ message: "scope", path: ["scope"] }]),
		);
	}

	let undeliverable = await undeliverableDomain(result.data);
	if (undeliverable !== null) {
		return sendBackToNew({
			values: ctx.formData,
			issues: [
				{
					message: ctx.intl.t("actions.emailAddress.noMailServer", { domain: undeliverable }),
					path: ["email_to"],
				},
			],
		});
	}

	let existingCount = await ctx.models.alerts.inTeam(ctx.team.id).count();
	if (existingCount >= MAX_ALERTS_PER_TEAM) {
		return unprocessableEntity(`A team supports at most ${MAX_ALERTS_PER_TEAM} alerts.`);
	}

	let alert = unwrap(
		await ctx.models.alerts.create({
			team_id: ctx.team.id,
			name: result.data.name,
			monitor_type: scope.monitorType,
			monitor_id: scope.monitorId,
			notify_on_recovery: result.data.notify_on_recovery,
			cooldown_minutes: result.data.cooldown_minutes,
			config: buildConfig(result.data),
		}),
	);

	/**
	 * Reuses the count from the cap check above, which nothing between the two calls
	 * could have changed for this team. Only the alert's shape is logged, keeping
	 * webhook URLs and email addresses out of it.
	 */
	trackAlertConfigured(ctx.log, {
		teamId: ctx.team.id,
		alertId: alert.id,
		strategy: result.data.strategy,
		monitorScoped: alert.monitor_id !== null,
		alertCount: existingCount + 1,
	});

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.alerts.toasts.created", { name: alert.name }),
	});
	return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/update-alert */
export const updateAlert = createAction(routes.actions.alert.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateAlertSchema);
	let session = ctx.get(Session);

	let alertId = isFailure(result) ? ctx.formData.get("alert_id") : result.data.alert_id;
	let existing =
		typeof alertId === "string" ? await ctx.models.alerts.inTeam(ctx.team.id).find(alertId) : null;
	if (!existing) return notFound("Not Found");

	/** Renders this alert's edit form again with `submission`, loading the page only on this path. */
	let sendBack = async (submission: FormSubmission) => {
		let { renderEditAlertPage } = await import("~/app/http/controllers/app/team/alert-edit");
		return renderEditAlertPage(existing, submission);
	};

	if (isFailure(result)) {
		return sendBack(alertSubmission(ctx.intl.t, ctx.formData, result.error.issues));
	}

	let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, result.data.scope);
	if (!scope) {
		return sendBack(
			alertSubmission(ctx.intl.t, ctx.formData, [{ message: "scope", path: ["scope"] }]),
		);
	}

	let undeliverable = await undeliverableDomain(result.data);
	if (undeliverable !== null) {
		return sendBack({
			values: ctx.formData,
			issues: [
				{
					message: ctx.intl.t("actions.emailAddress.noMailServer", { domain: undeliverable }),
					path: ["email_to"],
				},
			],
		});
	}

	unwrap(
		await ctx.models.alerts.update(result.data.alert_id, {
			name: result.data.name,
			monitor_type: scope.monitorType,
			monitor_id: scope.monitorId,
			notify_on_recovery: result.data.notify_on_recovery,
			cooldown_minutes: result.data.cooldown_minutes,
			config: buildConfig(result.data),
		}),
	);

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.alerts.toasts.updated", { name: result.data.name }),
	});
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

	let existing = await ctx.models.alerts.inTeam(ctx.team.id).find(result.data.alert_id);
	if (!existing) return notFound("Not Found");

	unwrap(await ctx.models.alerts.delete(result.data.alert_id));

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("page.alerts.toasts.deleted", { name: existing.name }),
	});
	return redirect(routes.app.team.alerts.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
