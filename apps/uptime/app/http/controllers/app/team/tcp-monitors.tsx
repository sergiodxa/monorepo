/**
 * TCP monitors list controller. Renders every TCP monitor for the team with its last-known
 * status, narrowed by the search and status filters the URL carries, or an empty state when
 * there are none yet. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import { NetworkIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { fontSize } from "@sdxc/u/typography";
import { Badge, LinkButton, StatusDot } from "@sdxc/ui";
import { clearFiltersHref, Empty, FilterBar, paramValues, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import type { SelectTcpMonitor } from "~/database/schema";

import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { sharedFilterLabels } from "~/resources/views/shared/filter-labels";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

/** A monitor's status as the list filters it: its last outcome, or `pending` before any check. */
type TcpListStatus = "up" | "timeout" | "down" | "pending";

/** The status facet's values, worst outcome last so the facet reads as an escalation. */
const STATUS_ORDER: readonly TcpListStatus[] = ["up", "timeout", "down", "pending"];

/** The dot color each status is drawn in, shared by the facet and the status column. */
const STATUS_COLOR: Record<TcpListStatus, SemanticColor> = {
	up: "success",
	timeout: "warning",
	down: "danger",
	pending: "neutral",
};

/** Every query parameter this list filters by, which "Clear filters" removes together. */
const FILTER_PARAMS = ["q", "status"];

/** Reads a monitor's filterable status, folding a never-checked monitor into `pending`. */
function listStatus(monitor: SelectTcpMonitor): TcpListStatus {
	return STATUS_ORDER.find((status) => status === monitor.last_status) ?? "pending";
}

/**
 * Keeps the monitors matching the URL's filters: `q` matches the name or host without regard
 * to case, and each `status` value widens the set, so an empty filter keeps every monitor.
 */
function filterMonitors(
	monitors: SelectTcpMonitor[],
	query: string,
	statuses: string[],
): SelectTcpMonitor[] {
	let needle = query.trim().toLowerCase();

	return monitors.filter((monitor) => {
		if (statuses.length > 0 && !statuses.includes(listStatus(monitor))) return false;
		if (needle === "") return true;
		return (
			monitor.name.toLowerCase().includes(needle) || monitor.host.toLowerCase().includes(needle)
		);
	});
}

/**
 * GET /app/:team/tcp — the team's TCP monitors list. Filtering reads the rows already
 * loaded for the team, so the facet counts always describe the whole team rather than the
 * filtered page.
 */
export default createAction(routes.app.team.tcpMonitors.index, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await ctx.models.tcpMonitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();

		let query = ctx.url.searchParams.get("q") ?? "";
		let statuses = paramValues(ctx.url, "status");
		let visible = filterMonitors(monitors, query, statuses);
		let now = Date.now();
		let newHref = routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug });
		let statusLabel = (status: TcpListStatus) =>
			ctx.intl.t(`page.tcpMonitors.table.status.${status}`);

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · TCP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.tcpMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					primaryAction={
						<LinkButton href={newHref} size="sm">
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.tcpMonitors.header.action.create")}
						</LinkButton>
					}
				>
					{monitors.length === 0 ? (
						<Empty kind="first-run">
							<Empty.Icon>
								<NetworkIcon size={24} strokeWidth={1.5} />
							</Empty.Icon>
							<Empty.Title>{ctx.intl.t("page.tcpMonitors.empty.title")}</Empty.Title>
							<Empty.Description>
								{ctx.intl.t("page.tcpMonitors.empty.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={20} strokeWidth={1.5} />
									{ctx.intl.t("page.tcpMonitors.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<>
							<FilterBar
								id="tcp-monitors-filters"
								url={ctx.url}
								locale={ctx.locale}
								search={{
									label: ctx.intl.t("page.tcpMonitors.filters.search"),
									placeholder: ctx.intl.t("page.tcpMonitors.filters.searchPlaceholder"),
								}}
								facets={[
									{
										name: "status",
										label: ctx.intl.t("page.tcpMonitors.filters.status"),
										options: STATUS_ORDER.map((status) => ({
											value: status,
											label: statusLabel(status),
											count: monitors.filter((monitor) => listStatus(monitor) === status).length,
											icon: <StatusDot color={STATUS_COLOR[status]} />,
										})),
									},
								]}
								labels={{
									toolbar: ctx.intl.t("page.tcpMonitors.filters.toolbar"),
									tabs: ctx.intl.t("page.tcpMonitors.filters.toolbar"),
									...sharedFilterLabels(ctx.intl.t),
								}}
							/>

							{visible.length === 0 ? (
								<Empty kind="no-results">
									<Empty.Title>{ctx.intl.t("page.tcpMonitors.noResults.title")}</Empty.Title>
									<Empty.Description>
										{ctx.intl.t("page.tcpMonitors.noResults.description")}
									</Empty.Description>
									<Empty.Action>
										<LinkButton variant="outline" href={clearFiltersHref(ctx.url, FILTER_PARAMS)}>
											{ctx.intl.t("app.layout.filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="tcp-monitors-filters" />
									<Table aria-label={ctx.intl.t("page.tcpMonitors.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.intl.t("page.tcpMonitors.table.columns.name")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.tcpMonitors.table.columns.endpoint")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.tcpMonitors.table.columns.status")}
												</Table.Column>
												<Table.Column numeric>
													{ctx.intl.t("page.tcpMonitors.table.columns.responseTime")}
												</Table.Column>
												<Table.Column>
													{ctx.intl.t("page.tcpMonitors.table.columns.lastChecked")}
												</Table.Column>
												<Table.ActionsColumn
													label={ctx.intl.t("page.tcpMonitors.table.columns.actions")}
												/>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{visible.map((monitor) => (
												<Table.Row key={monitor.id}>
													<Table.Cell>
														<Table.RowLink
															href={routes.app.team.tcpMonitors.show.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
														>
															{monitor.name}
														</Table.RowLink>{" "}
														{!monitor.is_enabled && (
															<Badge {...badgeVariant("neutral")}>
																{ctx.intl.t("page.tcpMonitors.table.status.disabled")}
															</Badge>
														)}
													</Table.Cell>
													<Table.Cell>
														<code mix={[fontSize("sm"), fg("neutral.muted")]}>
															{monitor.host}:{monitor.port}
														</code>
													</Table.Cell>
													<Table.StatusCell color={STATUS_COLOR[listStatus(monitor)]}>
														{statusLabel(listStatus(monitor))}
													</Table.StatusCell>
													<Table.NumberCell
														value={monitor.last_response_time_ms}
														locale={ctx.locale}
														format={{ style: "unit", unit: "millisecond", unitDisplay: "short" }}
													/>
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
															href={routes.app.team.tcpMonitors.edit.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
														>
															{ctx.intl.t("page.tcpMonitors.table.actions.edit")}
														</LinkButton>
													</Table.Actions>
												</Table.Row>
											))}
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
