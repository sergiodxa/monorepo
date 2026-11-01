/**
 * The edit cron-job monitor page, drawn by the edit route and again by the update action when
 * it refuses a submission, so a rejected form comes back holding everything that was typed
 * with an issue beside each field to fix. Deleting sits last, behind a confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { AlertDialog, Button, LinkButton } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { SelectCronJobMonitor } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
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

export namespace EditCronJobPage {
	export interface Props {
		monitor: SelectCronJobMonitor;
		/** Whether the viewer may delete cron jobs, which decides whether the danger zone renders. */
		canDelete: boolean;
		/** The submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditCronJobPage(handle: Handle<EditCronJobPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { monitor, canDelete, submission } = handle.props;

		let t = withPrefix(ctx.intl.t, "page.editCronJob");
		let showHref = routes.app.team.cronJobs.show.href({
			team: ctx.team.slug,
			monitorId: monitor.id,
		});
		let values = {
			name: monitor.name,
			description: monitor.description ?? "",
			cron_expression: monitor.cron_expression,
			grace_period_seconds: monitor.grace_period_seconds,
			timezone: monitor.timezone ?? DEFAULT_TIMEZONE,
			alert_on_late: monitor.alert_on_late,
			is_enabled: monitor.enabled_at !== null,
		};

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.editMonitor.header.named", { name: monitor.name })}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.cronJobs.edit.href({
						team: ctx.team.slug,
						monitorId: monitor.id,
					})}
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
								submission={submission}
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
												{ctx.intl.t("app.confirm.deleteCronJob.title", { name: monitor.name })}
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
													{ctx.intl.t("app.confirm.deleteMonitor.action")}
												</Button>
											</AlertDialog.Footer>
										</form>
									</AlertDialog>
								</>
							) : null}
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
