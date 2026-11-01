/**
 * Cron-job monitors list controller. Requires `requireUser` + `requireTeam`. The search and
 * status filters are URL parameters read over the rows the page already loads, so a filtered
 * list is a link someone can send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PencilIcon, PlusIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { Badge, LinkButton } from "@sdxc/ui";
import { Empty, FilterBar, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { describeSchedule } from "~/app/services/cron-text";
import { withPrefix } from "~/app/services/prefixed-translate";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

/** Every status a cron job reports, in the order the status facet offers them. */
const CRON_JOB_STATUSES = ["missed", "late", "healthy", "new"] as const;

/** The dot colour of each status: a missed run is the outage, a late one the warning. */
const STATUS_COLOR: Record<string, NonNullable<Table.StatusCellProps["color"]>> = {
	healthy: "success",
	late: "warning",
	missed: "danger",
	new: "neutral",
};

/**
 * GET /app/:team/cron-jobs — the team's cron-job monitors list. `q` matches the name and
 * `status` (repeatable) keeps the named statuses; facet counts follow the search, so each
 * count says how many rows that status would add.
 */
export default createAction(routes.app.team.cronJobs.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let t = withPrefix(ctx.intl.t, "page.cronJobs");
		let monitors = await ctx.models.cronJobMonitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();

		let query = (ctx.url.searchParams.get("q") ?? "").trim();
		let statuses = ctx.url.searchParams.getAll("status");
		let searched = monitors.filter((monitor) =>
			monitor.name.toLowerCase().includes(query.toLowerCase()),
		);
		let rows = searched.filter(
			(monitor) => statuses.length === 0 || statuses.includes(monitor.status),
		);

		let listHref = routes.app.team.cronJobs.index.href({ team: ctx.team.slug });
		let newHref = routes.app.team.cronJobs.new.href({ team: ctx.team.slug });

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
								id="cron-jobs"
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
										options: CRON_JOB_STATUSES.map((status) => ({
											value: status,
											label: t(`table.status.${status}`),
											count: searched.filter((monitor) => monitor.status === status).length,
										})),
									},
								]}
								labels={{
									toolbar: t("filters.toolbar"),
									tabs: t("filters.tabs"),
									filters: t("filters.filters"),
									apply: t("filters.apply"),
									is: t("filters.is"),
									isAnyOf: t("filters.isAnyOf"),
									clear: t("filters.clear"),
									remove: (field, values) => t("filters.remove", { field, values }),
								}}
							/>

							{rows.length === 0 ? (
								<Empty kind="no-results">
									<Empty.Title>{t("noResults.title")}</Empty.Title>
									<Empty.Description>{t("noResults.description")}</Empty.Description>
									<Empty.Action>
										<LinkButton href={listHref} variant="outline">
											{t("filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="cron-jobs" />
									<Table aria-label={t("table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("table.columns.name")}</Table.Column>
												<Table.Column>{t("table.columns.status")}</Table.Column>
												<Table.Column>{t("table.columns.schedule")}</Table.Column>
												<Table.Column>{t("table.columns.lastPing")}</Table.Column>
												<Table.Column>{t("table.columns.nextExpected")}</Table.Column>
												<Table.ActionsColumn label={t("table.columns.actions")} />
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{rows.map((monitor) => (
												<Table.Row key={monitor.id}>
													<Table.Cell>
														<Table.RowLink
															href={routes.app.team.cronJobs.show.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
														>
															{monitor.name}
														</Table.RowLink>{" "}
														{monitor.enabled_at === null && (
															<Badge {...badgeVariant("neutral")}>{t("table.disabled")}</Badge>
														)}
													</Table.Cell>
													<Table.StatusCell color={STATUS_COLOR[monitor.status] ?? "neutral"}>
														{t(`table.status.${monitor.status}`)}
													</Table.StatusCell>
													<Table.Cell>
														{describeSchedule(monitor.cron_expression, {
															locale: ctx.locale,
															t: ctx.intl.t,
														})}
													</Table.Cell>
													<Table.DateCell
														date={monitor.last_ping_at}
														locale={ctx.locale}
														timeZone={monitor.timezone}
														local
													/>
													<Table.DateCell
														date={monitor.enabled_at === null ? null : monitor.next_expected_at}
														locale={ctx.locale}
														timeZone={monitor.timezone}
														local
													/>
													<Table.Actions>
														<LinkButton
															href={routes.app.team.cronJobs.edit.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
															variant="ghost"
															color="neutral"
															size="sm"
															aria-label={t("table.actions.editNamed", { name: monitor.name })}
														>
															<PencilIcon size={16} strokeWidth={1.5} aria-hidden="true" />
															{t("table.actions.edit")}
														</LinkButton>
													</Table.Actions>
												</Table.Row>
											))}
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
