/**
 * DNS monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * The summary, uptime history, and check history each cost a query, so each loads into
 * its own `Frame` over a skeleton fallback while the page around it renders right away.
 * The check log sits last, below the record table, since it's the least-scanned section.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@pkg/icons";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { flex, flexWrap, gap, items, vstack } from "@pkg/u/layout";
import { is, m, mbe, mbs } from "@pkg/u/size";
import { fontSize, nowrap, overflowWrap } from "@pkg/u/typography";
import { Badge, Button, Empty, LinkButton, Table } from "@pkg/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
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
 * A disabled record reads neutral, since nobody has committed to watching it, so
 * whatever it currently looks like is expected. A `new` record keeps the attention
 * tone regardless, since it still awaits a person's decision to watch or delete it.
 */
function recordStateTone(record: SelectDnsMonitorRecord): BadgeTone {
	if (record.status === "new") return "degraded";
	if (record.status === "error") return "down";
	if (!record.is_enabled) return "neutral";
	if (record.status === "missing") return "down";
	if (record.status === "changed") return "degraded";
	return "up";
}

/**
 * GET /app/:team/dns/:monitorId — a DNS monitor's detail page.
 *
 * Records arrive already ordered by name, then type, then value, matching the table's
 * display grouping, so edits within one RRset appear together.
 */
export default createAction(routes.app.team.dnsMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

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
					i18next={ctx.i18next}
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

						<Frame
							name="dns-monitor-card-results"
							src={routes.app.team.dnsMonitors.cards.results.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={
								<div mix={[flex(), flexWrap(), gap("16px")]}>
									<StatCardSkeleton count={2} />
								</div>
							}
						/>

						<div mix={[mbs("24px")]}>
							<Frame
								name="dns-monitor-card-uptime-history"
								src={routes.app.team.dnsMonitors.cards.uptimeHistory.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={
									<div mix={[flex(), flexWrap(), gap("16px")]}>
										<StatCardSkeleton count={1} />
									</div>
								}
							/>
						</div>

						<section mix={[vstack({ gap: 3 }), mbs("24px")]}>
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
												<Table.Column mix={[is("1%"), nowrap()]}>
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
													<Table.Cell mix={[is("1%"), nowrap()]}>
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

						<div mix={[mbs("24px")]}>
							<Frame
								name="dns-monitor-card-check-history"
								src={routes.app.team.dnsMonitors.cards.checkHistory.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={
									<div mix={[flex(), flexWrap(), gap("16px")]}>
										<StatCardSkeleton count={1} />
									</div>
								}
							/>
						</div>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
