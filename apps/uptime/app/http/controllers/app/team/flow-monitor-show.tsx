/**
 * Flow monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s when the
 * monitor doesn't belong to the current team. The controller reads the monitor row and nothing
 * else, so the shell reaches the browser on one query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { IntlProvider } from "@sdxc/i18n/ui";
import { PencilIcon, TrashIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { AlertDialog, Badge, Button, LinkButton, Menu, PropertyList, RelativeTime } from "@sdxc/ui";
import { StatCard } from "@sdxc/ui/app";
import { Frame } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { withPrefix } from "~/app/services/prefixed-translate";
import { badgeVariant } from "~/resources/components/badge";
import RowMenu from "~/resources/components/row-menu";
import RunFlowButton, { FLOW_RESULTS_FRAME } from "~/resources/components/run-flow-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** `error` is neutral, not `down`: it means this app could not find out. */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/** Stable id for the delete confirmation, which the overflow menu's Delete opens. */
const DELETE_DIALOG_ID = "delete-flow-monitor";

/**
 * GET /app/:team/flows/:monitorId — a flow monitor's detail page. The run button hydrates as
 * an island under a request-scoped `IntlProvider`, so i18n state never leaks across concurrent
 * requests in the Workers isolate; the run-derived stats stream in through their own frame.
 */
export default createAction(routes.app.team.flowMonitors.show, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.flowMonitors
			.inTeam(ctx.team.id)
			.where({ id: monitorId })
			.first();
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.flowMonitors.delete);
		let canDelete = ctx.access.can(abilities.flowMonitors.delete);

		let t = withPrefix(ctx.intl.t, "page.flowMonitorDetail");

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: t("header.breadcrumb.flowMonitors"),
							href: routes.app.team.flowMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					status={
						<Badge {...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}>
							{ctx.intl.t(`page.flowMonitors.table.status.${monitor.last_status ?? "pending"}`)}
						</Badge>
					}
					overflow={
						canDelete ? (
							<RowMenu id="flow-monitor-overflow" label={t("header.action.more")}>
								<Menu.Item danger commandfor={DELETE_DIALOG_ID} command="show-modal">
									<TrashIcon size={16} strokeWidth={1.5} />
									{ctx.intl.t("page.flowMonitors.table.actions.delete")}
								</Menu.Item>
							</RowMenu>
						) : undefined
					}
					actions={
						<LinkButton
							variant="outline"
							color="neutral"
							href={routes.app.team.flowMonitors.edit.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
						>
							<PencilIcon size={16} strokeWidth={1.5} />
							{t("header.action.edit")}
						</LinkButton>
					}
					primaryAction={
						<IntlProvider intl={ctx.intl}>
							<RunFlowButton
								action={routes.actions.monitor.flow.check.href({ team: ctx.team.slug })}
								monitorId={monitor.id}
								name={monitor.name}
							/>
						</IntlProvider>
					}
				>
					<div mix={[vstack({ gap: 8, align: "stretch" })]}>
						<PropertyList>
							<PropertyList.Item label={t("info.interval")}>
								{ctx.intl.t(
									`page.createFlowMonitor.form.fields.interval.options.${monitor.interval_seconds}`,
								)}
							</PropertyList.Item>
							<PropertyList.Item label={t("info.lastChecked")}>
								{monitor.last_checked_at === null ? null : (
									<RelativeTime date={monitor.last_checked_at} locale={ctx.locale} local />
								)}
							</PropertyList.Item>
							<PropertyList.Item label={t("info.monitoring")}>
								{monitor.is_enabled
									? t("info.active")
									: ctx.intl.t("page.flowMonitors.table.status.disabled")}
							</PropertyList.Item>
						</PropertyList>

						<Frame
							name={FLOW_RESULTS_FRAME}
							src={routes.app.team.flowMonitors.cards.results.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={
								<StatCard.Group columns={3}>
									<StatCard.Skeleton delta={false} />
									<StatCard.Skeleton delta={false} />
									<StatCard.Skeleton delta={false} />
								</StatCard.Group>
							}
						/>
					</div>

					{canDelete ? (
						<AlertDialog
							id={DELETE_DIALOG_ID}
							aria-labelledby={`${DELETE_DIALOG_ID}-title`}
							aria-describedby={`${DELETE_DIALOG_ID}-description`}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
									{ctx.intl.t("page.flowMonitors.table.actions.confirmation.delete", {
										name: monitor.name,
									})}
								</AlertDialog.Title>
								<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
									{ctx.intl.t("page.editFlowMonitor.danger.description")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.monitor.flow.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel type="button" commandfor={DELETE_DIALOG_ID}>
										{ctx.intl.t("page.editFlowMonitor.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.intl.t("page.flowMonitors.table.actions.delete")}
									</Button>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					) : null}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
