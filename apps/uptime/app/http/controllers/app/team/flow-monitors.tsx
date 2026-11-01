/**
 * Flow monitors list controller. Renders every flow monitor for the team with its last-known
 * status and what its last run concluded, or an empty state when there are none yet. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { EyeIcon, PencilIcon, PlusIcon, TrashIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { AlertDialog, Badge, Button, LinkButton, Menu } from "@sdxc/ui";
import { Empty, FilterBar, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { withPrefix } from "~/app/services/prefixed-translate";
import { badgeVariant } from "~/resources/components/badge";
import RowMenu from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { sharedFilterLabels } from "~/resources/views/shared/filter-labels";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

/** A last run's status, `pending` standing for a monitor that has not run yet. */
type RunStatus = "up" | "down" | "error" | "pending";

/** Every status the facet offers, failures first since those are what someone filters for. */
const RUN_STATUSES: readonly RunStatus[] = ["down", "error", "up", "pending"];

/**
 * `error` is neutral and not `danger`: it means this app could not find out — an unparseable
 * spec, a host no verified domain covers — and colouring it as an outage would put our own
 * misconfiguration in a customer's incident history.
 */
const STATUS_COLOR: Record<RunStatus, NonNullable<Table.StatusCellProps["color"]>> = {
	up: "success",
	down: "danger",
	error: "neutral",
	pending: "neutral",
};

/**
 * GET /app/:team/flows — the team's flow monitors list. `q` matches the name and `status`
 * (repeatable) keeps the named last-run statuses, both read over the rows already loaded, so
 * a filtered list is a link someone can send.
 */
