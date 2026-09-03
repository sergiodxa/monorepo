/**
 * Flow monitors list controller. Renders every flow monitor for the team with its last-known
 * status and what its last run concluded, or an empty state when there are none yet. Requires
 * `requireUser` + `requireTeam`.
 *
 * Each row's kebab-icon actions menu is the shared `RowMenu` — view, edit, delete — and its delete
 * confirmation is `@sdxc/ui`'s `AlertDialog` composed directly rather than through the `Confirm`
 * wrapper, since the confirming control is a real `<form method="post">` submit button rather than
 * a `command="close"` action. The same composition the HTTP monitors' list uses, so the two tables
 * draw the same row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { formatDateTime, formatRelative } from "@sdxc/dates";
import { EyeIcon, PencilIcon, PlusIcon, TrashIcon, WorkflowIcon } from "@sdxc/icons";
import { inject } from "@sdxc/service-container";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg } from "@sdxc/u/color";
import { flex, items } from "@sdxc/u/layout";
import { hover } from "@sdxc/u/state";
import { nowrap, textDecoration } from "@sdxc/u/typography";
import { AlertDialog, Badge, Button, Empty, LinkButton, Menu, Table } from "@sdxc/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import RowMenu from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * `error` is neutral and not `down`: it means this app could not find out — an unparseable spec,
 * a host no verified domain covers — and colouring it as an outage would put our own
 * misconfiguration in a customer's incident history (ADR-027 §8).
 */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/**
 * GET /app/:team/flows — the team's flow monitors list. The header action's
 * label stays on one line since a button breaking mid-phrase reads as broken.
 */
export default createAction(routes.app.team.flowMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await FlowMonitor.listByTeam(db, ctx.team.id);
		let newHref = routes.app.team.flowMonitors.new.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Flow monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.flowMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[flex(), items("center"), nowrap()]}>
							<LinkButton href={newHref}>
								<PlusIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.flowMonitors.header.action.create")}
							</LinkButton>
						</div>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<WorkflowIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.flowMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.flowMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={newHref}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.flowMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.flowMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.interval")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.lastChecked")}
											</Table.Column>
											<Table.Column align="end">
												<span mix={[visuallyHidden()]}>
													{ctx.i18next.t("page.flowMonitors.table.columns.actions")}
												</span>
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => {
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
														<a
															href={showHref}
															mix={[
																fg("brand"),
																textDecoration("none"),
																hover(textDecoration("underline")),
															]}
														>
															{monitor.name}
														</a>
														{!monitor.is_enabled && (
															<Badge {...badgeVariant("neutral")}>
																{ctx.i18next.t("page.flowMonitors.table.status.disabled")}
															</Badge>
														)}
													</Table.Cell>
													<Table.Cell mix={[nowrap()]}>
														{ctx.i18next.t(
															`page.createFlowMonitor.form.fields.interval.options.${monitor.interval_seconds}`,
														)}
													</Table.Cell>
													<Table.Cell>
														<Badge
															{...badgeVariant(
																STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral",
															)}
														>
															{ctx.i18next.t(
																`page.flowMonitors.table.status.${monitor.last_status ?? "pending"}`,
															)}
														</Badge>
													</Table.Cell>
													<Table.Cell>
														{monitor.last_checked_at === null ? (
															"—"
														) : (
															<time
																datetime={new Date(monitor.last_checked_at).toISOString()}
																title={formatDateTime(new Date(monitor.last_checked_at), {
																	locale: ctx.locale,
																	timeZone: "UTC",
																})}
																mix={[nowrap()]}
															>
																{formatRelative(new Date(monitor.last_checked_at), {
																	locale: ctx.locale,
																})}
															</time>
														)}
													</Table.Cell>
													<Table.Cell>
														<RowMenu
															id={menuId}
															label={ctx.i18next.t("page.flowMonitors.table.actions.menu")}
														>
															<Menu.Item href={showHref}>
																<EyeIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.flowMonitors.table.actions.view")}
															</Menu.Item>
															<Menu.Item
																href={routes.app.team.flowMonitors.edit.href({
																	team: ctx.team.slug,
																	monitorId: monitor.id,
																})}
															>
																<PencilIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.flowMonitors.table.actions.edit")}
															</Menu.Item>
															<Menu.Separator />
															<Menu.Item danger commandfor={deleteDialogId} command="show-modal">
																<TrashIcon size={16} strokeWidth={1.5} />
																{ctx.i18next.t("page.flowMonitors.table.actions.delete")}
															</Menu.Item>
														</RowMenu>

														<AlertDialog
															id={deleteDialogId}
															aria-labelledby={titleId}
															aria-describedby={descriptionId}
														>
															<AlertDialog.Header>
																<AlertDialog.Title id={titleId}>
																	{ctx.i18next.t(
																		"page.flowMonitors.table.actions.confirmation.delete",
																		{
																			name: monitor.name,
																		},
																	)}
																</AlertDialog.Title>
																<AlertDialog.Description id={descriptionId}>
																	{ctx.i18next.t("page.editFlowMonitor.danger.description")}
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
																		{ctx.i18next.t("page.editFlowMonitor.form.cancel")}
																	</AlertDialog.Cancel>
																	<Button type="submit" color="danger">
																		{ctx.i18next.t("page.flowMonitors.table.actions.delete")}
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
