/**
 * New DNS monitor form page controller. Posts to the `create-dns-monitor` action.
 * Requires `requireUser` + `requireTeam`.
 *
 * The fields are grouped into two bordered cards — which record gets watched, and how
 * it gets checked — inside a single `<form>`, so the page reads as distinct settings
 * groups while still submitting as one request. The submit control sits at the foot of
 * the last card rather than loose under the fields.
 *
 * The field markup is spelled out here instead of coming from the shared DNS field
 * component, because carding the form means rendering half the fields in one box and
 * half in another, and that component emits all six as one fragment with no way to ask
 * for a subset. The edit page still renders it unchanged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@pkg/u/layout";
import { Button, Select, Switch, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** DNS record types a monitor can resolve. Left untranslated: they are protocol tokens, not prose. */
const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS"] as const;

/** How often a DNS record is resolved, in seconds, paired with the locale key naming each span. */
const INTERVAL_OPTIONS = [
	{ value: 300, key: "5m" },
	{ value: 900, key: "15m" },
	{ value: 1800, key: "30m" },
	{ value: 3600, key: "1h" },
	{ value: 21_600, key: "6h" },
	{ value: 43_200, key: "12h" },
	{ value: 86_400, key: "24h" },
] as const;

/** Record type a new monitor starts on, matched against {@link RECORD_TYPES} to mark its option. */
const DEFAULT_RECORD_TYPE = "A";

/** Interval a new monitor starts on, in seconds, matched against {@link INTERVAL_OPTIONS} to mark its option. */
const DEFAULT_INTERVAL_SECONDS = 3600;

/** GET /app/:team/dns/new — the new DNS monitor form. */
export default createAction(routes.app.team.dnsMonitors.new, {
	middleware: [requireUser, requireTeam],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let t = ctx.i18next.getFixedT(null, "translation", "page.createDnsMonitor.form.fields");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New DNS monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.createDnsMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<FormPage>
						<form
							method="post"
							action={routes.actions.monitor.dns.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="basics"
								title={ctx.i18next.t("page.createDnsMonitor.form.sections.basics.title")}
								description={ctx.i18next.t(
									"page.createDnsMonitor.form.sections.basics.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField
											label={t("name.label")}
											description={t("name.description")}
											name="name"
											required
											placeholder={t("name.placeholder")}
										/>

										<TextField
											label={t("domain.label")}
											description={t("domain.description")}
											name="domain"
											required
											placeholder={t("domain.placeholder")}
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="checks"
								title={ctx.i18next.t("page.createDnsMonitor.form.sections.checks.title")}
								description={ctx.i18next.t(
									"page.createDnsMonitor.form.sections.checks.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field label={t("recordType.label")} description={t("recordType.description")}>
											{/* The default is marked on the option, since `<select>` carries no `defaultValue` attribute. */}
											<Select name="record_type">
												{RECORD_TYPES.map((type) => (
													<Select.Option
														key={type}
														value={type}
														selected={type === DEFAULT_RECORD_TYPE}
													>
														{type}
													</Select.Option>
												))}
											</Select>
										</Field>

										<TextField
											label={t("expectedValue.label")}
											description={t("expectedValue.description")}
											name="expected_value"
											defaultValue=""
											placeholder={t("expectedValue.placeholder")}
										/>

										<Field label={t("interval.label")} description={t("interval.description")}>
											{/* Both sides are numbers here, so the match never leans on string coercion. */}
											<Select name="interval_seconds">
												{INTERVAL_OPTIONS.map((option) => (
													<Select.Option
														key={option.value}
														value={option.value}
														selected={option.value === DEFAULT_INTERVAL_SECONDS}
													>
														{t(`interval.options.${option.key}`)}
													</Select.Option>
												))}
											</Select>
										</Field>

										<Switch name="is_enabled" value="true" defaultChecked>
											{t("isEnabled.label")}
										</Switch>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.i18next.t("page.createDnsMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
