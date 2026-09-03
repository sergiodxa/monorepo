/**
 * DNS monitor review page controller. GET /app/:team/dns/:monitorId/review — the step
 * between creating a domain monitor and monitoring anything with it: discovery has already
 * written the monitor's records, and here the visitor accepts or declines each one before it
 * becomes an expectation. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext as getContextType } from "remix/middleware/async-context";
import type { Handle } from "remix/ui";

import { notFound } from "@sdxc/http/response/html";
import { IntlProvider } from "@sdxc/i18n/ui";
import { inject } from "@sdxc/service-container";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { block, hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { maxBs, maxIs } from "@sdxc/u/size";
import { fontSize, overflowWrap } from "@sdxc/u/typography";
import { Alert, Button, Checkbox, Description, LinkButton, Table } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { ZoneFileDuplicate, ZoneFileRejection } from "~/app/services/zone-file";
import type { SelectDnsMonitorRecord } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MAX_TRACKED_NAMES_PER_MONITOR } from "~/app/services/dns-discovery";
import CheckboxGroupSelectAll from "~/resources/components/checkbox-group-select-all";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Session key the create and re-import actions leave their parse report under, read once
 * here and gone. Every parsed line's outcome belongs here, since a rejected or duplicate
 * line's only record of what happened to it is this report.
 */
export const DNS_ZONE_FILE_REPORT = "dnsZoneFileImport";

/** The flash the redirect-after-post pattern leaves behind for one render. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/**
 * What one pasted zone file could not be read as, carried from the action that parsed it.
 * Rejections and duplicates are kept apart: a duplicate names a record DNS answers once, so
 * it counts as imported, while a rejected line names one that stays unwatched.
 */
export interface DnsZoneFileReport {
	rejected: ZoneFileRejection[];
	duplicates: ZoneFileDuplicate[];
}

namespace RecordGroupSection {
	/** Which group's copy and grouping semantics a section renders. */
	export type Kind = "resolving" | "discovered" | "declared";

	export interface Props {
		kind: Kind;
		records: SelectDnsMonitorRecord[];
		/** The request's i18next instance, used to read the `page.dnsMonitorReview.*` copy. */
		i18next: ReturnType<typeof getContextType>["i18next"];
	}
}

/**
 * One group of reviewable records, each checkbox starting checked exactly where its record
 * already stands: discovery stores what it found watched, and a record that appeared on its
 * own stays unwatched until somebody says otherwise.
 */
