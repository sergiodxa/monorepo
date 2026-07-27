/**
 * Edit maintenance window page controller. Requires `requireUser` + `requireTeam`;
 * 404s when the window doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { AlertDialog } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

/** `id` shared by the delete-confirmation trigger and its {@link AlertDialog}. */
const DELETE_DIALOG_ID = "delete-maintenance-window";

/** GET /app/:team/maintenance/:windowId/edit — a maintenance window's edit form. */
export default createAction(routes.app.team.maintenanceWindows.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { windowId } = s.parse(s.object({ windowId: s.string() }), ctx.params);
		let window = await MaintenanceWindow.findByIdForTeam(db, ctx.team.id, windowId);
		if (!window) return notFound("Not Found");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());
		let heading = ctx.i18next.t("page.editMaintenance.header.title", { name: window.name });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${heading}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={heading}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.maintenance"),
							href: routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug }),
						},
						{ label: window.name },
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.maintenanceWindow.update.href({ team: ctx.team.slug })}
						>
							<input type="hidden" name="window_id" value={window.id} />
							<MaintenanceWindowFormFields
								window={window}
								monitors={monitors}
								i18next={ctx.i18next}
							/>
							<Button type="submit">{ctx.i18next.t("page.editMaintenance.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.maintenanceWindows.index.href({ team: ctx.team.slug })}
							mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
						>
							{ctx.i18next.t("page.editMaintenance.form.cancel")}
						</a>

						{isActive && (
							<form
								method="post"
								action={routes.actions.maintenanceWindow.end.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="window_id" value={window.id} />
								<Button type="submit" variant="outline">
									{ctx.i18next.t("page.editMaintenance.endNow.cta")}
								</Button>
							</form>
						)}

						<h2>{ctx.i18next.t("page.editMaintenance.danger.title")}</h2>
						<Button type="button" color="danger" commandfor={DELETE_DIALOG_ID} command="show-modal">
							{ctx.i18next.t("page.editMaintenance.danger.delete.trigger")}
						</Button>

						<AlertDialog
							id={DELETE_DIALOG_ID}
							aria-labelledby={`${DELETE_DIALOG_ID}-title`}
							aria-describedby={`${DELETE_DIALOG_ID}-description`}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
									{ctx.i18next.t("page.editMaintenance.danger.delete.confirmTitle")}
								</AlertDialog.Title>
								<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
									{ctx.i18next.t("page.editMaintenance.danger.delete.confirmDescription")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.maintenanceWindow.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="window_id" value={window.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
										{ctx.i18next.t("page.editMaintenance.form.cancel")}
									</AlertDialog.Cancel>
									<AlertDialog.Action commandfor={DELETE_DIALOG_ID} type="submit">
										{ctx.i18next.t("page.editMaintenance.danger.delete.confirm")}
									</AlertDialog.Action>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
