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

import { formatDateTime } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items, vstack } from "@sdxc/u/layout";
import { is, m, mbe, mbs } from "@sdxc/u/size";
import { fontSize, nowrap, overflowWrap } from "@sdxc/u/typography";
import { Badge, Button, Empty, LinkButton, Table } from "@sdxc/ui";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectDnsMonitor, SelectDnsMonitorRecord } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import RegistrationBadge from "~/resources/components/registration-badge";
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
 * The sentence explaining why there is no current registration data, keyed by the last
 * lookup's error: the two answers about the name each name their own fix, and every other
 * failure is an outage retried on its own. `null` when the last lookup succeeded.
 */
function registrationReasonKey(monitor: SelectDnsMonitor): string | null {
	if (monitor.registration_error === null) return null;
	if (monitor.registration_error === "not-found") return "notFound";
	if (monitor.registration_error === "unsupported-tld") return "unsupportedTld";
	return "failing";
}

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
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		let records = await ctx.models.dnsMonitorRecords.listByMonitor(monitor.id);
		let watchedCount = records.filter((record) => record.is_enabled).length;
		let registrationReason = registrationReasonKey(monitor);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.dnsMonitorDetail.header.title", { name: monitor.name })}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dnsMonitors"),
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
									{ctx.intl.t("page.dnsMonitorDetail.header.action.check")}
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.dnsMonitors.show.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<RefreshCwIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.dnsMonitorDetail.header.action.refresh")}
							</LinkButton>
							<LinkButton
								href={routes.app.team.dnsMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.dnsMonitorDetail.header.action.edit")}
							</LinkButton>
						</div>
					}
				>
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<StatCard
								label={ctx.intl.t("page.dnsMonitorDetail.info.domain")}
								value={<code>{monitor.domain}</code>}
							/>
							<StatCard
								label={ctx.intl.t("page.dnsMonitorDetail.info.status")}
								value={
									<Badge
										{...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{monitor.last_status ?? ctx.intl.t("page.dnsMonitorDetail.notChecked")}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.intl.t("page.dnsMonitorDetail.info.recordsWatched")}
								value={ctx.intl.t("page.dnsMonitorDetail.info.recordsWatchedValue", {
									enabled: watchedCount,
									total: records.length,
								})}
							/>
							<StatCard
								label={ctx.intl.t("page.dnsMonitorDetail.info.zoneFileImported")}
								value={
									monitor.zone_file_imported_at === null
										? ctx.intl.t("page.dnsMonitorDetail.info.zoneFileNeverImported")
										: formatDateTime(new Date(monitor.zone_file_imported_at), {
												locale: ctx.locale,
												timeZone: "UTC",
											})
								}
							/>
						</div>

						<section mix={[vstack({ gap: 3 }), mbe("24px")]}>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0)]}>{ctx.intl.t("page.dnsMonitorDetail.registration.title")}</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.intl.t("page.dnsMonitorDetail.registration.description", {
										days: monitor.registration_warning_days,
									})}
								</p>
							</div>

							<div mix={[flex(), flexWrap(), gap("16px")]}>
								<StatCard
									label={ctx.intl.t("page.dnsMonitorDetail.registration.status")}
									value={<RegistrationBadge status={monitor.registration_status} intl={ctx.intl} />}
								/>
								<StatCard
									label={ctx.intl.t("page.dnsMonitorDetail.registration.expiresAt")}
									value={
										monitor.registration_expires_at === null
											? ctx.intl.t("page.dnsMonitorDetail.registration.notPublished")
											: formatDateTime(new Date(monitor.registration_expires_at), {
													locale: ctx.locale,
													timeZone: "UTC",
												})
									}
								/>
								<StatCard
									label={ctx.intl.t("page.dnsMonitorDetail.registration.registrar")}
									value={
										monitor.registrar ??
										ctx.intl.t("page.dnsMonitorDetail.registration.notPublished")
									}
								/>
								<StatCard
									label={ctx.intl.t("page.dnsMonitorDetail.registration.checkedAt")}
									value={
										monitor.registration_checked_at === null
											? ctx.intl.t("page.dnsMonitorDetail.registration.never")
											: formatDateTime(new Date(monitor.registration_checked_at), {
													locale: ctx.locale,
													timeZone: "UTC",
												})
									}
								/>
							</div>

							{monitor.registration_epp_statuses && monitor.registration_epp_statuses.length > 0 ? (
								<div mix={[flex(), flexWrap(), items("center"), gap("8px")]}>
									<span mix={[fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.dnsMonitorDetail.registration.eppStatuses")}
									</span>
									{monitor.registration_epp_statuses.map((status) => (
										<Badge key={status} {...badgeVariant("neutral")}>
											<code>{status}</code>
										</Badge>
									))}
								</div>
							) : null}

							{registrationReason === null ? null : (
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.intl.t(`page.dnsMonitorDetail.registration.reasons.${registrationReason}`, {
										code: monitor.registration_error ?? "",
									})}
								</p>
							)}
						</section>

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
								<h2 mix={[m(0)]}>{ctx.intl.t("page.dnsMonitorDetail.records.title")}</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.intl.t("page.dnsMonitorDetail.records.description")}
								</p>
							</div>

							{records.length === 0 ? (
								<Empty>
									<Empty.Description>
										{ctx.intl.t("page.dnsMonitorDetail.records.empty")}
									</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={ctx.intl.t("page.dnsMonitorDetail.records.title")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.name")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.type")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.value")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.source")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.state")}
												</Table.Column>
												<Table.Column mix={[is("1%"), nowrap()]}>
													{ctx.intl.t("page.dnsMonitorDetail.records.table.columns.watched")}
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
														{ctx.intl.t(`page.dnsMonitorDetail.records.source.${record.source}`)}
													</Table.Cell>
													<Table.Cell>
														<Badge {...badgeVariant(recordStateTone(record))}>
															{ctx.intl.t(`page.dnsMonitorDetail.records.state.${record.status}`)}
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
																	? ctx.intl.t("page.dnsMonitorDetail.records.actions.disable")
																	: ctx.intl.t("page.dnsMonitorDetail.records.actions.enable")}
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
	},
});
