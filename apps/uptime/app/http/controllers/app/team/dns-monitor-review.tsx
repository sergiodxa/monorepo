/**
 * DNS monitor review page controller. GET /app/:team/dns/:monitorId/review — the step
 * between creating a domain monitor and monitoring anything with it: discovery has already
 * run and written the monitor's records, and this is where the visitor accepts or declines
 * each one before it becomes an expectation. Requires `requireUser` + `requireTeam`.
 *
 * Three groups, because the three mean different things and a single list would flatten
 * them into one undifferentiated claim: records that resolve right now, records that
 * appeared since the last review and are therefore waiting to be accepted, and records the
 * pasted zone declares that nothing answers for today. Each checkbox starts where the row
 * itself stands — a discovered record is stored watched and a newly appeared one is not —
 * so the screen never offers a default the database does not already hold.
 *
 * The zone file is parsed at submit and discarded, so the report of what could not be read
 * cannot be recomputed here. It arrives in the session, for one render, under
 * {@link DNS_ZONE_FILE_REPORT}, and is shown above the records: an import that decides what
 * gets monitored is the worst possible place for a silent omission.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { getContext as getContextType } from "remix/async-context-middleware";
import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import { inject } from "@pkg/service-container";
import { visuallyHidden } from "@pkg/u/a11y";
import { fg } from "@pkg/u/color";
import { block, hstack, vstack } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { maxBs, maxIs } from "@pkg/u/size";
import { fontSize, overflowWrap } from "@pkg/u/typography";
import { Alert, Button, Checkbox, Description, LinkButton, Table } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
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
 * here and gone. It travels through the session rather than through the record table
 * because a line that did not become a record has nowhere in that table to be.
 */
export const DNS_ZONE_FILE_REPORT = "dnsZoneFileImport";

/** The flash the redirect-after-post pattern leaves behind for one render. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/**
 * What one pasted zone file could not be read as, carried from the action that parsed it.
 *
 * Rejections and duplicates are kept apart because they are not the same news. A rejected
 * line declares something that is now not monitored; a duplicate declares a record an
 * earlier line already declared, which DNS itself answers once — so it was imported, and
 * counting it as "not imported" would report a complete import as a partial one.
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
 * One group of reviewable records: its heading, a select-all control over its own boxes,
 * and a table of one row per record — a checkbox, then the name, type and value in aligned
 * columns, which is the only way a zone's worth of records can be scanned at all.
 *
 * Each box starts where the record itself stands rather than at a fixed default, so the
 * screen never offers a choice the database does not already hold: discovery stores what it
 * found watched, while a record that appeared on its own is stored unwatched until somebody
 * says otherwise, and both render as themselves.
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
						{/*
						 * Said only where it applies. A proxied record is absent from its own zone
						 * export and answers as the proxy's address, so on a proxied zone this group
						 * is the common case rather than the exceptional one, and a screen that
						 * implied a fault would be describing a working setup as a broken one.
						 */}
						{kind === "declared" && (
							<Description id="dns-review-proxied-note">
								{t("groups.declared.proxiedNote")}
							</Description>
						)}

						{/* The island reads its copy through `intl(handle)`, which server-side has no
						    module-scoped `setIntl()` default to fall back on, so it needs an
						    `IntlProvider` ancestor to resolve against at all. */}
						<IntlProvider i18n={i18next}>
							<CheckboxGroupSelectAll groupId={groupId} />
						</IntlProvider>

						{/*
						 * A table, and the same Name · Type · Value shape the monitor's own record
						 * list uses: the decision being asked for is "which of these do I want to
						 * hear about", which is read by scanning one column at a time. The id sits
						 * here because the select-all island drives every checkbox descending from
						 * it, and every one of them is a row of this table.
						 */}
						<Table.Container>
							<Table id={groupId} aria-label={t(`groups.${kind}.title`)}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{/* The column holds only checkboxes, which name themselves; the
											    heading exists so the column is announced at all. */}
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
											{/*
											 * A DKIM key is ~400 unbroken characters, and one left to itself sets
											 * the height of every row around it. So the value gets a bounded box
											 * that scrolls its own overflow: the row height is capped whatever the
											 * value holds, and unlike a truncation the whole key stays present —
											 * the only real use for it is copying it out and comparing it against
											 * what the provider says it should be.
											 */}
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

/** The three lists a review screen puts a monitor's records into. */
interface RecordGroups {
	/** Resolving, and stored watched: what discovery found. */
	resolving: SelectDnsMonitorRecord[];
	/** Resolving, and stored unwatched pending a decision: what appeared after the last review. */
	discovered: SelectDnsMonitorRecord[];
	/** Declared by the zone file, never yet observed resolving. */
	declared: SelectDnsMonitorRecord[];
}

/**
 * Splits a monitor's records into the three groups the screen renders.
 *
 * `status === "new"` is the record's own standing state — it holds until the visitor
 * enables or deletes the row — so it decides the group rather than `is_enabled`, which a
 * declined record also carries. Everything else is grouped on whether the record has ever
 * been seen resolving, which is a fact about the record and not about how it arrived: a
 * zone-file line that resolves belongs with the rest of the live zone.
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

/** GET /app/:team/dns/:monitorId/review — the discovered-records review screen. */
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
					{/*
					 * Full width rather than the default reading column. Every other form here
					 * is a stack of labelled fields, where a narrow measure helps; this page is
					 * a table of a customer's whole zone, and a record's value can be a
					 * 400-character key. Constraining it to 640px spends the screen on empty
					 * margins and buys nothing back — the shell's own padding is the only inset
					 * this page wants.
					 */}
					<FormPage maxWidth="full">
						<div mix={[vstack({ gap: 12 })]}>
							<p mix={[fg("neutral.muted")]}>{t("header.description")}</p>

							{/*
							 * The cap is enforced where §9a puts it — at review, before any of this
							 * becomes an expectation — because the alternative is discovering the
							 * subrequest ceiling at check time, where it reads as the customer's DNS
							 * having failed rather than as our having stopped looking.
							 */}
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

							{/*
							 * Its own block, below the rejections and never counted with them: a real
							 * provider export writes the same record on two lines, DNS answers such an
							 * RRset once, and the record is imported. Reporting that as a line "not
							 * imported" would describe a complete import as a partial one.
							 */}
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

									{/* Ordered by what the visitor has to decide first: records that appeared
									    on their own and are waiting to be accepted, then the live zone, then
									    what only the pasted file knows about. */}
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

									{/*
									 * A bare action row rather than a card footer: the decision belongs to
									 * every group at once, and a card holding nothing but a footer would draw
									 * its divider line flush against its own top border.
									 */}
									<div mix={[hstack({ gap: 2, align: "center", justify: "end" })]}>
										<LinkButton
											href={routes.app.team.dnsMonitors.show.href({
												team: ctx.team.slug,
												monitorId: monitor.id,
											})}
										>
											{t("cancel")}
										</LinkButton>
										{/*
										 * Disabled rather than hidden while the monitor is over the name cap:
										 * the visitor is meant to see that saving is the thing being refused,
										 * and the reason for it sits at the top of the same page.
										 */}
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
