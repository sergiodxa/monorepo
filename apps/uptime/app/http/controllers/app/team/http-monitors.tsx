/**
 * HTTP monitors list controller. Each row's status and check time come from
 * columns cached on the monitor row instead of a live query per monitor, so a
 * monitor with no cached status has never been checked and renders as `unknown`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MonitorIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { font, fontSize, truncate } from "@sdxc/u/typography";
import { AlertDialog, Badge, Button, LinkButton } from "@sdxc/ui";
import { clearFiltersHref, Empty, FilterBar, paramValues, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import type { SelectMonitor } from "~/database/schema";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { sharedFilterLabels } from "~/resources/views/shared/filter-labels";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

/** The states a row can show, in the order the status facet lists them. */
const MONITOR_STATUSES = ["down", "degraded", "up", "unknown"] as const;

/** A row's state: the cached last check outcome, or `unknown` for a monitor never checked. */
type MonitorStatus = (typeof MONITOR_STATUSES)[number];

/** The dot each state draws in the status column; a never-checked monitor stays neutral. */
const STATUS_COLOR: Record<MonitorStatus, NonNullable<Table.StatusCellProps["color"]>> = {
	up: "success",
	degraded: "warning",
	down: "danger",
	unknown: "neutral",
};

/** The query parameter the search field writes. */
const SEARCH_PARAM = "q";

/** The query parameter the status facet writes, once per selected state. */
const STATUS_PARAM = "status";

/** Narrows the cached `last_status` column to a state the list draws. */
function monitorStatus(monitor: SelectMonitor): MonitorStatus {
	let status = monitor.last_status;
	return status === "up" || status === "degraded" || status === "down" ? status : "unknown";
}

/**
 * Keeps the monitors whose name or URL contains `query` (case-insensitively) and whose state
 * is one of `statuses`; an empty query or status list keeps everything, so the unfiltered URL
 * shows the whole team.
 */
function filterMonitors(
	monitors: SelectMonitor[],
	query: string,
	statuses: string[],
): SelectMonitor[] {
	let needle = query.trim().toLowerCase();
	return monitors.filter((monitor) => {
		if (statuses.length > 0 && !statuses.includes(monitorStatus(monitor))) return false;
		if (needle === "") return true;
		return (
			monitor.name.toLowerCase().includes(needle) || monitor.url.toLowerCase().includes(needle)
		);
	});
}

/**
 * GET /app/:team/http — the team's HTTP monitors list. Search (`?q=`) and the status facet
 * (`?status=`) narrow the rows already loaded, so a filtered list is a URL to share and the
 * facet counts always describe the whole team. Import sits beside "Create Monitor" since that
 * is when someone with a list of URLs decides how to enter them.
 */