function RecordGroupSection(handle: Handle<RecordGroupSection.Props>) {
	return () => {
		let { kind, records, i18next } = handle.props;
		let t = i18next.getFixedT(null, "translation", "page.dnsMonitorReview");
		let groupId = `dns-review-${kind}-group`;

		return (
			<SettingsSection
				id={`dns-review-${kind}`}
				title={t(`groups.${kind}.title`)}
				description={t(`groups.${kind}.description`)}
			>
				<SettingsSection.Card>
					<SettingsSection.Body>
						{kind === "declared" && (
							<Description id="dns-review-proxied-note">
								{t("groups.declared.proxiedNote")}
							</Description>
						)}

						<IntlProvider i18n={i18next}>
							<CheckboxGroupSelectAll groupId={groupId} />
						</IntlProvider>

						<Table.Container>
							<Table id={groupId} aria-label={t(`groups.${kind}.title`)}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											<span mix={[visuallyHidden()]}>{t("table.columns.watched")}</span>
										</Table.Column>
										<Table.Column>{t("table.columns.name")}</Table.Column>
										<Table.Column>{t("table.columns.type")}</Table.Column>
										<Table.Column>{t("table.columns.value")}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{records.map((record) => (
										<Table.Row key={record.id}>
											<Table.Cell>
												<Checkbox
													name="record_ids"
													value={record.id}
													defaultChecked={record.is_enabled}
													aria-label={t("table.watchRecord", {
														name: record.name,
														type: record.record_type,
													})}
												/>
											</Table.Cell>
											<Table.Cell>
												<code mix={[overflowWrap("anywhere")]}>{record.name}</code>
											</Table.Cell>
											<Table.Cell>{record.record_type}</Table.Cell>
											<Table.Cell>
												<code
													mix={[
														block(),
														fontSize("sm"),
														maxIs("32rem"),
														maxBs("3lh"),
														overflow("auto"),
														overflowWrap("anywhere"),
													]}
												>
													{record.value}
												</code>
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					</SettingsSection.Body>
				</SettingsSection.Card>
			</SettingsSection>
		);
	};
}

/**
 * The three lists a review screen puts a monitor's records into, rendered discovered first,
 * then resolving, then declared — what needs a decision before what already works.
 */
interface RecordGroups {
	/** Resolving, and stored watched: what discovery found. */
	resolving: SelectDnsMonitorRecord[];
	/** Resolving, and stored unwatched pending a decision: what appeared after the last review. */
	discovered: SelectDnsMonitorRecord[];
	/** Declared by the zone file, never yet observed resolving. */
	declared: SelectDnsMonitorRecord[];
}

/**
 * Splits a monitor's records into the three groups the screen renders. `status === "new"`
 * decides the discovered group over `is_enabled`, which a declined record also carries; the
 * remaining groups split on whether the record has ever resolved, a fact about the record.
 */
function groupRecords(records: readonly SelectDnsMonitorRecord[]): RecordGroups {
	let groups: RecordGroups = { resolving: [], discovered: [], declared: [] };

	for (let record of records) {
		if (record.status === "new") groups.discovered.push(record);
		else if (record.last_seen_at === null) groups.declared.push(record);
		else groups.resolving.push(record);
	}

	return groups;
}

/**
 * GET /app/:team/dns/:monitorId/review — the discovered-records review screen, rendered at
 * full width since a record's value can run to a several-hundred-character key that a
 * narrower reading column would just wrap and crowd.
 */
export default createAction(routes.app.team.dnsMonitors.review, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);

		let session = ctx.get(Session);
		let toast = session?.get("toast") as Toast | undefined;
		let report = session?.get(DNS_ZONE_FILE_REPORT) as DnsZoneFileReport | undefined;

		let groups = groupRecords(records);
		/** The unit the cap counts, and the unit a sweep spends its query budget on. */
		let names = new Set(records.map((record) => record.name)).size;
		/**
		 * Enforced at review, before records become an expectation, since checking anyway would
		 * surface the subrequest ceiling as the customer's DNS having failed. Submit stays visible
		 * but disabled while over the cap, so the reason shown above stays in view.
		 */
		let overNameLimit = names > MAX_TRACKED_NAMES_PER_MONITOR;

		let t = ctx.i18next.getFixedT(null, "translation", "page.dnsMonitorReview");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					toast={toast}
					heading={t("header.title", { name: monitor.name })}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
						{
							label: monitor.name,
							href: routes.app.team.dnsMonitors.show.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							}),
						},
					]}
				>
					<FormPage maxWidth="full">
						<div mix={[vstack({ gap: 12 })]}>
							<p mix={[fg("neutral.muted")]}>{t("header.description")}</p>

							{overNameLimit && (
								<Alert id="dns-review-names-cap" color="warning">
									<Alert.Content>
										<Alert.Title>{t("namesCap.title")}</Alert.Title>
										<Alert.Description>
											{t("namesCap.description", {
												count: names,
												limit: MAX_TRACKED_NAMES_PER_MONITOR,
											})}
										</Alert.Description>
									</Alert.Content>
								</Alert>
							)}

							{report && report.rejected.length > 0 && (
								<SettingsSection
									id="dns-review-unparsed"
									title={t("unparsed.title", { count: report.rejected.length })}
									description={t("unparsed.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<ul mix={[vstack({ gap: 3 }), fontSize("sm")]}>
												{report.rejected.map((rejection) => (
													<li key={`${rejection.line}`} mix={[vstack({ gap: 1 })]}>
														<code mix={[overflowWrap("anywhere")]}>{rejection.input}</code>
														<span mix={[fg("neutral.muted")]}>
															{t("unparsed.line", {
																line: rejection.line,
																reason: t(`unparsed.reasons.${rejection.reason}`),
															})}
														</span>
													</li>
												))}
											</ul>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							{report && report.duplicates.length > 0 && (
								<SettingsSection
									id="dns-review-duplicates"
									title={t("duplicates.title", { count: report.duplicates.length })}
									description={t("duplicates.description")}
								>
									<SettingsSection.Card>
										<SettingsSection.Body>
											<ul mix={[vstack({ gap: 1 }), fontSize("sm"), fg("neutral.muted")]}>
												{report.duplicates.map((duplicate) => (
													<li key={`${duplicate.line}`}>
														{t("duplicates.line", {
															line: duplicate.line,
															firstLine: duplicate.firstLine,
															name: duplicate.name,
															type: duplicate.type,
														})}
													</li>
												))}
											</ul>
										</SettingsSection.Body>
									</SettingsSection.Card>
								</SettingsSection>
							)}

							{records.length === 0 ? (
								<Description>{t("empty")}</Description>
							) : (
								<form
									method="post"
									action={routes.actions.monitor.dns.review.href({ team: ctx.team.slug })}
									mix={[vstack({ gap: 12 })]}
								>
									<input type="hidden" name="monitor_id" value={monitor.id} />

									{groups.discovered.length > 0 && (
										<RecordGroupSection
											kind="discovered"
											records={groups.discovered}
											i18next={ctx.i18next}
										/>
									)}
									{groups.resolving.length > 0 && (
										<RecordGroupSection
											kind="resolving"
											records={groups.resolving}
											i18next={ctx.i18next}
										/>
									)}
									{groups.declared.length > 0 && (
										<RecordGroupSection
											kind="declared"
											records={groups.declared}
											i18next={ctx.i18next}
										/>
									)}

									<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
										<LinkButton
											href={routes.app.team.dnsMonitors.show.href({
												team: ctx.team.slug,
												monitorId: monitor.id,
											})}
										>
											{t("cancel")}
										</LinkButton>
										<Button type="submit" disabled={overNameLimit}>
											{t("cta")}
										</Button>
									</div>
								</form>
							)}
						</div>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