export default createAction(routes.app.team.flowMonitors.index, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		await ctx.access.load(abilities.flowMonitors.delete);
		let canDelete = ctx.access.can(abilities.flowMonitors.delete);

		let monitors = await ctx.models.flowMonitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();
		let t = withPrefix(ctx.intl.t, "page.flowMonitors");
		let query = (ctx.url.searchParams.get("q") ?? "").trim();
		let statuses = ctx.url.searchParams.getAll("status");
		let searched = monitors.filter((monitor) =>
			monitor.name.toLowerCase().includes(query.toLowerCase()),
		);
		let rows = searched.filter(
			(monitor) => statuses.length === 0 || statuses.includes(monitor.last_status ?? "pending"),
		);

		let listHref = routes.app.team.flowMonitors.index.href({ team: ctx.team.slug });
		let newHref = routes.app.team.flowMonitors.new.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${t("header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					primaryAction={
						<LinkButton href={newHref}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{t("header.action.create")}
						</LinkButton>
					}
				>
					{monitors.length === 0 ? (
						<Empty kind="first-run">
							<Empty.Title>{t("empty.title")}</Empty.Title>
							<Empty.Description>{t("empty.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={16} strokeWidth={1.5} />
									{t("empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<div mix={[vstack({ gap: 4, align: "stretch" })]}>
							<FilterBar
								id="flow-monitors"
								url={ctx.url}
								locale={ctx.locale}
								collapse
								search={{
									label: t("filters.search.label"),
									placeholder: t("filters.search.placeholder"),
								}}
								facets={[
									{
										name: "status",
										label: t("filters.status"),
										options: RUN_STATUSES.map((status) => ({
											value: status,
											label: t(`table.status.${status}`),
											count: searched.filter(
												(monitor) => (monitor.last_status ?? "pending") === status,
											).length,
										})),
									},
								]}
								labels={{
									toolbar: t("filters.toolbar"),
									tabs: t("filters.tabs"),
									...sharedFilterLabels(ctx.intl.t),
								}}
							/>

							{rows.length === 0 ? (
								<Empty kind="no-results">
									<Empty.Title>{t("noResults.title")}</Empty.Title>
									<Empty.Description>{t("noResults.description")}</Empty.Description>
									<Empty.Action>
										<LinkButton href={listHref} variant="outline">
											{ctx.intl.t("app.layout.filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="flow-monitors" />
									<Table aria-label={t("table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("table.columns.name")}</Table.Column>
												<Table.Column>{t("table.columns.status")}</Table.Column>
												<Table.Column>{t("table.columns.interval")}</Table.Column>
												<Table.Column>{t("table.columns.lastChecked")}</Table.Column>
												<Table.ActionsColumn label={t("table.columns.actions")} />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{rows.map((monitor) => {
												let status: RunStatus = monitor.last_status ?? "pending";
												let showHref = routes.app.team.flowMonitors.show.href({
													team: ctx.team.slug,
													monitorId: monitor.id,
												});
												let deleteDialogId = `delete-flow-monitor-${monitor.id}`;
												let titleId = `${deleteDialogId}-title`;
												let descriptionId = `${deleteDialogId}-description`;
												let menuId = `row-menu-${deleteDialogId}`;

												return (
													<Table.Row key={monitor.id}>
														<Table.Cell>
															<Table.RowLink href={showHref}>{monitor.name}</Table.RowLink>{" "}
															{!monitor.is_enabled && (
																<Badge {...badgeVariant("neutral")}>
																	{t("table.status.disabled")}
																</Badge>
															)}
														</Table.Cell>
														<Table.StatusCell color={STATUS_COLOR[status]}>
															{t(`table.status.${status}`)}
														</Table.StatusCell>
														<Table.Cell>
															{ctx.intl.t(
																`page.createFlowMonitor.form.fields.interval.options.${monitor.interval_seconds}`,
															)}
														</Table.Cell>
														<Table.DateCell
															date={monitor.last_checked_at}
															locale={ctx.locale}
															local
														/>
														<Table.Actions>
															<RowMenu id={menuId} label={t("table.actions.menu")}>
																<Menu.Item href={showHref}>
																	<EyeIcon size={16} strokeWidth={1.5} />
																	{t("table.actions.view")}
																</Menu.Item>
																<Menu.Item
																	href={routes.app.team.flowMonitors.edit.href({
																		team: ctx.team.slug,
																		monitorId: monitor.id,
																	})}
																>
																	<PencilIcon size={16} strokeWidth={1.5} />
																	{t("table.actions.edit")}
																</Menu.Item>
																{canDelete ? (
																	<>
																		<Menu.Separator />
																		<Menu.Item
																			danger
																			commandfor={deleteDialogId}
																			command="show-modal"
																		>
																			<TrashIcon size={16} strokeWidth={1.5} />
																			{t("table.actions.delete")}
																		</Menu.Item>
																	</>
																) : null}
															</RowMenu>

															{canDelete ? (
																<AlertDialog
																	id={deleteDialogId}
																	aria-labelledby={titleId}
																	aria-describedby={descriptionId}
																>
																	<AlertDialog.Header>
																		<AlertDialog.Title id={titleId}>
																			{t("table.actions.confirmation.delete", {
																				name: monitor.name,
																			})}
																		</AlertDialog.Title>
																		<AlertDialog.Description id={descriptionId}>
																			{ctx.intl.t("page.editFlowMonitor.danger.description")}
																		</AlertDialog.Description>
																	</AlertDialog.Header>
																	<form
																		method="post"
																		action={routes.actions.monitor.flow.delete.href({
																			team: ctx.team.slug,
																		})}
																	>
																		<input type="hidden" name="_method" value="DELETE" />
																		<input type="hidden" name="monitor_id" value={monitor.id} />
																		<AlertDialog.Footer>
																			<AlertDialog.Cancel type="button" commandfor={deleteDialogId}>
																				{ctx.intl.t("page.editFlowMonitor.form.cancel")}
																			</AlertDialog.Cancel>
																			<Button type="submit" color="danger">
																				{t("table.actions.delete")}
																			</Button>
																		</AlertDialog.Footer>
																	</form>
																</AlertDialog>
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
