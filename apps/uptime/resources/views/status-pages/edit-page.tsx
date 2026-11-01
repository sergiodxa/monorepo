/**
 * The edit status page page, drawn by the edit route and again by the update action when it
 * refuses a submission, so a rejected form comes back holding everything that was typed,
 * ticked services included, with an issue beside each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { IntlProvider } from "@sdxc/i18n/ui";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import {
	AlertDialog,
	Button,
	Checkbox,
	CheckboxGroup,
	Description,
	Form,
	Label,
	LinkButton,
	Switch,
	TextArea,
	TextField,
} from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { StatusPageAttachedIds } from "~/app/models/status-pages";
import type { ScopeMonitorGroup } from "~/app/services/scope-monitors";
import type { SelectStatusPage } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import {
	submittedChecked,
	submittedList,
	submittedText,
} from "~/app/http/validators/form-submission";
import { withPrefix } from "~/app/services/prefixed-translate";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { statusPageServices } from "~/resources/views/status-pages/services";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-status-page";

/**
 * The page renders once per request, so the checkbox groups label themselves
 * through fixed ids: each id stays unique since only one instance of the page
 * ever exists at a time.
 */
const MONITORS_LABEL_ID = "status-page-monitors-label";
const CRON_JOBS_LABEL_ID = "status-page-cron-jobs-label";

/** `id` of each checkbox list, so its own select-all control can find the boxes it drives. */
const MONITORS_GROUP_ID = "status-page-monitors-group";
const CRON_JOBS_GROUP_ID = "status-page-cron-jobs-group";

export namespace EditStatusPagePage {
	export interface Props {
		page: SelectStatusPage;
		/** The team's monitors and cron jobs grouped by kind, offered as the page's services. */
		scopeGroups: ScopeMonitorGroup[];
		/** The services the saved page lists, ticked on a first visit. */
		attachedIds: StatusPageAttachedIds;
		/** The submission the update action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function EditStatusPagePage(handle: Handle<EditStatusPagePage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { page, scopeGroups, attachedIds, submission } = handle.props;
		let services = statusPageServices(scopeGroups);
		let cronJobs = services.cronJobs;
		/** The ids the saved page lists under each monitor field, ticked on a first visit. */
		let attached = {
			monitor_ids: attachedIds.monitorIds,
			dns_monitor_ids: attachedIds.dnsMonitorIds,
			tcp_monitor_ids: attachedIds.tcpMonitorIds,
			flow_monitor_ids: attachedIds.flowMonitorIds,
		};
		let selectableMonitors = services.monitors.map((monitor) => ({
			id: monitor.id,
			name: monitor.name,
			fieldName: monitor.field,
			checked: submittedList(submission, monitor.field, attached[monitor.field]).includes(
				monitor.id,
			),
		}));

