/**
 * DNS monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * A monitor is a domain rather than a record type, so the page's subject is the set of
 * records it tracks: the shell reads the monitor row and that record list, while the three
 * things that cost a query each — the result-derived summary, the 90-day uptime bar and
 * the check history — load into their own named `Frame`s over a skeleton fallback, so none
 * of them delays the page or each other.
 *
 * The order narrows from claim to evidence: what the domain is, how it has behaved in
 * summary, that behaviour day by day, the records being watched, and finally the raw check
 * log. The log goes last because it is the least-scanned thing on the page — nobody opens
 * a monitor to read every check, only to read the one that went wrong — and it sits under
 * a record table that is itself long, since a real zone runs to dozens of rows. Anything
 * placed below that table is effectively opt-in, which is exactly what the log should be.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { flex, flexWrap, gap, items, vstack } from "@pkg/u/layout";
import { is, m, mbe, mbs } from "@pkg/u/size";
import { fontSize, nowrap, overflowWrap } from "@pkg/u/typography";
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

						{/*
						 * A `Frame` is a region rather than an element, so a margin set inside a
						 * fragment does not reliably survive the swap. Every gap around a frame is
						 * therefore owned here, on a wrapper this page renders, and it has to hold
						 * for the resolved content just as it does for the skeleton.
						 *
						 * `StatCardSkeleton` also renders bare cards with no row of its own, so
						 * several frames can share one row a caller lays out. None of the frames
						 * here shares a row, so each opens its fallback with the row its own
						 * placeholders sit in — otherwise the cards stack flush while the page
						 * loads, which is not the shape any fragment resolves to. Each `count`
						 * matches what the fragment actually resolves to, since a fallback of the
						 * wrong height moves the page when it swaps.
						 */}
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

						{/*
						 * The block above ends on a `Frame`, so the space between it and this table
						 * lives here rather than as a trailing margin on a fragment this page does
						 * not own.
						 */}
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
												{/*
												 * The control's label is a whole phrase ("Stop watching"), and a
												 * column wide enough for one word breaks it over two lines, which
												 * makes every row in the table taller. `1%` is the shrink-to-fit
												 * width in an auto-laid-out table — the column takes what its
												 * content demands and the value column absorbs the slack — and the
												 * cell refuses to wrap so that demand is the label's full width.
												 * The table scrolls in its own container, so nothing here can push
												 * the page sideways.
												 */}
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

						{/*
						 * The raw log, last and below the record table, with the gap owned by this
						 * wrapper for the same reason as above.
						 */}
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
