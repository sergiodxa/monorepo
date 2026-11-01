/**
 * Form actions for maintenance-window create/update/delete/end-early. A refused create or
 * update renders its form again with every posted value and an issue beside each field to
 * fix, answered as 422; every success flashes a toast and redirects to the list.
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

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { UptimeModels } from "~/app/models";
import type { MonitorScope } from "~/app/services/monitor-scope";

import { translateIssues } from "~/app/http/validators/form-submission";
import {
	CreateMaintenanceWindowSchema,
	MaintenanceWindowIdSchema,
	UpdateMaintenanceWindowSchema,
} from "~/app/http/validators/maintenance-window";
import { parseMonitorScope } from "~/app/services/monitor-scope";
import { isResolvableScope, listScopeMonitors } from "~/app/services/scope-monitors";
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

/** The `page.maintenanceWindows.form.issues` key per field the form can flag. */
const ISSUE_KEYS: Record<string, string> = {
	name: "name",
	scope: "scope",
	starts_at: "startsAt",
	ends_at: "endsAt",
};

/**
 * The submission as the form page renders it again, each schema issue in the page's own
 * words. The one rule naming no field compares the two clocks, so it lands on the end time.
 */
function windowSubmission(
	t: (key: string) => string,
	values: FormData,
	issues: ReadonlyArray<{
		message: string;
		path?: ReadonlyArray<PropertyKey | { key: PropertyKey }>;
	}>,
): FormSubmission {
	return {
		values,
		issues: translateIssues(issues, (field) => {
			if (field === undefined) {
				return {
					field: "ends_at",
					message: t("page.maintenanceWindows.form.issues.endsBeforeStart"),
				};
			}
			let key = ISSUE_KEYS[field];
			return key === undefined
				? { field: undefined, message: t("page.maintenanceWindows.form.issues.generic") }
				: { field, message: t(`page.maintenanceWindows.form.issues.${key}`) };
		}),
	};
}

/** The issue a scope naming no monitor the team owns renders under the scope picker. */
const SCOPE_ISSUE = [{ message: "scope", path: ["scope"] }];

/** POST /actions/:team/create-maintenance-window */
export const createMaintenanceWindow = createAction(
	routes.actions.maintenanceWindow.create,
	async (ctx) => {
		let result = await validate(ctx.formData, CreateMaintenanceWindowSchema);
		let session = ctx.get(Session);

		/** Renders the new-window form again, answered as 422, loading the page only on this path. */
		let sendBack = async (submission: FormSubmission) => {
			let [{ default: NewMaintenanceWindowPage }, scopeGroups] = await Promise.all([
				import("~/resources/views/maintenance-windows/new-page"),
				listScopeMonitors(ctx.models, ctx.team.id),
			]);
			return ctx.render(
				<NewMaintenanceWindowPage scopeGroups={scopeGroups} submission={submission} />,
				{ status: 422 },
			);
		};

		if (isFailure(result)) {
			return sendBack(windowSubmission(ctx.intl.t, ctx.formData, result.error.issues));
		}

		let { scope: submittedScope, ...values } = result.data;

		let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, submittedScope);
		if (!scope) return sendBack(windowSubmission(ctx.intl.t, ctx.formData, SCOPE_ISSUE));

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
			message: ctx.intl.t("page.maintenance.toasts.created", { name: window.name }),
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

		let windowId = isFailure(result) ? ctx.formData.get("window_id") : result.data.window_id;
		let existing =
			typeof windowId === "string"
				? await ctx.models.maintenanceWindows.inTeam(ctx.team.id).find(windowId)
				: null;
		if (!existing) return notFound("Not Found");

		/** Renders this window's edit form again, answered as 422, loading the page only on this path. */
		let sendBack = async (submission: FormSubmission) => {
			let [{ default: EditMaintenanceWindowPage }, scopeGroups] = await Promise.all([
				import("~/resources/views/maintenance-windows/edit-page"),
				listScopeMonitors(ctx.models, ctx.team.id),
			]);
			return ctx.render(
				<EditMaintenanceWindowPage
					window={existing}
					scopeGroups={scopeGroups}
					submission={submission}
				/>,
				{ status: 422 },
			);
		};

		if (isFailure(result)) {
			return sendBack(windowSubmission(ctx.intl.t, ctx.formData, result.error.issues));
		}

		let { window_id, scope: submittedScope, ...values } = result.data;

		let scope = await resolveSubmittedScope(ctx.models, ctx.team.id, submittedScope);
		if (!scope) return sendBack(windowSubmission(ctx.intl.t, ctx.formData, SCOPE_ISSUE));

		unwrap(
			await ctx.models.maintenanceWindows.update(window_id, {
				...values,
				monitor_type: scope.monitorType,
				monitor_id: scope.monitorId,
			}),
		);

		session?.flash("toast", {
			intent: "success",
			message: ctx.intl.t("page.maintenance.toasts.updated", { name: values.name }),
		});
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
			message: ctx.intl.t("page.maintenance.toasts.deleted", { name: existing.name }),
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

		session?.flash("toast", {
			intent: "success",
			message: ctx.intl.t("page.maintenance.toasts.ended", { name: existing.name }),
		});
		return redirect(routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
