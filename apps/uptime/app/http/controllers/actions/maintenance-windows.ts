/**
 * Form actions for maintenance-window create/update/delete/end-early. Each follows
 * the validate → mutate → flash → redirect pattern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { MonitorScope } from "~/app/lib/monitor-scope";
import type { UptimeModels } from "~/app/models";

import {
	CreateMaintenanceWindowSchema,
	MaintenanceWindowIdSchema,
	UpdateMaintenanceWindowSchema,
} from "~/app/http/validators/maintenance-window";
import { parseMonitorScope } from "~/app/lib/monitor-scope";
import { isResolvableScope } from "~/app/services/scope-monitors";
import routes from "~/routes/web";

/**
 * Resolves the submitted scope only when it names a monitor the team actually owns;
 * an unparseable value or a monitor outside the team both come back as `null` so the
 * caller can ask for a fresh submission, keeping the window scoped to an owned monitor.
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

		let { scope: submittedScope, ...values } = result.data;

		let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, submittedScope);
		if (!scope) {
			session?.flash("toast", {
				intent: "error",
				message: "Please check the maintenance window details and try again.",
			});
			return redirect(routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let window = unwrap(
			await ctx.models.maintenanceWindows.create({
				...values,
				team_id: ctx.team.id,
				monitor_type: scope.monitorType,
				monitor_id: scope.monitorId,
			}),
		);

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

		let { window_id, scope: submittedScope, ...values } = result.data;
		let existing = await ctx.models.maintenanceWindows.inTeam(ctx.team.id).find(window_id);
		if (!existing) return notFound("Not Found");

		let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, submittedScope);
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

		unwrap(
			await ctx.models.maintenanceWindows.update(window_id, {
				...values,
				monitor_type: scope.monitorType,
				monitor_id: scope.monitorId,
			}),
		);

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

		let existing = await ctx.models.maintenanceWindows
			.inTeam(ctx.team.id)
			.find(result.data.window_id);
		if (!existing) return notFound("Not Found");

		unwrap(await ctx.models.maintenanceWindows.delete(result.data.window_id));

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

		let existing = await ctx.models.maintenanceWindows
			.inTeam(ctx.team.id)
			.find(result.data.window_id);
		if (!existing) return notFound("Not Found");

		unwrap(await ctx.models.maintenanceWindows.endEarly(result.data.window_id));

		session?.flash("toast", { intent: "success", message: `Ended "${existing.name}" early.` });
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
