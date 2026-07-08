/**
 * Form actions for maintenance-window create/update/delete/end-early. Each follows
 * the validate → mutate → flash → redirect pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

import MaintenanceWindow from "~/app/data/maintenance-window";
import {
	CreateMaintenanceWindowSchema,
	MaintenanceWindowIdSchema,
	UpdateMaintenanceWindowSchema,
} from "~/app/http/validators/maintenance-window";
import routes from "~/routes/web";

/** POST /actions/:team/create-maintenance-window */
export async function createMaintenanceWindow(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, CreateMaintenanceWindowSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the maintenance window details and try again.",
		});
		return redirect(routes.app.team.maintenanceWindowNew.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, ...values } = result.data;
	let window = await MaintenanceWindow.create(db, ctx.team.id, {
		...values,
		monitor_id: monitor_id || null,
	});

	session?.flash("toast", {
		intent: "success",
		message: `Maintenance window "${window.name}" created.`,
	});
	return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** POST /actions/:team/update-maintenance-window */
export async function updateMaintenanceWindow(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, UpdateMaintenanceWindowSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the maintenance window details and try again.",
		});
		return redirect(
			ctx.request.headers.get("Referer") ??
				routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }),
			{ status: redirect.Status.SeeOther },
		);
	}

	let db = getServiceContainer().get(Database);
	let { window_id, monitor_id, ...values } = result.data;
	let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, window_id);
	if (!existing) return notFound("Not Found");

	await MaintenanceWindow.updateById(db, window_id, { ...values, monitor_id: monitor_id || null });

	session?.flash("toast", { intent: "success", message: "Maintenance window updated." });
	return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** DELETE /actions/:team/delete-maintenance-window */
export async function deleteMaintenanceWindow(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, MaintenanceWindowIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, result.data.window_id);
	if (!existing) return notFound("Not Found");

	await MaintenanceWindow.deleteById(db, result.data.window_id);

	session?.flash("toast", {
		intent: "success",
		message: `Maintenance window "${existing.name}" deleted.`,
	});
	return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** POST /actions/:team/end-maintenance-window */
export async function endMaintenanceWindow(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, MaintenanceWindowIdSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, result.data.window_id);
	if (!existing) return notFound("Not Found");

	await MaintenanceWindow.endEarly(db, result.data.window_id);

	session?.flash("toast", { intent: "success", message: `Ended "${existing.name}" early.` });
	return redirect(routes.app.team.maintenanceWindows.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}
