/**
 * TCP monitor detail page controller. Draws the monitor's configuration beside its streamed
 * results and uptime history, with the check, edit and delete actions in the page header.
 * Requires `requireUser` + `requireTeam`; 404s when the monitor isn't the current team's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import { notFound } from "@sdxc/http/response/html";
import { EllipsisIcon, PencilIcon, PlayIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { Button, Confirm, LinkButton, Menu, PropertyList, RelativeTime, StatusDot } from "@sdxc/ui";
import { StatCard } from "@sdxc/ui/app";
import { menuKeys } from "@sdxc/ui/mixins";
import { css, Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The dot color each last outcome is drawn in; a monitor never checked reads neutral. */
const STATUS_COLOR: Record<string, SemanticColor> = {
	up: "success",
	timeout: "warning",
	down: "danger",
};

/** `id` shared between the overflow menu and the button that opens it. */
const ACTIONS_MENU_ID = "tcp-monitor-actions";

/** `id` shared between the overflow menu's Delete item and the confirmation it opens. */
const DELETE_DIALOG_ID = "delete-tcp-monitor";

/**
 * GET /app/:team/tcp/:monitorId — a TCP monitor's detail page. Delete sits last in the
 * overflow menu and appears only for a member allowed to delete monitors, so nobody is
 * offered an action that would answer 403.
 */
export default createAction(routes.app.team.tcpMonitors.show, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.tcpMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.tcpMonitors.delete);
		let canDelete = ctx.access.can(abilities.tcpMonitors.delete);

		let statusLabel = ctx.intl.t(
			`page.tcpMonitors.table.status.${monitor.last_status ?? "pending"}`,
		);
		let endpoint = `${monitor.host}:${monitor.port}`;

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={ctx.intl.t("app.titles.record", { team: ctx.team.name, name: monitor.name })}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={monitor.name}
					description={<code>{endpoint}</code>}
					status={
						<StatusDot color={STATUS_COLOR[monitor.last_status ?? ""] ?? "neutral"}>
							{statusLabel}
						</StatusDot>
					}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.intl.t("page.tcpMonitorDetail.header.breadcrumb.tcpMonitors"),
							href: routes.app.team.tcpMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					overflow={
						canDelete ? (
							<>
								<Button
									type="button"
									variant="ghost"
									color="neutral"
									size="sm"
									commandfor={ACTIONS_MENU_ID}
									command="toggle-popover"
									aria-label={ctx.intl.t("page.tcpMonitorDetail.overflow.label")}
								>
									<EllipsisIcon size={16} aria-hidden="true" />
								</Button>
								<Menu
									id={ACTIONS_MENU_ID}
									placement="bottom-end"
									aria-label={ctx.intl.t("page.tcpMonitorDetail.overflow.label")}
									mix={[menuKeys()]}
								>
									<Menu.Item danger commandfor={DELETE_DIALOG_ID} command="show-modal">
										{ctx.intl.t("page.tcpMonitors.table.actions.delete")}
									</Menu.Item>
								</Menu>
							</>
						) : undefined
					}
					actions={
						<LinkButton
							variant="outline"
							size="sm"
							href={routes.app.team.tcpMonitors.edit.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
						>
							<PencilIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.tcpMonitorDetail.header.action.edit")}
						</LinkButton>
					}
					primaryAction={
						<form
							method="post"
							action={routes.actions.monitor.tcp.check.href({ team: ctx.team.slug })}
							mix={[m("0")]}
						>
							<input type="hidden" name="monitor_id" value={monitor.id} />
							<Button type="submit" size="sm">
								<PlayIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.tcpMonitorDetail.header.action.checkNow")}
							</Button>
						</form>
					}
				>
					<div
						mix={[
							css({
								display: "grid",
								gap: "2rem",
								gridTemplateColumns: "minmax(0, 1fr)",
								alignItems: "start",
								"@media (min-width: 72rem)": {
									gridTemplateColumns: "minmax(0, 1fr) minmax(16rem, 20rem)",
								},
							}),
						]}
					>
						<div mix={[vstack({ gap: 8 })]}>
							<Frame
								name="tcp-monitor-card-uptime-history"
								src={routes.app.team.tcpMonitors.cards.uptimeHistory.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={
									<StatCard.Group aria-busy="true" columns={1}>
										<StatCard.Skeleton delta={false} />
									</StatCard.Group>
								}
							/>

							<Frame
								name="tcp-monitor-card-results"
								src={routes.app.team.tcpMonitors.cards.results.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={
									<StatCard.Group aria-busy="true">
										<StatCard.Skeleton delta={false} footer={false} />
										<StatCard.Skeleton delta={false} footer={false} />
										<StatCard.Skeleton delta={false} footer={false} />
									</StatCard.Group>
								}
							/>
						</div>

						<section mix={[vstack({ gap: 3 })]}>
							<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
								{ctx.intl.t("page.tcpMonitorDetail.info.title")}
							</h2>
							<PropertyList>
								<PropertyList.Item label={ctx.intl.t("page.tcpMonitorDetail.info.endpoint")}>
									<code>{endpoint}</code>
								</PropertyList.Item>
								<PropertyList.Item label={ctx.intl.t("page.tcpMonitorDetail.info.status")}>
									<StatusDot color={STATUS_COLOR[monitor.last_status ?? ""] ?? "neutral"}>
										{statusLabel}
									</StatusDot>
								</PropertyList.Item>
								<PropertyList.Item label={ctx.intl.t("page.tcpMonitorDetail.info.interval")}>
									{`${monitor.interval_seconds}s`}
								</PropertyList.Item>
								<PropertyList.Item label={ctx.intl.t("page.tcpMonitorDetail.info.timeout")}>
									{`${monitor.timeout_ms}ms`}
								</PropertyList.Item>
								<PropertyList.Item
									label={ctx.intl.t("page.tcpMonitors.table.columns.lastChecked")}
									empty="—"
								>
									{monitor.last_checked_at === null ? null : (
										<RelativeTime date={monitor.last_checked_at} locale={ctx.locale} local />
									)}
								</PropertyList.Item>
							</PropertyList>
						</section>
					</div>

					{canDelete && (
						<Confirm
							id={DELETE_DIALOG_ID}
							color="danger"
							title={ctx.intl.t("app.confirm.deleteTcpMonitor.title", {
								name: monitor.name,
							})}
							description={ctx.intl.t("page.editTcpMonitor.danger.description")}
							confirmLabel={ctx.intl.t("app.confirm.deleteMonitor.action")}
							cancelLabel={ctx.intl.t("page.editTcpMonitor.form.cancel")}
							form={{
								action: routes.actions.monitor.tcp.delete.href({ team: ctx.team.slug }),
								method: "post",
								fields: (
									<>
										<input type="hidden" name="_method" value="DELETE" />
										<input type="hidden" name="monitor_id" value={monitor.id} />
									</>
								),
							}}
						/>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
