/**
 * Edit alert page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * alert doesn't belong to the current team.
 *
 * The danger-zone delete confirmation is `@pkg/r3-ui`'s `AlertDialog` composed
 * directly rather than through the `Confirm` convenience wrapper, since the
 * confirming control is a real `<form method="post">` submit button rather than a
 * `command="close"` action — matching `monitor-edit.tsx`'s own delete dialogs.
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

import Alert from "~/app/data/alert";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Button from "~/resources/components/button";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

const DELETE_ALERT_DIALOG_ID = "delete-alert";
const DELETE_ALERT_TITLE_ID = "delete-alert-title";
const DELETE_ALERT_DESCRIPTION_ID = "delete-alert-description";

/** GET /app/:team/alerts/:alertId/edit — an alert's edit form. */
export default createAction(routes.app.team.alerts.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { alertId } = s.parse(s.object({ alertId: s.string() }), ctx.params);
		let alert = await Alert.findByIdForTeam(db, ctx.team.id, alertId);
		if (!alert) return notFound("Not Found");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${alert.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.editAlert.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.alerts"),
							href: routes.app.team.alerts.index.href({ team: ctx.team.slug }),
						},
						{ label: alert.name },
					]}
				>
					<FormPage>
						<form method="post" action={routes.actions.alert.update.href({ team: ctx.team.slug })}>
							<input type="hidden" name="alert_id" value={alert.id} />
							<AlertFormFields alert={alert} monitors={monitors} i18next={ctx.i18next} />
							<Button type="submit">{ctx.i18next.t("page.editAlert.form.cta")}</Button>
						</form>

						<a
							href={routes.app.team.alerts.index.href({ team: ctx.team.slug })}
							mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
						>
							{ctx.i18next.t("page.editAlert.form.cancel")}
						</a>

						<h2>{ctx.i18next.t("page.editAlert.danger.title")}</h2>
						<Button
							type="button"
							color="danger"
							commandfor={DELETE_ALERT_DIALOG_ID}
							command="show-modal"
						>
							{ctx.i18next.t("page.editAlert.danger.delete.trigger")}
						</Button>
						<AlertDialog
							id={DELETE_ALERT_DIALOG_ID}
							aria-labelledby={DELETE_ALERT_TITLE_ID}
							aria-describedby={DELETE_ALERT_DESCRIPTION_ID}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={DELETE_ALERT_TITLE_ID}>
									{ctx.i18next.t("page.editAlert.danger.delete.confirmTitle")}
								</AlertDialog.Title>
								<AlertDialog.Description id={DELETE_ALERT_DESCRIPTION_ID}>
									{ctx.i18next.t("page.editAlert.danger.delete.confirmDescription")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.alert.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="alert_id" value={alert.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel type="button" commandfor={DELETE_ALERT_DIALOG_ID}>
										{ctx.i18next.t("page.editAlert.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.editAlert.danger.delete.confirm")}
									</Button>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
