/**
 * HTTP monitors list controller. Each row's status and check time come from
 * columns cached on the monitor row instead of a live query per monitor, so
 * a monitor with no cached status has never been checked and renders as
 * `unknown`. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDateTime } from "@sdxc/dates";
import { EyeIcon, MonitorIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { hover } from "@sdxc/u/state";
import { textDecoration, weight } from "@sdxc/u/typography";
import { AlertDialog, Badge, Button, Empty, LinkButton, Menu, Table } from "@sdxc/ui";
import { Fragment } from "remix/component";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import RowMenu from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** Keyed by `monitors.last_status`; anything else (never checked) falls back to neutral. */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/**
 * GET /app/:team/http — the team's HTTP monitors list. The import link sits
 * beside "Create Monitor" since that is when someone with a list of URLs
 * decides how to enter them.
 */
export default createAction(routes.app.team.monitors.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await ctx.models.monitors
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.httpMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<Fragment>
							<LinkButton
								href={routes.app.team.monitorsImport.href({ team: ctx.team.slug })}
								color="neutral"
							>
								<UploadIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.httpMonitors.header.action.import")}
							</LinkButton>
							<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
								<PlusIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.httpMonitors.header.action.create")}
							</LinkButton>
						</Fragment>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<MonitorIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.intl.t("page.httpMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.intl.t("page.httpMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.intl.t("page.httpMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.intl.t("page.httpMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.intl.t("page.httpMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.httpMonitors.table.columns.url")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.httpMonitors.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.httpMonitors.table.columns.responseTime")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.httpMonitors.table.columns.lastChecked")}
											</Table.Column>
											<Table.Column align="end">
												<span mix={[visuallyHidden()]}>
													{ctx.intl.t("page.httpMonitors.table.columns.actions")}
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
																{ctx.intl.t("page.httpMonitors.table.disabled")}
															</Badge>
														)}
													</Table.Cell>
													<Table.Cell>
														<code>{monitor.url}</code>
													</Table.Cell>
													<Table.Cell>
														<Badge {...badgeVariant(STATUS_BADGE_TONE[status] ?? "neutral")}>
															{ctx.intl.t(`page.httpMonitors.table.status.${status}`)}
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
															formatDateTime(new Date(monitor.last_checked_at), {
																locale: ctx.locale,
																timeZone: "UTC",
															})
														) : (
															<span mix={[fg("neutral.muted")]}>
																{ctx.intl.t("page.httpMonitors.table.neverChecked")}
															</span>
														)}
													</Table.Cell>
													<Table.Cell>
														<RowMenu
															id={menuId}
															label={ctx.intl.t("page.httpMonitors.table.actions.menu")}
														>
															<Menu.Item
																href={routes.app.team.monitors.show.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																<EyeIcon size={16} strokeWidth={1.5} />
																{ctx.intl.t("page.httpMonitors.table.actions.view")}
															</Menu.Item>
															<Menu.Item
																href={routes.app.team.monitors.edit.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																<PencilIcon size={16} strokeWidth={1.5} />
																{ctx.intl.t("page.httpMonitors.table.actions.edit")}
															</Menu.Item>
															<Menu.Separator />
															<Menu.Item danger commandfor={deleteDialogId} command="show-modal">
																<TrashIcon size={16} strokeWidth={1.5} />
																{ctx.intl.t("page.httpMonitors.table.actions.delete")}
															</Menu.Item>
														</RowMenu>

														<AlertDialog
															id={deleteDialogId}
															aria-labelledby={titleId}
															aria-describedby={descriptionId}
														>
															<AlertDialog.Header>
																<AlertDialog.Title id={titleId}>
																	{ctx.intl.t("page.httpMonitors.table.confirmation.delete", {
																		name: monitor.name,
																	})}
																</AlertDialog.Title>
																<AlertDialog.Description id={descriptionId}>
																	{ctx.intl.t(
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
																		{ctx.intl.t("page.editMonitor.form.cancel")}
																	</AlertDialog.Cancel>
																	<Button type="submit" color="danger">
																		{ctx.intl.t("page.httpMonitors.table.actions.delete")}
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
	},
});
