/**
 * Edit status page page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the page doesn't belong to the current team.
 *
 * The settings are split across three bordered cards — branding, visibility and the
 * attached monitors — so the page reads as distinct settings groups rather than one
 * continuous column, with the destructive action in a fourth, danger-toned card at
 * the foot. All three settings cards sit inside a single `<form>` posting to
 * `update-status-page`, exactly as before: the attachments are part of that same
 * submission, so splitting them onto their own form would change what the action
 * receives. Only the delete flow is a separate `<form>`, posting to its own action.
 *
 * The field markup is written out here rather than pulled from the shared status-page
 * field block, because that block renders every field as one flat run and is drawn by
 * the create page too — grouping it into cards would have to happen at the call site
 * regardless.
 *
 * The delete confirmation is `@pkg/ui`'s `AlertDialog` composed directly rather than
 * through the `Confirm` convenience wrapper, since the confirming control is a real
 * `<form method="post">` submit button rather than a `command="close"` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m, mbe } from "@pkg/u/size";
import { fontSize, weight } from "@pkg/u/typography";
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
} from "@pkg/ui";
import { fieldStackLayout } from "@pkg/ui/styles";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `id` shared between the danger-zone trigger and its confirmation `AlertDialog`. */
const DELETE_DIALOG_ID = "delete-status-page";

/**
 * The page renders once per request, so the checkbox groups can label themselves through
 * fixed ids instead of generated ones — there is never a second instance to collide with.
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

		let [monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
			StatusPage.getAttachedIds(db, statusPageId),
		]);

		/*
		 * HTTP, DNS and TCP monitors render as one flat checkbox list, but each keeps the
		 * `name` of the table it belongs to so the update action can still tell them apart.
		 * SSL monitors are absent on purpose — see `app/data/status-page.ts`'s docblock.
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
												mix={mbe("28px")}
											/>

											<TextField
												label={t("slug.label")}
												type="text"
												name="slug"
												required
												placeholder={t("slug.placeholder")}
												description={t("slug.description")}
												defaultValue={page.slug}
												mix={mbe("28px")}
											/>

											<TextField
												label={t("title.label")}
												type="text"
												name="title"
												required
												placeholder={t("title.placeholder")}
												description={t("title.description")}
												defaultValue={page.title}
												mix={mbe("28px")}
											/>

											<div mix={[fieldStackLayout(), mbe("28px")]}>
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
												mix={mbe("28px")}
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
											<div mix={[fieldStackLayout(), mbe("16px")]}>
												<Switch name="is_public" value="true" defaultChecked={page.is_public}>
													{t("isPublic.label")}
												</Switch>
												<Description>{t("isPublic.description")}</Description>
											</div>

											{/* The body draws no block-end padding, so the last control carries the trailing gap itself. */}
											<div mix={[fieldStackLayout(), mbe("28px")]}>
												<Switch
													name="show_overall_status"
													value="true"
													defaultChecked={page.show_overall_status}
												>
													{t("showOverallStatus.label")}
												</Switch>
												<Description>{t("showOverallStatus.description")}</Description>
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
												<div mix={[vstack({ gap: "8px" }), mbe("20px")]}>
													{/*
													 * The group's caption reads as a heading over the list rather than as
													 * another row in it, with its description directly beneath — the same
													 * order every single field on this page puts the two in.
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

													{/* The island reads its copy through `intl(handle)`, which server-side has no
													    module-scoped `setIntl()` default to fall back on, so it needs an
													    `IntlProvider` ancestor to resolve against at all. */}
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
												<div mix={[vstack({ gap: "8px" }), mbe("20px")]}>
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

											{/* The card still carries the form's action row, so it needs a body even with nothing to attach. */}
											{selectableMonitors.length === 0 && cronJobs.length === 0 && (
												<p mix={[m(0), mbe("20px"), fontSize("sm"), fg("neutral.muted")]}>
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
										<p mix={[m(0), mbe("28px"), fontSize("sm"), fg("danger")]}>
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
								{/*
								 * The confirming control is a plain `Button`, not `AlertDialog.Action`:
								 * that compound part always carries `command="close"`, which — per the
								 * Invoker Commands spec — replaces a button's native type-based
								 * activation, so a `type="submit"` button wired to it would stop
								 * submitting its form. This delete flow is a real `<form method="post">`
								 * POST (progressive enhancement, no client JS required), so the actual
								 * submit control must stay a plain button outside that command wiring.
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
