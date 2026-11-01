/**
 * Edit cron-job monitor page controller. Requires `requireUser` + `requireTeam`; 404s when
 * the monitor doesn't belong to the current team. The page also renders from the update
 * action after a rejected submit, carrying what was typed and the issues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, LinkButton } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SelectCronJobMonitor } from "~/database/schema";
import type { CronJobFormState } from "~/resources/views/cron-jobs/form";

import { teamAccess } from "~/app/http/middleware/access";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { withPrefix } from "~/app/services/prefixed-translate";
import { DEFAULT_TIMEZONE } from "~/config/timezones";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import CronJobForm from "~/resources/views/cron-jobs/form";
import routes from "~/routes/web";

/** Stable id for the delete-confirmation `AlertDialog`, wired to its trigger's `commandfor`. */
const DELETE_DIALOG_ID = "delete-cron-job";

/**
 * Renders the edit page for `monitor` in the current request, holding either the stored values
 * or a rejected submit. A rejected submit answers 400, keeping what was typed in every field.
 *
 * @param monitor - The monitor being edited, already scoped to the team.
 * @param state - What was submitted and why it was refused; omitted to show the stored values.
 */
export async function renderEditCronJobPage(
	monitor: SelectCronJobMonitor,
	state?: CronJobFormState,
): Promise<Response> {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	await ctx.access.load(abilities.cronJobs.delete);
	let canDelete = ctx.access.can(abilities.cronJobs.delete);

	let t = withPrefix(ctx.intl.t, "page.editCronJob");
	let showHref = routes.app.team.cronJobs.show.href({
		team: ctx.team.slug,
		monitorId: monitor.id,
	});
	let values = state?.values ?? {
		name: monitor.name,
		description: monitor.description ?? "",
		cron_expression: monitor.cron_expression,
		grace_period_seconds: monitor.grace_period_seconds,
		timezone: monitor.timezone ?? DEFAULT_TIMEZONE,
		alert_on_late: monitor.alert_on_late,
		is_enabled: monitor.enabled_at !== null,
	};

	return ctx.render(
		<DocumentLayout
			assets={ctx.assets}
			title={`${ctx.team.name} · ${t("header.title")} ${monitor.name}`}
		>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
				intl={ctx.intl}
				heading={t("header.title")}
				breadcrumbs={[
					{
						label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
						href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
					},
					{
						label: t("header.breadcrumb.cronJobs"),
						href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
					},
					{ label: monitor.name, href: showHref },
				]}
			>
				<FormPage>
					<div mix={[vstack({ gap: 12 })]}>
						<CronJobForm
							action={routes.actions.cronJob.update.href({ team: ctx.team.slug })}
							values={values}
							issues={state?.issues}
							page="editCronJob"
							intl={ctx.intl}
							hidden={<input type="hidden" name="monitor_id" value={monitor.id} />}
							footer={
								<>
									<LinkButton variant="outline" href={showHref}>
										{t("form.cancel")}
									</LinkButton>
									<Button type="submit">{t("form.cta")}</Button>
								</>
							}
						/>

						{canDelete ? (
							<>
								<SettingsSection
									id="danger"
									tone="danger"
									title={t("danger.title")}
									description={t("danger.description")}
								>
									<SettingsSection.Card tone="danger">
										<SettingsSection.Body>
											<p mix={[m(0), fontSize("sm"), fg("danger")]}>{t("danger.warning")}</p>
										</SettingsSection.Body>
										<SettingsSection.Footer tone="danger">
											<Button
												type="button"
												color="danger"
												commandfor={DELETE_DIALOG_ID}
												command="show-modal"
											>
												{t("danger.delete.trigger")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>

								<AlertDialog
									id={DELETE_DIALOG_ID}
									aria-labelledby={`${DELETE_DIALOG_ID}-title`}
									aria-describedby={`${DELETE_DIALOG_ID}-description`}
								>
									<AlertDialog.Header>
										<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
											{t("danger.delete.confirmTitle")}
										</AlertDialog.Title>
										<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
											{t("danger.delete.confirmDescription")}
										</AlertDialog.Description>
									</AlertDialog.Header>
									<form
										method="post"
										action={routes.actions.cronJob.delete.href({ team: ctx.team.slug })}
									>
										<input type="hidden" name="_method" value="DELETE" />
										<input type="hidden" name="monitor_id" value={monitor.id} />
										<AlertDialog.Footer>
											<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
												{t("form.cancel")}
											</AlertDialog.Cancel>
											<Button type="submit" color="danger">
												{t("danger.delete.confirm")}
											</Button>
										</AlertDialog.Footer>
									</form>
								</AlertDialog>
							</>
						) : null}
					</div>
				</FormPage>
			</AppShell>
		</DocumentLayout>,
		{ status: state === undefined ? 200 : 400 },
	);
}

/** GET /app/:team/cron-jobs/:monitorId/edit — a cron-job monitor's edit form. */
export default createAction(routes.app.team.cronJobs.edit, {
	middleware: [requireUser, requireTeam, teamAccess],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.cronJobMonitors
			.inTeam(ctx.team.id)
			.where({ id: monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		return renderEditCronJobPage(monitor);
	},
});
