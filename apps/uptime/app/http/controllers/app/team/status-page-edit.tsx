/**
 * Edit status page controller. All settings, including monitor attachments,
 * post through one `<form>` to `update-status-page`; only the delete flow
 * uses its own `<form>`. Fields are inlined here since the shared
 * status-page field block always renders the complete set of fields as one flat run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { IntlProvider } from "@sdxc/i18n/ui";
import { inject } from "@sdxc/service-container";
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
	Label,
	LinkButton,
	Switch,
	TextArea,
	TextField,
} from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import FlowMonitor from "~/app/data/flow-monitor";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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

/** GET /app/:team/status-pages/:statusPageId/edit — a status page's edit form. */
export default createAction(routes.app.team.statusPages.edit, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { statusPageId } = s.parse(s.object({ statusPageId: s.string() }), ctx.params);
		let page = await StatusPage.findByIdForTeam(db, ctx.team.id, statusPageId);
		if (!page) return notFound("Not Found");

		let [monitors, dnsMonitors, tcpMonitors, flowMonitors, cronJobs, attachedIds] =
			await Promise.all([
				Monitor.listByTeam(db, ctx.team.id),
				DnsMonitor.listByTeam(db, ctx.team.id),
				TcpMonitor.listByTeam(db, ctx.team.id),
				FlowMonitor.listByTeam(db, ctx.team.id),
				CronJobMonitor.listByTeam(db, ctx.team.id),
				StatusPage.getAttachedIds(db, statusPageId),
			]);

		/**
		 * HTTP, DNS, TCP, and flow monitors render as one flat checkbox list; each keeps the
		 * `name` of its source table so the update action can tell them apart. Only a flow's
		 * name is carried over — its spec source stays out of the markup, here as on the
		 * public page it curates (ADR-027 §8).
		 */
		let selectableMonitors = [
			...monitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "monitor_ids",
				checked: attachedIds.monitorIds.includes(monitor.id),
			})),
			...dnsMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "dns_monitor_ids",
				checked: attachedIds.dnsMonitorIds.includes(monitor.id),
			})),
			...tcpMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "tcp_monitor_ids",
				checked: attachedIds.tcpMonitorIds.includes(monitor.id),
			})),
			...flowMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				fieldName: "flow_monitor_ids",
				checked: attachedIds.flowMonitorIds.includes(monitor.id),
			})),
		];

		let t = ctx.i18next.getFixedT(null, "translation", "page.statusPages.form.fields");
		let indexHref = routes.app.team.statusPages.index.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Edit ${page.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.editStatusPage.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.statusPages"),
							href: indexHref,
						},
						{ label: page.name },
					]}
				>
					<FormPage>
						<div mix={[vstack({ gap: 12 })]}>
							<form
								method="post"
								action={routes.actions.statusPage.update.href({ team: ctx.team.slug })}
								mix={[vstack({ gap: 12 })]}
							>
								<input type="hidden" name="status_page_id" value={page.id} />

								<SettingsSection
									id="branding"
									title={ctx.i18next.t("page.editStatusPage.form.sections.branding.title")}
									description={ctx.i18next.t(
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
												defaultValue={page.name}
											/>

											<TextField
												label={t("slug.label")}
												type="text"
												name="slug"
												required
												placeholder={t("slug.placeholder")}
												description={t("slug.description")}
												defaultValue={page.slug}
											/>

											<TextField
												label={t("title.label")}
												type="text"
												name="title"
												required
												placeholder={t("title.placeholder")}
												description={t("title.description")}
												defaultValue={page.title}
											/>

											<div mix={[fieldStackLayout()]}>
												<Label htmlFor="status-page-description">{t("description.label")}</Label>
												<TextArea
													id="status-page-description"
													name="description"
													placeholder={t("description.placeholder")}
													defaultValue={page.description ?? ""}
												/>
												<Description>{t("description.description")}</Description>
											</div>

											<TextField
												label={t("logoUrl.label")}
												type="url"
												name="logo_url"
												placeholder={t("logoUrl.placeholder")}
												description={t("logoUrl.description")}
												defaultValue={page.logo_url ?? ""}
											/>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>

								<SettingsSection
									id="visibility"
									title={ctx.i18next.t("page.editStatusPage.form.sections.visibility.title")}
									description={ctx.i18next.t(
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
													<Switch name="is_public" value="true" defaultChecked={page.is_public}>
														{t("isPublic.label")}
													</Switch>
													<Description>{t("isPublic.description")}</Description>
												</div>

												<div mix={[fieldStackLayout()]}>
													<Switch
														name="show_overall_status"
														value="true"
														defaultChecked={page.show_overall_status}
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
									title={ctx.i18next.t("page.editStatusPage.form.sections.services.title")}
									description={ctx.i18next.t(
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
													<IntlProvider i18n={ctx.i18next}>
														<CheckboxGroupSelectAll groupId={MONITORS_GROUP_ID} />
													</IntlProvider>

													<CheckboxGroup id={MONITORS_GROUP_ID} aria-labelledby={MONITORS_LABEL_ID}>
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

													<IntlProvider i18n={ctx.i18next}>
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
																defaultChecked={attachedIds.cronJobIds.includes(cronJob.id)}
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
													{ctx.i18next.t("page.editStatusPage.form.sections.services.empty")}
												</p>
											)}
										</SettingsSection.Body>
										<SettingsSection.Footer>
											<LinkButton variant="outline" href={indexHref}>
												{ctx.i18next.t("page.editMonitor.form.cancel")}
											</LinkButton>
											<Button type="submit">
												{ctx.i18next.t("page.statusPages.form.ctaUpdate")}
											</Button>
										</SettingsSection.Footer>
									</SettingsSection.Card>
								</SettingsSection>
							</form>

							<SettingsSection
								id="danger"
								tone="danger"
								title={ctx.i18next.t("page.editStatusPage.dangerZone.title")}
								description={ctx.i18next.t("page.editStatusPage.dangerZone.description")}
							>
								<SettingsSection.Card tone="danger">
									<SettingsSection.Body>
										<p mix={[m(0), fontSize("sm"), fg("danger")]}>
											{ctx.i18next.t("page.editStatusPage.dangerZone.warning")}
										</p>
									</SettingsSection.Body>
									<SettingsSection.Footer tone="danger">
										<Button
											type="button"
											color="danger"
											commandfor={DELETE_DIALOG_ID}
											command="show-modal"
										>
											{ctx.i18next.t("page.statusPages.table.actions.delete")}
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
										{ctx.i18next.t("page.statusPages.table.confirmation.delete", {
											name: page.name,
										})}
									</AlertDialog.Title>
									<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
										{ctx.i18next.t("page.editStatusPage.dangerZone.deleteDescription")}
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
											{ctx.i18next.t("page.editMonitor.form.cancel")}
										</AlertDialog.Cancel>
										<Button type="submit" color="danger">
											{ctx.i18next.t("page.statusPages.table.actions.delete")}
										</Button>
									</AlertDialog.Footer>
								</form>
							</AlertDialog>
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