export default createAction(routes.app.team.monitors.index, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		await ctx.access.load(abilities.monitors.delete);
		let canDelete = ctx.access.can(abilities.monitors.delete);

		let monitors = await ctx.models.monitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();

		let t = ctx.intl.t;
		let query = ctx.url.searchParams.get(SEARCH_PARAM) ?? "";
		let statuses = paramValues(ctx.url, STATUS_PARAM);
		let rows = filterMonitors(monitors, query, statuses);
		let newHref = routes.app.team.monitors.new.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("page.httpMonitors.header.title")}
					breadcrumbs={[
						{
							label: t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton
							href={routes.app.team.monitorsImport.href({ team: ctx.team.slug })}
							variant="outline"
							color="neutral"
						>
							<UploadIcon size={16} strokeWidth={1.5} />
							{t("page.httpMonitors.header.action.import")}
						</LinkButton>
					}
					primaryAction={
						<LinkButton href={newHref}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{t("page.httpMonitors.header.action.create")}
						</LinkButton>
					}
				>
					{monitors.length === 0 ? (
						<Empty kind="first-run" icon={<MonitorIcon size={20} strokeWidth={1.5} />}>
							<Empty.Title>{t("page.httpMonitors.empty.title")}</Empty.Title>
							<Empty.Description>{t("page.httpMonitors.empty.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={16} strokeWidth={1.5} />
									{t("page.httpMonitors.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<div mix={[vstack({ gap: 4, align: "stretch" })]}>
							<FilterBar
								id="http-monitors"
								url={ctx.url}
								collapse
								locale={ctx.locale}
								search={{
									name: SEARCH_PARAM,
									label: t("page.httpMonitorsList.filters.search.label"),
									placeholder: t("page.httpMonitorsList.filters.search.placeholder"),
								}}
								facets={[
									{
										name: STATUS_PARAM,
										label: t("page.httpMonitorsList.filters.status"),
										options: MONITOR_STATUSES.map((status) => ({
											value: status,
											label: t(`page.httpMonitors.table.status.${status}`),
											count: monitors.filter((monitor) => monitorStatus(monitor) === status).length,
										})),
									},
								]}
								labels={{
									toolbar: t("page.httpMonitorsList.filters.toolbar"),
									tabs: t("page.httpMonitorsList.filters.tabs"),
									...sharedFilterLabels(ctx.intl.t),
								}}
							/>

							{rows.length === 0 ? (
								<Empty kind="no-results">
									<Empty.Title>{t("page.httpMonitorsList.noResults.title")}</Empty.Title>
									<Empty.Description>
										{t("page.httpMonitorsList.noResults.description")}
										{query.trim() === "" ? null : (
											<>
												{" "}
												<Empty.Query>{query.trim()}</Empty.Query>
											</>
										)}
									</Empty.Description>
									<Empty.Action>
										<LinkButton
											href={clearFiltersHref(ctx.url, [SEARCH_PARAM, STATUS_PARAM])}
											variant="outline"
											color="neutral"
										>
											{ctx.intl.t("app.layout.filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="http-monitors" />
									<Table aria-label={t("page.httpMonitors.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("page.httpMonitors.table.columns.name")}</Table.Column>
												<Table.Column>{t("page.httpMonitors.table.columns.url")}</Table.Column>
												<Table.Column>{t("page.httpMonitors.table.columns.status")}</Table.Column>
												<Table.Column numeric>
													{t("page.httpMonitors.table.columns.responseTime")}
												</Table.Column>
												<Table.Column>
													{t("page.httpMonitors.table.columns.lastChecked")}
												</Table.Column>
												<Table.ActionsColumn label={t("page.httpMonitors.table.columns.actions")} />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{rows.map((monitor) => {
												let status = monitorStatus(monitor);
												let deleteDialogId = `delete-monitor-${monitor.id}`;
												let titleId = `${deleteDialogId}-title`;
												let descriptionId = `${deleteDialogId}-description`;

												return (
													<Table.Row key={monitor.id}>
														<Table.Cell>
															<span mix={[hstack({ gap: 2, align: "center" })]}>
																<Table.RowLink
																	href={routes.app.team.monitors.show.href({
																		team: ctx.team.slug,
																		monitorId: monitor.id,
																	})}
																>
																	{monitor.name}
																</Table.RowLink>
																{monitor.enabled_at === null && (
																	<Badge {...badgeVariant("neutral")}>
																		{t("page.httpMonitors.table.disabled")}
																	</Badge>
																)}
															</span>
														</Table.Cell>
														<Table.Cell>
															<code
																title={monitor.url}
																mix={[
																	font("mono"),
																	fontSize("xs"),
																	fg("neutral.muted"),
																	truncate(),
																]}
															>
																{monitor.url}
															</code>
														</Table.Cell>
														<Table.StatusCell color={STATUS_COLOR[status]}>
															{t(`page.httpMonitors.table.status.${status}`)}
														</Table.StatusCell>
														<Table.NumberCell
															value={monitor.last_response_time_ms}
															locale={ctx.locale}
															format={{
																style: "unit",
																unit: "millisecond",
																unitDisplay: "narrow",
															}}
														/>
														{monitor.last_checked_at === null ? (
															<Table.Cell mix={[fg("neutral.muted")]}>
																{t("page.httpMonitors.table.neverChecked")}
															</Table.Cell>
														) : (
															<Table.DateCell
																date={monitor.last_checked_at}
																locale={ctx.locale}
																local
															/>
														)}
														<Table.Actions>
															<LinkButton
																href={routes.app.team.monitors.edit.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
																size="sm"
																variant="ghost"
																color="neutral"
															>
																<PencilIcon size={16} strokeWidth={1.5} />
																{t("page.httpMonitors.table.actions.edit")}
															</LinkButton>
															{canDelete ? (
																<>
																	<Button
																		type="button"
																		size="sm"
																		variant="ghost"
																		color="danger"
																		commandfor={deleteDialogId}
																		command="show-modal"
																	>
																		<TrashIcon size={16} strokeWidth={1.5} />
																		{t("page.httpMonitors.table.actions.delete")}
																	</Button>
																	<AlertDialog
																		id={deleteDialogId}
																		aria-labelledby={titleId}
																		aria-describedby={descriptionId}
																	>
																		<AlertDialog.Header>
																			<AlertDialog.Title id={titleId}>
																				{t("page.httpMonitors.table.confirmation.delete", {
																					name: monitor.name,
																				})}
																			</AlertDialog.Title>
																			<AlertDialog.Description id={descriptionId}>
																				{t(
																					"page.httpMonitors.table.confirmation.deleteDescription",
																				)}
																			</AlertDialog.Description>
																		</AlertDialog.Header>
																		<form
																			method="post"
																			action={routes.actions.monitor.http.delete.href({
																				team: ctx.team.slug,
																			})}
																		>
																			<input type="hidden" name="_method" value="DELETE" />
																			<input type="hidden" name="monitor_id" value={monitor.id} />
																			<AlertDialog.Footer>
																				<AlertDialog.Cancel
																					type="button"
																					commandfor={deleteDialogId}
																				>
																					{t("page.editMonitor.form.cancel")}
																				</AlertDialog.Cancel>
																				<Button type="submit" color="danger">
																					{t("page.httpMonitors.table.actions.delete")}
																				</Button>
																			</AlertDialog.Footer>
																		</form>
																	</AlertDialog>
																</>
															) : null}
														</Table.Actions>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</div>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
