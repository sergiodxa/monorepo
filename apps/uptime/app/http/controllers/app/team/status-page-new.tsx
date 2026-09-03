/**
 * New status page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields group into three bordered cards — branding, visibility, and
 * services — in one `<form>`, so each reads as its own settings group while
 * still submitting as a single request; the submit control sits at the foot
 * of the last card.
 *
 * The markup is spelled out here because the shared status-page field
 * component always renders the complete set of fields as one fragment. The
 * edit page still renders that component unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IntlProvider } from "@sdxc/i18n/ui";
import { inject } from "@sdxc/service-container";
import { vstack } from "@sdxc/u/layout";
import { fontSize, weight } from "@sdxc/u/typography";
import {
	Button,
	Checkbox,
	CheckboxGroup,
	Description,
	Label,
	Switch,
	TextArea,
	TextField,
} from "@sdxc/ui";
import { fieldStackLayout } from "@sdxc/ui/styles";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import FlowMonitor from "~/app/data/flow-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection, { SETTINGS_SWITCH_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

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

/** GET /app/:team/status-pages/new — the new status-page form. */
export default createAction(routes.app.team.statusPages.new, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [monitors, dnsMonitors, tcpMonitors, flowMonitors, cronJobs] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			FlowMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
		]);

		let t = ctx.i18next.getFixedT(null, "translation", "page.statusPages.form.fields");

		/**
		 * HTTP, DNS, TCP and flow monitors share one list, but each checkbox keeps the `name` of
		 * the table its monitor belongs to so the create action can still tell them apart. A flow
		 * contributes only its id and name here, keeping its spec source off a form that lists it.
		 */
		let selectableMonitors = [
			...monitors.map((monitor) => ({ id: monitor.id, name: monitor.name, field: "monitor_ids" })),
			...dnsMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				field: "dns_monitor_ids",
			})),
			...tcpMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				field: "tcp_monitor_ids",
			})),
			...flowMonitors.map((monitor) => ({
				id: monitor.id,
				name: monitor.name,
				field: "flow_monitor_ids",
			})),
		];

		let hasSomethingToList = selectableMonitors.length > 0 || cronJobs.length > 0;

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.createStatusPage.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.createStatusPage.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.statusPages"),
							href: routes.app.team.statusPages.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.statusPage.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="branding"
								title={ctx.i18next.t("page.createStatusPage.form.sections.branding.title")}
								description={ctx.i18next.t(
									"page.createStatusPage.form.sections.branding.description",
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
										/>

										<TextField
											label={t("slug.label")}
											type="text"
											name="slug"
											required
											placeholder={t("slug.placeholder")}
											description={t("slug.description")}
										/>

										<TextField
											label={t("title.label")}
											type="text"
											name="title"
											required
											placeholder={t("title.placeholder")}
											description={t("title.description")}
										/>

										<Field
											label={t("description.label")}
											description={t("description.description")}
										>
											<TextArea
												name="description"
												placeholder={t("description.placeholder")}
												defaultValue=""
											/>
										</Field>

										<TextField
											label={t("logoUrl.label")}
											type="url"
											name="logo_url"
											placeholder={t("logoUrl.placeholder")}
											description={t("logoUrl.description")}
											defaultValue=""
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="visibility"
								title={ctx.i18next.t("page.createStatusPage.form.sections.visibility.title")}
								description={ctx.i18next.t(
									"page.createStatusPage.form.sections.visibility.description",
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
												<Switch name="is_public" value="true" defaultChecked>
													{t("isPublic.label")}
												</Switch>
												<Description>{t("isPublic.description")}</Description>
											</div>

											<div mix={[fieldStackLayout()]}>
												<Switch name="show_overall_status" value="true" defaultChecked>
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
								title={ctx.i18next.t("page.createStatusPage.form.sections.services.title")}
								description={ctx.i18next.t(
									"page.createStatusPage.form.sections.services.description",
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
												 * The island resolves copy through `intl(handle)`, which has no
												 * module-scoped `setIntl()` default on the server, so it needs an
												 * `IntlProvider` ancestor to resolve against.
												 */}
												<IntlProvider i18n={ctx.i18next}>
													<CheckboxGroupSelectAll groupId={MONITORS_GROUP_ID} />
												</IntlProvider>

												<CheckboxGroup id={MONITORS_GROUP_ID} aria-labelledby={MONITORS_LABEL_ID}>
													{selectableMonitors.map((monitor) => (
														<Checkbox
															key={`${monitor.field}-${monitor.id}`}
															name={monitor.field}
															value={monitor.id}
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

												<CheckboxGroup id={CRON_JOBS_GROUP_ID} aria-labelledby={CRON_JOBS_LABEL_ID}>
													{cronJobs.map((cronJob) => (
														<Checkbox key={cronJob.id} name="cron_job_ids" value={cronJob.id}>
															{cronJob.name}
														</Checkbox>
													))}
												</CheckboxGroup>
											</div>
										)}

										{/** A team with nothing to list still gets the card, so the submit control keeps its place. */}
										{!hasSomethingToList && (
											<Description>
												{ctx.i18next.t("page.createStatusPage.form.sections.services.empty")}
											</Description>
										)}
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.i18next.t("page.statusPages.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
