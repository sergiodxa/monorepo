/**
 * DNS monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * A monitor is a domain rather than a record type, so the page's subject is the set of
 * records it tracks: the shell reads the monitor row and that record list, and the two
 * things that cost a query each — the 90-day uptime bar and the result history — load
 * into their own named `Frame`s over a skeleton fallback, so neither delays the page nor
 * the other. The record list is rendered inline instead, above both, because it is what
 * the visitor came for and because a record awaiting a decision must not arrive after
 * the history that does not mention it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { flex, flexWrap, gap, items, vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { mbe } from "@pkg/u/size";
import { fontSize, overflowWrap } from "@pkg/u/typography";
import { Badge, Button, Empty, LinkButton, Table } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Frame } from "remix/ui";

import type { SelectDnsMonitorRecord } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

/**
 * The tone a tracked record's state is drawn in, which is where two of this feature's
 * least obvious truths are expressed.
 *
 * A record nobody watches is never drawn as a failure. On a proxied zone the commonest
 * record of all is one the customer's zone file declares while public DNS answers with the
 * proxy's own address instead — nothing is broken, the record genuinely is not published —
 * so `missing` on an unwatched row reads neutral. The same goes for a record the visitor
 * declined: we still look, and what we see is not a finding.
 *
 * A `new` record is the exception among unwatched rows. It is not an error either — we do
 * not know whether the visitor put it there — but it is the one state that is waiting on a
 * person, so it keeps the attention tone until they watch it or delete it.
 */
function recordStateTone(record: SelectDnsMonitorRecord): BadgeTone {
	if (record.status === "new") return "degraded";
	if (record.status === "error") return "down";
	if (!record.is_enabled) return "neutral";
	if (record.status === "missing") return "down";
	if (record.status === "changed") return "degraded";
	return "up";
}

/** GET /app/:team/dns/:monitorId — a DNS monitor's detail page. */
export default createAction(routes.app.team.dnsMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		// Already ordered by name, then type, then value, which is the grouping the page
		// renders: every record of one name arrives together, and the removal and addition
		// an edited RRset produces land next to each other rather than pages apart.
		let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		let watchedCount = records.filter((record) => record.is_enabled).length;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.dnsMonitorDetail.header.title", { name: monitor.name })}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[flex(), items("center"), gap("12px")]}>
							<form
								method="post"
								action={routes.actions.monitor.dns.check.href({ team: ctx.team.slug })}
								mix={[m("0")]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<Button type="submit">
									<PlayIcon size={16} strokeWidth={1.5} />
									{ctx.i18next.t("page.dnsMonitorDetail.header.action.check")}
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.dnsMonitors.show.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<RefreshCwIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.refresh")}
							</LinkButton>
							<LinkButton
								href={routes.app.team.dnsMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.edit")}
							</LinkButton>
						</div>
					}
				>
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.domain")}
								value={<code>{monitor.domain}</code>}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.status")}
								value={
									<Badge
										{...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{monitor.last_status ?? ctx.i18next.t("page.dnsMonitorDetail.notChecked")}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.recordsWatched")}
								value={ctx.i18next.t("page.dnsMonitorDetail.info.recordsWatchedValue", {
									enabled: watchedCount,
									total: records.length,
								})}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.zoneFileImported")}
								value={
									monitor.zone_file_imported_at === null
										? ctx.i18next.t("page.dnsMonitorDetail.info.zoneFileNeverImported")
										: new Date(monitor.zone_file_imported_at).toLocaleString()
								}
							/>
						</div>

						<section mix={[vstack({ gap: 3 }), mbe("24px")]}>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0)]}>{ctx.i18next.t("page.dnsMonitorDetail.records.title")}</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.dnsMonitorDetail.records.description")}
								</p>
							</div>

							{records.length === 0 ? (
								<Empty>
									<Empty.Description>
										{ctx.i18next.t("page.dnsMonitorDetail.records.empty")}
									</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={ctx.i18next.t("page.dnsMonitorDetail.records.title")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.name")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.type")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.value")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.source")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.state")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.dnsMonitorDetail.records.table.columns.watched")}
												</Table.Column>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{records.map((record) => (
												<Table.Row key={record.id}>
													<Table.Cell>
														<code>{record.name}</code>
													</Table.Cell>
													<Table.Cell>{record.record_type}</Table.Cell>
													{/*
													 * A TXT value is routinely a whole DKIM key, so the cell wraps
													 * anywhere rather than pushing the row's own actions off-screen.
													 */}
													<Table.Cell>
														<code mix={[overflowWrap("anywhere")]}>{record.value}</code>
													</Table.Cell>
													<Table.Cell>
														{ctx.i18next.t(`page.dnsMonitorDetail.records.source.${record.source}`)}
													</Table.Cell>
													<Table.Cell>
														<Badge {...badgeVariant(recordStateTone(record))}>
															{ctx.i18next.t(
																`page.dnsMonitorDetail.records.state.${record.status}`,
															)}
														</Badge>
													</Table.Cell>
													{/*
													 * The control is the state: a row offering "Stop watching" is
													 * watched, one offering "Watch" is not. A discovered record arrives
													 * disabled on purpose — accepting it has to be something a person
													 * did, not something that happened by not reading the email — and
													 * this button is that act.
													 */}
													<Table.Cell>
														<form
															method="post"
															action={routes.actions.monitor.dns.toggleRecord.href({
																team: ctx.team.slug,
															})}
															mix={[m("0")]}
														>
															<input type="hidden" name="monitor_id" value={monitor.id} />
															<input type="hidden" name="record_id" value={record.id} />
															<input
																type="hidden"
																name="is_enabled"
																value={record.is_enabled ? "false" : "true"}
															/>
															<Button type="submit" variant="outline" size="sm">
																{record.is_enabled
																	? ctx.i18next.t("page.dnsMonitorDetail.records.actions.disable")
																	: ctx.i18next.t("page.dnsMonitorDetail.records.actions.enable")}
															</Button>
														</form>
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</section>

						<Frame
							name="dns-monitor-card-uptime-history"
							src={routes.app.team.dnsMonitors.cards.uptimeHistory.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={<StatCardSkeleton count={1} />}
						/>

						<Frame
							name="dns-monitor-card-results"
							src={routes.app.team.dnsMonitors.cards.results.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={<StatCardSkeleton count={3} />}
						/>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
