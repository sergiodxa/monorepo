/**
 * DNS monitors list controller. Renders every DNS monitor for the team with its last-known
 * status and how much of its domain it watches, narrowed by the search and status filters
 * the URL carries, or an empty state when there are none yet. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";
import type { Database } from "remix/data-table";

import { GlobeIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flex, flexWrap, gap, items } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Badge, LinkButton, RelativeTime, StatusDot } from "@sdxc/ui";
import { clearFiltersHref, Empty, FilterBar, paramValues, Table } from "@sdxc/ui/app";
import { getTableName } from "remix/data-table";
import { createAction } from "remix/router";

import type { SelectDnsMonitor } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { dnsMonitorRecords } from "~/database/schema";
import { badgeVariant } from "~/resources/components/badge";
import RegistrationBadge from "~/resources/components/registration-badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

/** A monitor's status as the list filters it: its last sweep's outcome, or `pending` before any. */
type DnsListStatus = "ok" | "changed" | "error" | "pending";

/** The status facet's values, from settled to unknown. */
const STATUS_ORDER: readonly DnsListStatus[] = ["ok", "changed", "error", "pending"];

/** The dot color each status is drawn in, shared by the facet and the status column. */
const STATUS_COLOR: Record<DnsListStatus, SemanticColor> = {
	ok: "success",
	changed: "warning",
	error: "danger",
	pending: "neutral",
};

/** Every query parameter this list filters by, which "Clear filters" removes together. */
const FILTER_PARAMS = ["q", "status"];

/** Reads a monitor's filterable status, folding a never-checked monitor into `pending`. */
function listStatus(monitor: SelectDnsMonitor): DnsListStatus {
	return STATUS_ORDER.find((status) => status === monitor.last_status) ?? "pending";
}

/**
 * Keeps the monitors matching the URL's filters: `q` matches the name or domain without
 * regard to case, and each `status` value widens the set, so an empty filter keeps them all.
 */
function filterMonitors(
	monitors: SelectDnsMonitor[],
	query: string,
	statuses: string[],
): SelectDnsMonitor[] {
	let needle = query.trim().toLowerCase();

	return monitors.filter((monitor) => {
		if (statuses.length > 0 && !statuses.includes(listStatus(monitor))) return false;
		if (needle === "") return true;
		return (
			monitor.name.toLowerCase().includes(needle) || monitor.domain.toLowerCase().includes(needle)
		);
	});
}

/** How many records a monitor tracks, and how many of those a deviation would alert on. */
interface RecordCounts {
	total: number;
	watched: number;
}

/**
 * Counts every listed monitor's records in one statement, keyed by monitor.
 * A single `GROUP BY` counts every monitor's records in one round trip; the `IN`
 * list stays within the per-team cap, keeping the query under the bound-parameter limit.
 *
 * @returns Counts for the monitors that have records. A monitor with none is absent, and the caller reads that as the zero it is.
 */
async function countRecords(
	db: Database,
	monitorIds: string[],
): Promise<Map<string, RecordCounts>> {
	if (monitorIds.length === 0) return new Map();

	let result = await db.exec(
		`SELECT dns_monitor_id, COUNT(*) AS total, SUM(is_enabled) AS watched
		   FROM ${getTableName(dnsMonitorRecords)}
		  WHERE dns_monitor_id IN (${monitorIds.map(() => "?").join(", ")})
		  GROUP BY dns_monitor_id`,
		monitorIds,
	);

	let rows = (result.rows ?? []) as unknown as {
		dns_monitor_id: string;
		total: number;
		watched: number;
	}[];

	return new Map(
		rows.map((row) => [row.dns_monitor_id, { total: row.total, watched: row.watched }]),
	);
}

/**
 * GET /app/:team/dns — the team's DNS monitors list.
 *
 * A monitor with no records shows "None yet": discovery might still be pending, and a
 * settled "0 of 0" would misreport it as already checked and empty. Filtering reads the rows
 * already loaded, so the facet counts always describe the whole team.
 */
