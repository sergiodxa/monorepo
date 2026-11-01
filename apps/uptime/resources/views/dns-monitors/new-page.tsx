/**
 * The new DNS monitor page, drawn by the form's GET route and again by the create action when
 * it refuses a submission, so a rejected form, pasted zone file included, comes back holding
 * everything that was typed with a message on each field to fix.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { Alert, Button, Description, Select, Switch, TextArea, TextField } from "@sdxc/ui";
import { getContext } from "remix/middleware/async-context";

import type { DnsMonitorSubmission } from "~/resources/views/dns-monitors/form";

import { getViewer } from "~/app/http/middleware/auth";
import { MAX_TRACKED_NAMES_PER_MONITOR } from "~/app/services/dns/discovery";
import { withPrefix } from "~/app/services/prefixed-translate";
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

export namespace NewDnsMonitorPage {
	export interface Props {
		/** The submission the create action refused; omitted on a first visit. */
		submission?: DnsMonitorSubmission;
	}
}

/**
 * Renders the whole document for the current request's team and signed-in viewer. The
 * apex-only limit reads as a polite status update, since it holds before the visitor does
 * anything, and an alert on load would cast a standing property of DNS as an error.
 */
export default function NewDnsMonitorPage(handle: Handle<NewDnsMonitorPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");

		let { submission } = handle.props;
		let values = submission?.values ?? {};
		let issues = submission?.issues ?? {};
		let intervalSeconds = Number(values.interval_seconds ?? DEFAULT_INTERVAL_SECONDS);
		let t = withPrefix(ctx.intl.t, "page.createDnsMonitor.form.fields");

		return (
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · New DNS monitor`}>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug })}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.createDnsMonitor.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dnsMonitors"),
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
							{submission && (
								<Alert id="dns-monitor-form-issues" color="danger">
									<Alert.Content>
										<Alert.Description>
											{ctx.intl.t("page.dnsMonitors.form.issues.summary")}
										</Alert.Description>
									</Alert.Content>
								</Alert>
							)}

							<SettingsSection
								id="basics"
								title={ctx.intl.t("page.createDnsMonitor.form.sections.basics.title")}
								description={ctx.intl.t("page.createDnsMonitor.form.sections.basics.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField
											label={t("name.label")}
											description={t("name.description")}
											name="name"
											required
											defaultValue={values.name}
											placeholder={t("name.placeholder")}
											errorMessage={issues.name}
										/>

										<TextField
											label={t("domain.label")}
											description={t("domain.description")}
											name="domain"
											required
											defaultValue={values.domain}
											placeholder={t("domain.placeholder")}
											errorMessage={issues.domain}
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="zone-file"
								title={ctx.intl.t("page.createDnsMonitor.form.sections.zoneFile.title")}
								description={ctx.intl.t("page.createDnsMonitor.form.sections.zoneFile.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field
											label={t("zoneFile.label")}
											description={t("zoneFile.description")}
											error={issues.zone_file}
										>
											<TextArea
												name="zone_file"
												rows={10}
												spellcheck={false}
												placeholder={t("zoneFile.placeholder")}
												defaultValue={values.zone_file}
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
													{ctx.intl.t("page.createDnsMonitor.form.apexOnlyNotice")}
												</Alert.Description>
											</Alert.Content>
										</Alert>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							<SettingsSection
								id="checks"
								title={ctx.intl.t("page.createDnsMonitor.form.sections.checks.title")}
								description={ctx.intl.t("page.createDnsMonitor.form.sections.checks.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<Field
											label={t("interval.label")}
											description={t("interval.description")}
											error={issues.interval_seconds}
										>
											<Select name="interval_seconds">
												{INTERVAL_OPTIONS.map((option) => (
													<Select.Option
														key={option.value}
														value={option.value}
														selected={option.value === intervalSeconds}
													>
														{t(`interval.options.${option.key}`)}
													</Select.Option>
												))}
											</Select>
										</Field>

										<Switch
											name="is_enabled"
											value="true"
											defaultChecked={values.is_enabled ?? true}
										>
											{t("isEnabled.label")}
										</Switch>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">{ctx.intl.t("page.createDnsMonitor.form.cta")}</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>
		);
	};
}
