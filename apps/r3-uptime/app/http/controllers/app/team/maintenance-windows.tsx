/**
 * Maintenance windows list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon, WrenchIcon } from "@pkg/lucide-remix";
import { Empty, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/maintenance — the team's maintenance windows list. */
export default createAction(routes.app.team.maintenanceWindows.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let windows = await MaintenanceWindow.listByTeam(db, ctx.team.id);
		let monitors = await Monitor.listByTeam(db, ctx.team.id);
		let monitorsById = new Map(monitors.map((monitor) => [monitor.id, monitor]));
		let now = Date.now();

		let active = windows.filter((window) => MaintenanceWindow.isActiveAt(window, now));
		let upcoming = windows.filter((window) => !active.includes(window) && window.starts_at > now);
		let past = windows.filter((window) => !active.includes(window) && !upcoming.includes(window));

		let sections = [
			{ key: "active", title: ctx.i18next.t("page.maintenance.tabs.active"), windows: active },
			{
				key: "upcoming",
				title: ctx.i18next.t("page.maintenance.tabs.upcoming"),
				windows: upcoming,
			},
			{ key: "past", title: ctx.i18next.t("page.maintenance.tabs.past"), windows: past },
		];

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.maintenance.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.maintenance.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.maintenance.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{windows.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<WrenchIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.maintenance.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.maintenance.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton
										href={routes.app.team.maintenanceWindows.new.href({ team: ctx.team.slug })}
									>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.maintenance.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<>
								{sections.map((section) => {
									if (section.windows.length === 0) return null;

									let headingId = `maintenance-${section.key}-heading`;

									return (
										<div key={section.key}>
											<h2 id={headingId}>{section.title}</h2>
											<Table.Container>
												<Table aria-labelledby={headingId}>
													<Table.Header>
														<Table.Row>
															<Table.Column>
																{ctx.i18next.t("page.maintenance.table.columns.name")}
															</Table.Column>
															<Table.Column>
																{ctx.i18next.t("page.maintenance.table.columns.scope")}
															</Table.Column>
															<Table.Column>
																{ctx.i18next.t("page.maintenance.table.columns.starts")}
															</Table.Column>
															<Table.Column>
																{ctx.i18next.t("page.maintenance.table.columns.ends")}
															</Table.Column>
															<Table.Column />
														</Table.Row>
													</Table.Header>
													<Table.Body>
														{section.windows.map((window) => (
															<Table.Row key={window.id}>
																<Table.Cell>
																	{window.name}
																	{window.is_recurring && (
																		<Badge tone="neutral">
																			{ctx.i18next.t("page.maintenance.table.recurring")}
																		</Badge>
																	)}
																	{window.ended_early_at !== null && (
																		<Badge tone="neutral">
																			{ctx.i18next.t("page.maintenance.table.endedEarly")}
																		</Badge>
																	)}
																</Table.Cell>
																<Table.Cell>
																	{window.monitor_id
																		? (monitorsById.get(window.monitor_id)?.name ??
																			ctx.i18next.t("page.maintenance.table.unknownMonitor"))
																		: ctx.i18next.t("page.maintenance.table.allMonitors")}
																</Table.Cell>
																<Table.Cell>
																	{new Date(window.starts_at).toLocaleString()}
																</Table.Cell>
																<Table.Cell>{new Date(window.ends_at).toLocaleString()}</Table.Cell>
																<Table.Cell>
																	<a
																		href={routes.app.team.maintenanceWindows.edit.href({
																			team: ctx.team.slug,
																			windowId: window.id,
																		})}
																		mix={[
																			fg("primary"),
																			textDecoration("none"),
																			hover(textDecoration("underline")),
																		]}
																	>
																		{ctx.i18next.t("page.maintenance.table.edit")}
																	</a>
																</Table.Cell>
															</Table.Row>
														))}
													</Table.Body>
												</Table>
											</Table.Container>
										</div>
									);
								})}
							</>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
