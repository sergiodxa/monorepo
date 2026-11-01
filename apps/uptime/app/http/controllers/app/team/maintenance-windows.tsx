/**
 * Maintenance windows list controller. Requires `requireUser` + `requireTeam`. Windows group
 * into active, upcoming and past, each a table whose times render in the viewer's own zone,
 * and an active window can be ended from its row without opening it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon, WrenchIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { Badge, Button, LinkButton } from "@sdxc/ui";
import { Empty, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { SelectMaintenanceWindow } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { isActiveAt } from "~/app/models/maintenance-windows";
import { storedMonitorScope } from "~/app/services/monitor-scope";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The flash the create, update, end and delete actions leave for the list they redirect to. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/maintenance — the team's maintenance windows list. */
export default createAction(routes.app.team.maintenanceWindows.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let windows = await ctx.models.maintenanceWindows
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();
		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;
		let team = { team: ctx.team.slug };
		let newHref = routes.app.team.maintenanceWindows.new.href(team);

		/**
		 * A scope's monitor id is unique across every type, so one map keyed by id
		 * resolves every row's name, matching what {@link storedMonitorScope}
		 * already determined for that row.
		 */
		let scopeGroups = await listScopeMonitors(ctx.models, ctx.team.id);
		let monitorNamesById = new Map(
			scopeGroups.flatMap((group) => group.monitors.map((monitor) => [monitor.id, monitor.name])),
		);

		/** How one window's coverage reads in the table: a monitor's name, a type, or everything. */
		function scopeLabel(window: SelectMaintenanceWindow): string {
			let scope = storedMonitorScope(window);
			if (scope.monitorType === null) return ctx.intl.t("page.maintenance.table.allMonitors");
			if (scope.monitorId === null) {
				return ctx.intl.t(`components.monitorScope.allOfType.${scope.monitorType}`);
			}

			return (
				monitorNamesById.get(scope.monitorId) ?? ctx.intl.t("page.maintenance.table.unknownMonitor")
			);
		}

		let now = Date.now();

		let active = windows.filter((window) => isActiveAt(window, now));
		let upcoming = windows.filter((window) => !active.includes(window) && window.starts_at > now);
		let past = windows.filter((window) => !active.includes(window) && !upcoming.includes(window));

		let sections = [
			{ key: "active", title: ctx.intl.t("page.maintenance.tabs.active"), windows: active },
			{
				key: "upcoming",
				title: ctx.intl.t("page.maintenance.tabs.upcoming"),
				windows: upcoming,
			},
			{ key: "past", title: ctx.intl.t("page.maintenance.tabs.past"), windows: past },
		];

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.maintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					toast={toast}
					heading={ctx.intl.t("page.maintenance.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href(team),
						},
					]}
					primaryAction={
						<LinkButton href={newHref}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.maintenance.header.action.create")}
						</LinkButton>
					}
				>
					{windows.length === 0 ? (
						<Empty kind="first-run" icon={<WrenchIcon size={24} strokeWidth={1.5} />}>
							<Empty.Title>{ctx.intl.t("page.maintenance.empty.title")}</Empty.Title>
							<Empty.Description>
								{ctx.intl.t("page.maintenance.empty.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={16} strokeWidth={1.5} />
									{ctx.intl.t("page.maintenance.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<div mix={[vstack({ gap: 8 })]}>
							{sections.map((section) => {
								if (section.windows.length === 0) return null;

								let headingId = `maintenance-${section.key}-heading`;

								return (
									<section key={section.key} mix={[vstack({ gap: 3 })]}>
										<h2 id={headingId} mix={[m(0), fontSize("base"), weight("semibold")]}>
											{section.title}
										</h2>
										<Table.Container>
											<Table aria-labelledby={headingId}>
												<Table.Header>
													<Table.Row>
														<Table.Column>
															{ctx.intl.t("page.maintenance.table.columns.name")}
														</Table.Column>
														<Table.Column>
															{ctx.intl.t("page.maintenance.table.columns.scope")}
														</Table.Column>
														<Table.Column>
															{ctx.intl.t("page.maintenance.table.columns.starts")}
														</Table.Column>
														<Table.Column>
															{ctx.intl.t("page.maintenance.table.columns.ends")}
														</Table.Column>
														<Table.ActionsColumn
															label={ctx.intl.t("page.maintenance.table.columns.actions")}
														/>
													</Table.Row>
												</Table.Header>
												<Table.Body>
													{section.windows.map((window) => {
														let editHref = routes.app.team.maintenanceWindows.edit.href({
															...team,
															windowId: window.id,
														});

														return (
															<Table.Row key={window.id}>
																<Table.Cell>
																	<div mix={[hstack({ gap: 2, align: "center" })]}>
																		<Table.RowLink href={editHref}>{window.name}</Table.RowLink>
																		{window.is_recurring && (
																			<Badge {...badgeVariant("neutral")}>
																				{ctx.intl.t("page.maintenance.table.recurring")}
																			</Badge>
																		)}
																		{window.ended_early_at !== null && (
																			<Badge {...badgeVariant("neutral")}>
																				{ctx.intl.t("page.maintenance.table.endedEarly")}
																			</Badge>
																		)}
																	</div>
																</Table.Cell>
																<Table.Cell>{scopeLabel(window)}</Table.Cell>
																<Table.DateCell
																	date={window.starts_at}
																	now={now}
																	locale={ctx.locale}
																	local
																/>
																<Table.DateCell
																	date={window.ended_early_at ?? window.ends_at}
																	now={now}
																	locale={ctx.locale}
																	local
																/>
																<Table.Actions>
																	<LinkButton
																		href={editHref}
																		size="sm"
																		variant="ghost"
																		color="neutral"
																	>
																		{ctx.intl.t("page.maintenance.table.edit")}
																	</LinkButton>
																	{section.key === "active" && window.ended_early_at === null && (
																		<form
																			method="post"
																			action={routes.actions.maintenanceWindow.end.href(team)}
																		>
																			<input type="hidden" name="window_id" value={window.id} />
																			<Button
																				type="submit"
																				size="sm"
																				variant="ghost"
																				color="neutral"
																			>
																				{ctx.intl.t("page.maintenance.table.actions.end")}
																			</Button>
																		</form>
																	)}
																</Table.Actions>
															</Table.Row>
														);
													})}
												</Table.Body>
											</Table>
										</Table.Container>
									</section>
								);
							})}
						</div>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
