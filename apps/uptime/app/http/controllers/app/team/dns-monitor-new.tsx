/**
 * New DNS monitor form page controller. Posts to the `create-dns-monitor` action
 * behind `requireUser` + `requireTeam`.
 *
 * A pasted zone is the only channel through which a domain's other names reach
 * this monitor; apex-only coverage is the default until one arrives. That limit
 * is stated on this screen, where the visitor decides whether to paste — closing
 * the gap between what "domain monitoring" sounds like and what it is.
 *
 * Fields are spelled out directly here since carding the form spans three boxes,
 * while the shared DNS field component emits them as a single one-card fragment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@pkg/u/layout";
import { Alert, Button, Description, Select, Switch, TextArea, TextField } from "@pkg/ui";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MAX_TRACKED_NAMES_PER_MONITOR } from "~/app/services/dns-discovery";
import { MAX_ZONE_FILE_BYTES } from "~/app/services/zone-file";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * How often every tracked name is resolved, in seconds, paired with the locale
 * key naming each span. A domain sweep already queries every type at every name,
 * so the 900s floor rests on each record's own TTL bounding detection latency.
 */
const INTERVAL_OPTIONS = [
	{ value: 900, key: "15m" },
	{ value: 1800, key: "30m" },
	{ value: 3600, key: "1h" },
	{ value: 21_600, key: "6h" },
	{ value: 43_200, key: "12h" },
	{ value: 86_400, key: "24h" },
] as const;

/**
 * Interval a new monitor starts on, in seconds, matched against {@link INTERVAL_OPTIONS} to
 * mark its option. Daily, because DNS changes are human-caused and human-paced.
 */
const DEFAULT_INTERVAL_SECONDS = 86_400;

/** The paste ceiling as the screen states it, keeping the copy and the parser in agreement. */
const MAX_ZONE_FILE_LABEL = `${MAX_ZONE_FILE_BYTES / 1024} KiB`;

/**
 * GET /app/:team/dns/new — the new DNS monitor form. The apex-only limit reads as
 * a polite status update, since it holds before the visitor does anything, and an
 * alert on load would cast a standing property of DNS as an error.
 */
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
					i18next={ctx.i18next}
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
								id="zone-file"
								title={ctx.i18next.t("page.createDnsMonitor.form.sections.zoneFile.title")}
								description={ctx.i18next.t(
									"page.createDnsMonitor.form.sections.zoneFile.description",
								)}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field label={t("zoneFile.label")} description={t("zoneFile.description")}>
											<TextArea
												name="zone_file"
												rows={10}
												spellcheck={false}
												placeholder={t("zoneFile.placeholder")}
											/>
										</Field>

										<Description id="dns-zone-file-limits">
											{t("zoneFile.limits", {
												size: MAX_ZONE_FILE_LABEL,
												limit: MAX_TRACKED_NAMES_PER_MONITOR,
											})}
										</Description>

										<Alert id="dns-apex-only-notice" color="neutral" live="off">
											<Alert.Content>
												<Alert.Description>
													{ctx.i18next.t("page.createDnsMonitor.form.apexOnlyNotice")}
												</Alert.Description>
											</Alert.Content>
										</Alert>
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
										<Field label={t("interval.label")} description={t("interval.description")}>
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
