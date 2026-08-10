/**
 * HTTP monitors list controller. Lists the team's monitors, each row's badge and check
 * time coming from the columns the last check cached on the monitor row, so the page is
 * one indexed query. It used to run an uncached Analytics Engine "latest result" query per
 * monitor instead — an N+1 that grew with the team's monitor count. A monitor with no
 * cached status has never been checked and renders as `unknown`.
 * Requires `requireUser` + `requireTeam`.
 *
 * The table is `@pkg/ui`'s `Table` compound, and each row's delete confirmation is
 * `@pkg/ui`'s `AlertDialog` (composed directly rather than through the `Confirm`
 * convenience wrapper, since the confirming control here is a real `<form method="post">`
 * submit button rather than a `command="close"` action — the delete needs to actually
 * post to the delete action, not just dismiss the dialog). Each row's kebab-icon
 * actions menu is `@pkg/ui`'s `Menu`, anchored to its own trigger via the Popover
 * API's implicit-anchor behavior, plus `menuKeys()` for the WAI-ARIA menu keyboard
 * pattern — inlined here rather than a shared component, since this is its only use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	EllipsisVerticalIcon,
	EyeIcon,
	MonitorIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { visuallyHidden } from "@pkg/u/a11y";
import { fg } from "@pkg/u/color";
import { p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { textDecoration, weight } from "@pkg/u/typography";
import { AlertDialog, Badge, Button, Empty, LinkButton, Menu, Table } from "@pkg/ui";
import { menuKeys } from "@pkg/ui/mixins";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Keyed by `monitors.last_status`; anything else (never checked) falls back to neutral. */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/** GET /app/:team/http — the team's HTTP monitors list. */
export default createAction(routes.app.team.monitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.httpMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.httpMonitors.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<MonitorIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.httpMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.httpMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.httpMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.httpMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.httpMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.httpMonitors.table.columns.url")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.httpMonitors.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.httpMonitors.table.columns.responseTime")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.httpMonitors.table.columns.lastChecked")}
											</Table.Column>
											<Table.Column align="end">
												<span mix={[visuallyHidden()]}>
													{ctx.i18next.t("page.httpMonitors.table.columns.actions")}
												</span>
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => {
											let status = monitor.last_status ?? "unknown";
											let deleteDialogId = `delete-monitor-${monitor.id}`;
											let titleId = `${deleteDialogId}-title`;
											let descriptionId = `${deleteDialogId}-description`;
											let menuId = `row-menu-${deleteDialogId}`;

											return (
												<Table.Row key={monitor.id}>
													<Table.Cell>
														<a
															href={routes.app.team.monitors.show.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
															mix={[
																weight(600),
																fg("brand"),
																textDecoration("none"),
																hover(textDecoration("underline")),
															]}
														>
															{monitor.name}
														</a>
														{monitor.enabled_at === null && (
															<Badge {...badgeVariant("neutral")}>
																{ctx.i18next.t("page.httpMonitors.table.disabled")}
															</Badge>
														)}
													</Table.Cell>
													<Table.Cell>
														<code>{monitor.url}</code>
													</Table.Cell>
													<Table.Cell>
														<Badge {...badgeVariant(STATUS_BADGE_TONE[status] ?? "neutral")}>
															{ctx.i18next.t(`page.httpMonitors.table.status.${status}`)}
														</Badge>
													</Table.Cell>
													<Table.Cell>
														{monitor.last_response_time_ms !== null ? (
															`${monitor.last_response_time_ms}ms`
														) : (
															<span mix={[fg("neutral.muted")]}>-</span>
														)}
													</Table.Cell>
													<Table.Cell>
														{monitor.last_checked_at !== null ? (
															new Date(monitor.last_checked_at).toLocaleString()
														) : (
															<span mix={[fg("neutral.muted")]}>
																{ctx.i18next.t("page.httpMonitors.table.neverChecked")}
															</span>
														)}
													</Table.Cell>
													<Table.Cell>
														<Button
															type="button"
															variant="ghost"
															size="sm"
															commandfor={menuId}
															command="toggle-popover"
															aria-label={ctx.i18next.t("page.httpMonitors.table.actions.menu")}
															mix={[p(0)]}
														>
															<EllipsisVerticalIcon size={16} strokeWidth={1.5} />
														</Button>

														<Menu
															id={menuId}
															placement="bottom-end"
															aria-label={ctx.i18next.t("page.httpMonitors.table.actions.menu")}
															mix={[menuKeys()]}
														>
															<Menu.Item
																href={routes.app.team.monitors.show.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																<EyeIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.httpMonitors.table.actions.view")}
															</Menu.Item>
															<Menu.Item
																href={routes.app.team.monitors.edit.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																<PencilIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.httpMonitors.table.actions.edit")}
															</Menu.Item>
															<Menu.Separator />
															<Menu.Item danger commandfor={deleteDialogId} command="show-modal">
																<TrashIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
															</Menu.Item>
														</Menu>

														<AlertDialog
															id={deleteDialogId}
															aria-labelledby={titleId}
															aria-describedby={descriptionId}
														>
															<AlertDialog.Header>
																<AlertDialog.Title id={titleId}>
																	{ctx.i18next.t("page.httpMonitors.table.confirmation.delete", {
																		name: monitor.name,
																	})}
																</AlertDialog.Title>
																<AlertDialog.Description id={descriptionId}>
																	{ctx.i18next.t(
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
																	<AlertDialog.Cancel type="button" commandfor={deleteDialogId}>
																		{ctx.i18next.t("page.editMonitor.form.cancel")}
																	</AlertDialog.Cancel>
																	<Button type="submit" color="danger">
																		{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
																	</Button>
																</AlertDialog.Footer>
															</form>
														</AlertDialog>
													</Table.Cell>
												</Table.Row>
											);
										})}
									</Table.Body>
								</Table>
							</Table.Container>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
