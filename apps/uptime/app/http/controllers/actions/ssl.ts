/**
 * Form action for the monitor SSL settings form. Parses the manually entered expiry
 * date and classifies the certificate status immediately (see `app/services/ssl-info.ts`)
 * so the badge is accurate right after saving, ahead of the automated daily check job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import Monitor from "~/app/data/monitor";
import { UpdateSslSchema } from "~/app/http/validators/ssl";
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

	let db = getServiceContainer().get(Database);
	let { monitor_id, ssl_expires_at, ...values } = result.data;
	let existing = await Monitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!existing) return notFound("Not Found");

	let expiresAt = ssl_expires_at ? new Date(ssl_expires_at).getTime() : null;
	let { status } = values.ssl_monitoring_enabled
		? calculateSslStatus(expiresAt, values.ssl_expiry_warning_days)
		: { status: "unknown" as const };

	await Monitor.updateById(db, monitor_id, {
		ssl_monitoring_enabled: values.ssl_monitoring_enabled,
		ssl_expiry_warning_days: values.ssl_expiry_warning_days,
		ssl_expires_at: expiresAt,
		ssl_issuer: values.ssl_issuer || null,
		ssl_status: status,
		ssl_last_checked_at: values.ssl_monitoring_enabled ? Date.now() : null,
	});

	session?.flash("toast", { intent: "success", message: "SSL settings saved." });
	return redirect(
		routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
});
