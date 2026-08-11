/**
 * New status page page controller. Requires `requireUser` + `requireTeam`.
 *
 * The fields are grouped into three bordered cards — how the page is branded, who
 * can see it, and what it lists — inside a single `<form>`, so the page reads as
 * distinct settings groups while still submitting as one request. The submit control
 * sits at the foot of the last card rather than loose under the fields.
 *
 * The field markup is spelled out here instead of coming from the shared status-page
 * field component, because carding the form means rendering the identity fields in one
 * box, the toggles in another and the checkbox lists in a third, and that component
 * emits all of them as one fragment with no way to ask for a subset. The edit page
 * still renders it unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { IntlProvider } from "@pkg/i18n/ui";
import { inject } from "@pkg/service-container";
import { vstack } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { fontSize, weight } from "@pkg/u/typography";
import {
	Button,
	Checkbox,
	CheckboxGroup,
	Description,
	Label,
	Switch,
	TextArea,
	TextField,
} from "@pkg/ui";
import { fieldStackLayout } from "@pkg/ui/styles";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * The page renders once per request, so the checkbox groups can label themselves through
 * fixed ids instead of generated ones — there is never a second instance to collide with.
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

		let [monitors, dnsMonitors, tcpMonitors, cronJobs] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			DnsMonitor.listByTeam(db, ctx.team.id),
			TcpMonitor.listByTeam(db, ctx.team.id),
			CronJobMonitor.listByTeam(db, ctx.team.id),
		]);

		let t = ctx.i18next.getFixedT(null, "translation", "page.statusPages.form.fields");

		/**
		 * HTTP, DNS and TCP monitors share one list, but each checkbox keeps the `name` of the
		 * table its monitor belongs to so the create action can still tell the three apart.
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
											mix={mbe("28px")}
										/>

										<TextField
											label={t("slug.label")}
											type="text"
											name="slug"
											required
											placeholder={t("slug.placeholder")}
											description={t("slug.description")}
											mix={mbe("28px")}
										/>

										<TextField
											label={t("title.label")}
											type="text"
											name="title"
											required
											placeholder={t("title.placeholder")}
											description={t("title.description")}
											mix={mbe("28px")}
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
											mix={mbe("28px")}
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
										<div mix={[fieldStackLayout(), mbe("16px")]}>
											<Switch name="is_public" value="true" defaultChecked>
												{t("isPublic.label")}
											</Switch>
											<Description>{t("isPublic.description")}</Description>
										</div>

										{/* The body draws no block-end padding, so the last control carries the trailing gap itself. */}
										<div mix={[fieldStackLayout(), mbe("28px")]}>
											<Switch name="show_overall_status" value="true" defaultChecked>
												{t("showOverallStatus.label")}
											</Switch>
											<Description>{t("showOverallStatus.description")}</Description>
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

												<CheckboxGroup id={CRON_JOBS_GROUP_ID} aria-labelledby={CRON_JOBS_LABEL_ID}>
													{cronJobs.map((cronJob) => (
														<Checkbox key={cronJob.id} name="cron_job_ids" value={cronJob.id}>
															{cronJob.name}
														</Checkbox>
													))}
												</CheckboxGroup>
											</div>
										)}

										{/* A team with nothing to list still gets the card, so the submit control keeps its place. */}
										{!hasSomethingToList && (
											<Description mix={[mbe("20px")]}>
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
