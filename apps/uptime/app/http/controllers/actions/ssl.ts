/**
 * Form action for the monitor SSL settings form. A typed expiry date overrides the logs and
 * is classified immediately; an empty one reads the expiry from Certificate Transparency,
 * queuing a lookup so the badge fills in before the daily check.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import { UpdateSslSchema } from "~/app/http/validators/ssl";
import jobs from "~/app/jobs";
import { calculateSslStatus } from "~/app/services/ssl-info";
import routes from "~/routes/web";

/** POST /actions/:team/update-ssl */
export const updateSsl = createAction(routes.actions.monitor.http.updateSsl, async (ctx) => {
	let result = await validate(ctx.formData, UpdateSslSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the SSL settings and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	}

	let { monitor_id, ssl_expires_at, ...values } = result.data;
	let existing = await ctx.models.monitors.inTeam(ctx.team.id).find(monitor_id);
	if (!existing) return notFound("Not Found");

	let manual = Boolean(ssl_expires_at);

	/**
	 * A typed date and issuer are the override. Left empty, the expiry comes from the logs:
	 * a monitor already reading them keeps its last certificate, and one switching to them
	 * starts empty until the queued lookup answers.
	 */
	let fromLogs = !manual && existing.ssl_expiry_source === "transparency" ? existing : null;
	let expiresAt = manual
		? new Date(ssl_expires_at ?? "").getTime()
		: (fromLogs?.ssl_expires_at ?? null);

	let { status } = values.ssl_monitoring_enabled
		? calculateSslStatus(expiresAt, values.ssl_expiry_warning_days)
		: { status: "unknown" as const };

	let update = await ctx.models.monitors.update(monitor_id, {
		ssl_monitoring_enabled: values.ssl_monitoring_enabled,
		ssl_expiry_warning_days: values.ssl_expiry_warning_days,
		ssl_expires_at: expiresAt,
		ssl_issuer: manual ? values.ssl_issuer || null : (fromLogs?.ssl_issuer ?? null),
		ssl_expiry_source: manual ? "manual" : "transparency",
		ssl_transparency_status: fromLogs?.ssl_transparency_status ?? null,
		ssl_status: status,
		ssl_last_checked_at: values.ssl_monitoring_enabled ? Date.now() : null,
	});
	unwrap(update);

	if (values.ssl_monitoring_enabled && !manual) {
		waitUntil(ctx.jobs.enqueue(jobs.checkCertificate, { monitorId: monitor_id }));
	}

	session?.flash("toast", { intent: "success", message: "SSL settings saved." });
	return redirect(
		routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
});
