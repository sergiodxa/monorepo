/**
 * Maintenance windows list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon, WrenchIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
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
			{ title: ctx.i18next.t("page.maintenance.tabs.active"), windows: active },
			{ title: ctx.i18next.t("page.maintenance.tabs.upcoming"), windows: upcoming },
			{ title: ctx.i18next.t("page.maintenance.tabs.past"), windows: past },
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
								{sections.map(
									(section) =>
										section.windows.length > 0 && (
											<div key={section.title}>
												<h2>{section.title}</h2>
												<div mix={[css({ overflowX: "auto" })]}>
													<table
														mix={[
															css({
																width: "100%",
																borderCollapse: "collapse",
																fontSize: "0.875rem",
																"& th, & td": {
																	textAlign: "left",
																	padding: "12px 16px",
																	borderBottom: `1px solid ${neutral[200]}`,
																},
																"@media (prefers-color-scheme: dark)": {
																	"& th, & td": { borderColor: neutral[800] },
																},
															}),
														]}
													>
														<thead>
															<tr>
																<th>{ctx.i18next.t("page.maintenance.table.columns.name")}</th>
																<th>Scope</th>
																<th>Starts</th>
																<th>Ends</th>
																<th></th>
															</tr>
														</thead>
														<tbody>
															{section.windows.map((window) => (
																<tr key={window.id}>
																	<td>
																		{window.name}
																		{window.is_recurring && (
																			<Badge tone="neutral">
																				{ctx.i18next.t("page.maintenance.table.recurring")}
																			</Badge>
																		)}
																		{window.ended_early_at !== null && (
																			<Badge tone="neutral">Ended early</Badge>
																		)}
																	</td>
																	<td>
																		{window.monitor_id
																			? (monitorsById.get(window.monitor_id)?.name ??
																				"Unknown monitor")
																			: ctx.i18next.t("page.maintenance.table.allMonitors")}
																	</td>
																	<td>{new Date(window.starts_at).toLocaleString()}</td>
																	<td>{new Date(window.ends_at).toLocaleString()}</td>
																	<td>
																		<a
																			href={routes.app.team.maintenanceWindows.edit.href({
																				team: ctx.team.slug,
																				windowId: window.id,
																			})}
																			mix={[
																				css({
																					color: primary[600],
																					textDecoration: "none",
																					"&:hover": { textDecoration: "underline" },
																					"@media (prefers-color-scheme: dark)": {
																						color: primary[400],
																					},
																				}),
																			]}
																		>
																			Edit
																		</a>
																	</td>
																</tr>
															))}
														</tbody>
													</table>
												</div>
											</div>
										),
								)}
							</>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
