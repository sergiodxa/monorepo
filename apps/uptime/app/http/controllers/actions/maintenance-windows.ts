/**
 * Form actions for maintenance-window create/update/delete/end-early. Each follows
 * the validate → mutate → flash → redirect pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorScope } from "~/app/lib/monitor-scope";

import MaintenanceWindow from "~/app/data/maintenance-window";
import { isResolvableScope } from "~/app/data/scope-monitors";
import {
	CreateMaintenanceWindowSchema,
	MaintenanceWindowIdSchema,
	UpdateMaintenanceWindowSchema,
} from "~/app/http/validators/maintenance-window";
import { parseMonitorScope } from "~/app/lib/monitor-scope";
import routes from "~/routes/web";

/**
 * Reads the submitted scope, or `null` when it is not one the team can be given.
 *
 * Both failures are the same answer on purpose: a value the encoding does not produce and
 * a monitor the team does not own are both "this form was not the one we rendered", and
 * neither should fall back to team-wide — silently widening a window would silence every
 * monitor the team has for the duration.
 */
async function resolveSubmittedScope(
	db: Database,
	teamId: string,
	value: string,
): Promise<MonitorScope | null> {
	let scope = parseMonitorScope(value);
	if (!scope) return null;
	return (await isResolvableScope(db, teamId, scope)) ? scope : null;
}

/** POST /actions/:team/create-maintenance-window */
export const createMaintenanceWindow = createAction(
	routes.actions.maintenanceWindow.create,
	async (ctx) => {
		let result = await validate(ctx.formData, CreateMaintenanceWindowSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			session?.flash("toast", {
				intent: "error",
				message: "Please check the maintenance window details and try again.",
			});
			return redirect(routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let db = getServiceContainer().get(Database);
		let { scope: submittedScope, ...values } = result.data;

		let scope = await resolveSubmittedScope(db, ctx.team.id, submittedScope);
		if (!scope) {
			session?.flash("toast", {
				intent: "error",
				message: "Please check the maintenance window details and try again.",
			});
			return redirect(routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let window = await MaintenanceWindow.create(db, ctx.team.id, {
			...values,
			monitor_type: scope.monitorType,
			monitor_id: scope.monitorId,
		});

		session?.flash("toast", {
			intent: "success",
			message: `Maintenance window "${window.name}" created.`,
		});
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);

/** POST /actions/:team/update-maintenance-window */
export const updateMaintenanceWindow = createAction(
	routes.actions.maintenanceWindow.update,
	async (ctx) => {
		let result = await validate(ctx.formData, UpdateMaintenanceWindowSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			session?.flash("toast", {
				intent: "error",
				message: "Please check the maintenance window details and try again.",
			});
			return redirect(
				ctx.request.headers.get("Referer") ??
					routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
				{ status: redirect.Status.SeeOther },
			);
		}

		let db = getServiceContainer().get(Database);
		let { window_id, scope: submittedScope, ...values } = result.data;
		let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, window_id);
		if (!existing) return notFound("Not Found");

		let scope = await resolveSubmittedScope(db, ctx.team.id, submittedScope);
		if (!scope) {
			session?.flash("toast", {
				intent: "error",
				message: "Please check the maintenance window details and try again.",
			});
			return redirect(
				ctx.request.headers.get("Referer") ??
					routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
				{ status: redirect.Status.SeeOther },
			);
		}

		await MaintenanceWindow.updateById(db, window_id, {
			...values,
			monitor_type: scope.monitorType,
			monitor_id: scope.monitorId,
		});

		session?.flash("toast", { intent: "success", message: "Maintenance window updated." });
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);

/** DELETE /actions/:team/delete-maintenance-window */
export const deleteMaintenanceWindow = createAction(
	routes.actions.maintenanceWindow.delete,
	async (ctx) => {
		let result = await validate(ctx.formData, MaintenanceWindowIdSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
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
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);

/** POST /actions/:team/end-maintenance-window */
export const endMaintenanceWindow = createAction(
	routes.actions.maintenanceWindow.end,
	async (ctx) => {
		let result = await validate(ctx.formData, MaintenanceWindowIdSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let db = getServiceContainer().get(Database);
		let existing = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, result.data.window_id);
		if (!existing) return notFound("Not Found");

		await MaintenanceWindow.endEarly(db, result.data.window_id);

		session?.flash("toast", { intent: "success", message: `Ended "${existing.name}" early.` });
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