export default createAction(routes.app.team.dnsMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await ctx.models.dnsMonitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();
		let counts = await countRecords(
			ctx.db,
			monitors.map((monitor) => monitor.id),
		);

		let query = ctx.url.searchParams.get("q") ?? "";
		let statuses = paramValues(ctx.url, "status");
		let visible = filterMonitors(monitors, query, statuses);
		let now = Date.now();
		let newHref = routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug });
		let statusLabel = (status: DnsListStatus) =>
			status === "pending"
				? ctx.intl.t("page.dnsMonitors.table.notChecked")
				: ctx.intl.t(`page.dnsMonitorDetail.records.state.${status}`);

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · DNS monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.dnsMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					primaryAction={
						<LinkButton href={newHref} size="sm">
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.dnsMonitors.header.action.create")}
						</LinkButton>
					}
				>
					{monitors.length === 0 ? (
						<Empty kind="first-run">
							<Empty.Icon>
								<GlobeIcon size={24} strokeWidth={1.5} />
							</Empty.Icon>
							<Empty.Title>{ctx.intl.t("page.dnsMonitors.empty.title")}</Empty.Title>
							<Empty.Description>
								{ctx.intl.t("page.dnsMonitors.empty.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={20} strokeWidth={1.5} />
									{ctx.intl.t("page.dnsMonitors.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<>
							<FilterBar
								id="dns-monitors-filters"
								url={ctx.url}
								locale={ctx.locale}
								search={{
									label: ctx.intl.t("page.dnsMonitors.filters.search"),
									placeholder: ctx.intl.t("page.dnsMonitors.filters.searchPlaceholder"),
								}}
								facets={[
									{
										name: "status",
										label: ctx.intl.t("page.dnsMonitors.filters.status"),
										options: STATUS_ORDER.map((status) => ({
											value: status,
											label: statusLabel(status),
											count: monitors.filter((monitor) => listStatus(monitor) === status).length,
											icon: <StatusDot color={STATUS_COLOR[status]} />,
										})),
									},
								]}
								labels={{
									toolbar: ctx.intl.t("page.dnsMonitors.filters.toolbar"),
									tabs: ctx.intl.t("page.dnsMonitors.filters.toolbar"),
									filters: ctx.intl.t("page.dnsMonitors.filters.filters"),
									apply: ctx.intl.t("page.dnsMonitors.filters.apply"),
									is: ctx.intl.t("page.dnsMonitors.filters.is"),
									isAnyOf: ctx.intl.t("page.dnsMonitors.filters.isAnyOf"),
									clear: ctx.intl.t("page.dnsMonitors.filters.clear"),
									remove: (field, values) =>
										ctx.intl.t("page.dnsMonitors.filters.remove", { field, values }),
								}}
							/>

							{visible.length === 0 ? (
								<Empty kind="no-results">
									<Empty.Title>{ctx.intl.t("page.dnsMonitors.noResults.title")}</Empty.Title>
									<Empty.Description>
										{ctx.intl.t("page.dnsMonitors.noResults.description")}
									</Empty.Description>
									<Empty.Action>
										<LinkButton variant="outline" href={clearFiltersHref(ctx.url, FILTER_PARAMS)}>
											{ctx.intl.t("page.dnsMonitors.filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="dns-monitors-filters" />
									<Table aria-label={ctx.intl.t("page.dnsMonitors.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.name")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.domain")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.status")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.records")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.registration")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.dnsMonitors.table.columns.lastChecked")}
												</Table.Column>
												<Table.ActionsColumn
													label={ctx.intl.t("page.dnsMonitors.table.columns.actions")}
												/>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{visible.map((monitor) => {
												let count = counts.get(monitor.id);

												return (
													<Table.Row key={monitor.id}>
														<Table.Cell>
															<Table.RowLink
																href={routes.app.team.dnsMonitors.show.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																{monitor.name}
															</Table.RowLink>{" "}
															{!monitor.is_enabled && (
																<Badge {...badgeVariant("neutral")}>
																	{ctx.intl.t("page.dnsMonitors.table.disabled")}
																</Badge>
															)}
														</Table.Cell>
														<Table.Cell>
															<code mix={[fontSize("sm"), fg("neutral.muted")]}>
																{monitor.domain}
															</code>
														</Table.Cell>
														<Table.StatusCell color={STATUS_COLOR[listStatus(monitor)]}>
															{statusLabel(listStatus(monitor))}
														</Table.StatusCell>
														<Table.Cell>
															{count === undefined
																? ctx.intl.t("page.dnsMonitors.table.noRecords")
																: ctx.intl.t("page.dnsMonitors.table.records", {
																		enabled: count.watched,
																		total: count.total,
																	})}
														</Table.Cell>
														<Table.Cell>
															<div mix={[flex(), flexWrap(), items("center"), gap("8px")]}>
																<RegistrationBadge
																	status={monitor.registration_status}
																	intl={ctx.intl}
																/>
																{monitor.registration_expires_at !== null && (
																	<RelativeTime
																		date={monitor.registration_expires_at}
																		now={now}
																		locale={ctx.locale}
																		local
																		mix={[fontSize("sm"), fg("neutral.muted")]}
																	/>
																)}
															</div>
														</Table.Cell>
														<Table.DateCell
															date={monitor.last_checked_at}
															now={now}
															locale={ctx.locale}
															local
														/>
														<Table.Actions>
															<LinkButton
																variant="ghost"
																size="sm"
																href={routes.app.team.dnsMonitors.edit.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																{ctx.intl.t("page.dnsMonitors.table.actions.edit")}
															</LinkButton>
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
