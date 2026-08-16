/**
 * New DNS monitor form page controller. Posts to the `create-dns-monitor` action.
 * Requires `requireUser` + `requireTeam`.
 *
 * A monitor here is a domain, not a record type: the three things it asks for are the
 * domain, an optional pasted zone file, and how often every name found gets resolved.
 * They are grouped into three bordered cards inside a single `<form>`, so the page reads
 * as distinct settings groups while still submitting as one request. The submit control
 * sits at the foot of the last card rather than loose under the fields.
 *
 * The zone-file box is not a convenience. DNS refuses to enumerate a zone from outside it,
 * so a paste is the only channel through which the *names* in a zone can reach us, and
 * without one this monitor covers the apex and nothing else. That is said on this screen
 * rather than only in the docs, because it is the difference between what "domain
 * monitoring" sounds like and what it is, and this is the screen where the visitor decides.
 *
 * The field markup is spelled out here instead of coming from the shared DNS field
 * component, because carding the form means rendering the fields across three boxes, and
 * that component emits them as one fragment with no way to ask for a subset. The edit page
 * still renders it unchanged.
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
 * How often every tracked name is resolved, in seconds, paired with the locale key naming
 * each span.
 *
 * The list floors at 900 rather than at the 300 the other monitor types offer: a domain
 * monitor sweeps every supported type at every known name, so a faster cadence buys
 * detection latency the records' own TTLs put a floor under anyway, and it is not a bound a
 * form should put one click away.
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

/** The paste ceiling as the screen states it, so the copy and the parser cannot disagree. */
const MAX_ZONE_FILE_LABEL = `${MAX_ZONE_FILE_BYTES / 1024} KiB`;

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
											{/* Spellcheck off: every line is a hostname or an RDATA literal, and a
											    red squiggle under all of them makes a correct paste look wrong. */}
											<TextArea
												name="zone_file"
												rows={10}
												spellcheck={false}
												placeholder={t("zoneFile.placeholder")}
											/>
										</Field>

										{/* The two bounds a paste is refused against, stated where the pasting
										    happens: the size the text is read up to, and the number of names one
										    monitor can sweep in a single pass. */}
										<Description id="dns-zone-file-limits">
											{t("zoneFile.limits", {
												size: MAX_ZONE_FILE_LABEL,
												limit: MAX_TRACKED_NAMES_PER_MONITOR,
											})}
										</Description>

										{/*
										 * Announced politely rather than as an alert: it is a standing property of
										 * DNS, true of this form before the visitor has done anything wrong, and
										 * interrupting a screen reader with it on load would frame a limit as an
										 * error. It is on the screen at all because the gap between "domain
										 * monitoring" and "the apex only" is decided here, not in the docs.
										 */}
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