		let t = withPrefix(ctx.intl.t, "page.statusPages.form.fields");
		let indexHref = routes.app.team.statusPages.index.href({ team: ctx.team.slug });
		let heading = ctx.intl.t("page.editStatusPage.header.named", { name: page.name });

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${heading}`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.statusPages.edit.href({
						team: ctx.team.slug,
						statusPageId: page.id,
					})}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={heading}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.statusPages"),
							href: indexHref,
						},
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<Form
								method="post"
								action={routes.actions.statusPage.update.href({ team: ctx.team.slug })}
								issues={submission?.issues}
							>
								<input type="hidden" name="status_page_id" value={page.id} />
								<div mix={[vstack({ gap: 12 })]}>
									<SettingsSection
										id="branding"
										title={ctx.intl.t("page.editStatusPage.form.sections.branding.title")}
										description={ctx.intl.t(
											"page.editStatusPage.form.sections.branding.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												<TextField
													label={t("name.label")}
													type="text"
													name="name"
													required
													placeholder={t("name.placeholder")}
													description={t("name.description")}
													defaultValue={submittedText(submission, "name", page.name)}
												/>

												<TextField
													label={t("slug.label")}
													type="text"
													name="slug"
													required
													placeholder={t("slug.placeholder")}
													description={t("slug.description")}
													defaultValue={submittedText(submission, "slug", page.slug)}
												/>

												<TextField
													label={t("title.label")}
													type="text"
													name="title"
													required
													placeholder={t("title.placeholder")}
													description={t("title.description")}
													defaultValue={submittedText(submission, "title", page.title)}
												/>

												<div mix={[fieldStackLayout()]}>
													<Label htmlFor="status-page-description">{t("description.label")}</Label>
													<TextArea
														id="status-page-description"
														name="description"
														placeholder={t("description.placeholder")}
														defaultValue={submittedText(
															submission,
															"description",
															page.description ?? "",
														)}
													/>
													<Description>{t("description.description")}</Description>
												</div>

												<TextField
													label={t("logoUrl.label")}
													type="url"
													name="logo_url"
													placeholder={t("logoUrl.placeholder")}
													description={t("logoUrl.description")}
													defaultValue={submittedText(submission, "logo_url", page.logo_url ?? "")}
												/>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="visibility"
										title={ctx.intl.t("page.editStatusPage.form.sections.visibility.title")}
										description={ctx.intl.t(
											"page.editStatusPage.form.sections.visibility.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												{/**
												 * Both toggles answer "who sees this page," so they share the tighter
												 * within-group rhythm as a single group.
												 */}
												<div mix={[vstack({ gap: SETTINGS_SWITCH_GAP })]}>
													<div mix={[fieldStackLayout()]}>
														<Switch
															name="is_public"
															value="true"
															defaultChecked={submittedChecked(
																submission,
																"is_public",
																page.is_public,
															)}
														>
															{t("isPublic.label")}
														</Switch>
														<Description>{t("isPublic.description")}</Description>
													</div>

													<div mix={[fieldStackLayout()]}>
														<Switch
															name="show_overall_status"
															value="true"
															defaultChecked={submittedChecked(
																submission,
																"show_overall_status",
																page.show_overall_status,
															)}
														>
															{t("showOverallStatus.label")}
														</Switch>
														<Description>{t("showOverallStatus.description")}</Description>
													</div>
												</div>
											</SettingsSection.Body>
										</SettingsSection.Card>
									</SettingsSection>

									<SettingsSection
										id="services"
										title={ctx.intl.t("page.editStatusPage.form.sections.services.title")}
										description={ctx.intl.t(
											"page.editStatusPage.form.sections.services.description",
										)}
									>
										<SettingsSection.Card>
											<SettingsSection.Body>
												{selectableMonitors.length > 0 && (
													<div mix={[vstack({ gap: "8px" })]}>
														{/**
														 * The group's caption stands as a heading above the list, with its
														 * description directly beneath, matching every other field on this page.
														 */}
														<div mix={[fieldStackLayout()]}>
															<Label
																id={MONITORS_LABEL_ID}
																mix={[fontSize("base"), weight("semibold")]}
															>
																{t("monitors.label")}
															</Label>
															<Description>{t("monitors.description")}</Description>
														</div>

														{/**
														 * The island resolves copy through `intl(handle)`, which relies on an
														 * ancestor `IntlProvider` to supply request-scoped context on the server.
														 */}
														<IntlProvider intl={ctx.intl}>
															<CheckboxGroupSelectAll groupId={MONITORS_GROUP_ID} />
														</IntlProvider>

														<CheckboxGroup
															id={MONITORS_GROUP_ID}
															aria-labelledby={MONITORS_LABEL_ID}
														>
															{selectableMonitors.map((monitor) => (
																<Checkbox
																	key={`${monitor.fieldName}-${monitor.id}`}
																	name={monitor.fieldName}
																	value={monitor.id}
																	defaultChecked={monitor.checked}
																>
																	{monitor.name}
																</Checkbox>
															))}
														</CheckboxGroup>
													</div>
												)}

												{cronJobs.length > 0 && (
													<div mix={[vstack({ gap: "8px" })]}>
														<div mix={[fieldStackLayout()]}>
															<Label
																id={CRON_JOBS_LABEL_ID}
																mix={[fontSize("base"), weight("semibold")]}
															>
																{t("cronJobs.label")}
															</Label>
															<Description>{t("cronJobs.description")}</Description>
														</div>

														<IntlProvider intl={ctx.intl}>
															<CheckboxGroupSelectAll groupId={CRON_JOBS_GROUP_ID} />
														</IntlProvider>

														<CheckboxGroup
															id={CRON_JOBS_GROUP_ID}
															aria-labelledby={CRON_JOBS_LABEL_ID}
														>
															{cronJobs.map((cronJob) => (
																<Checkbox
																	key={cronJob.id}
																	name="cron_job_ids"
																	value={cronJob.id}
																	defaultChecked={submittedList(
																		submission,
																		"cron_job_ids",
																		attachedIds.cronJobIds,
																	).includes(cronJob.id)}
																>
																	{cronJob.name}
																</Checkbox>
															))}
														</CheckboxGroup>
													</div>
												)}

												{/** The empty-state message keeps the card body non-empty, so the action row still has a place to sit. */}
												{selectableMonitors.length === 0 && cronJobs.length === 0 && (
													<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
														{ctx.intl.t("page.editStatusPage.form.sections.services.empty")}
													</p>
												)}
											</SettingsSection.Body>
											<SettingsSection.Footer>
												<LinkButton variant="outline" href={indexHref}>
													{ctx.intl.t("page.editMonitor.form.cancel")}
												</LinkButton>
												<Button type="submit">
													{ctx.intl.t("page.statusPages.form.ctaUpdate")}
												</Button>
											</SettingsSection.Footer>
										</SettingsSection.Card>
									</SettingsSection>
								</div>
							</Form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.intl.t("page.editStatusPage.dangerZone.title")}
								description={ctx.intl.t("page.editStatusPage.dangerZone.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.intl.t("page.editStatusPage.dangerZone.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.intl.t("page.statusPages.table.actions.delete")}
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
										{ctx.intl.t("page.statusPages.table.confirmation.delete", {
											name: page.name,
										})}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{ctx.intl.t("page.editStatusPage.dangerZone.deleteDescription")}
									</AlertDialog.Description>
								</AlertDialog.Header>
								{/**
								 * The confirming control stays a plain `Button` so `type="submit"` drives it
								 * natively: `AlertDialog.Action` always sets `command="close"`, and per the
								 * Invoker Commands spec that command takes over a button's native activation.
								 */}
								<form
									method="post"
									action={routes.actions.statusPage.delete.href({ team: ctx.team.slug })}
								>
									<input type="hidden" name="_method" value="DELETE" />
									<input type="hidden" name="status_page_id" value={page.id} />
									<AlertDialog.Footer>
										<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
											{ctx.intl.t("page.editMonitor.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.intl.t("page.statusPages.table.actions.delete")}
										</Button>
									</AlertDialog.Footer>
								</form>
							</AlertDialog>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
