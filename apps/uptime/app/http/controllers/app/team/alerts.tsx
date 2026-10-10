/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, BellPlusIcon, HistoryIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, textDecoration } from "@sdxc/u/typography";
import { Badge, Empty, LinkButton, Table } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { SelectAlert } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import { MAX_ALERTS_PER_TEAM } from "~/app/models/alerts";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/alerts — the team's alerts list. */
export default createAction(routes.app.team.alerts.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await ctx.models.alerts.inTeam(ctx.team.id).orderBy("created_at", "desc").all();
		let atLimit = alerts.length >= MAX_ALERTS_PER_TEAM;

		/**
		 * Maps monitor ids to names for the scoped rows in the table. A scope's id is
		 * unique across every monitor type, so keying on id alone is enough for
		 * {@link storedMonitorScope}'s resolved scope to look up its name.
		 */
		let scopeGroups = await listScopeMonitors(ctx.models, ctx.team.id);
		let monitorNamesById = new Map(
			scopeGroups.flatMap((group) => group.monitors.map((monitor) => [monitor.id, monitor.name])),
		);

		/** How one alert's scope reads in the table: a monitor's name, a type, or team-wide. */
		function scopeLabel(alert: SelectAlert): string {
			let scope = storedMonitorScope(alert);
			if (scope.monitorType === null) return ctx.intl.t("page.alerts.table.scope.teamWide");
			if (scope.monitorId === null) {
				return ctx.intl.t(`page.alerts.table.scope.allOfType.${scope.monitorType}`);
			}

			return (
				monitorNamesById.get(scope.monitorId) ??
				ctx.intl.t("page.alerts.table.scope.unknownMonitor")
			);
		}

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${ctx.intl.t("page.alerts.header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.alerts.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[hstack({ align: "center", gap: 3 })]}>
							<LinkButton href={routes.app.team.alerts.history.href({ team: ctx.team.slug })}>
								<HistoryIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.alerts.header.action.history")}
							</LinkButton>
							{!atLimit && (
								<LinkButton href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}>
									<BellPlusIcon size={16} strokeWidth={1.5} />
									{ctx.intl.t("page.alerts.header.action.create")}
								</LinkButton>
							)}
						</div>
					}
				>
					<div>
						{atLimit && (
							<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{ctx.intl.t("page.alerts.limitReached", { limit: MAX_ALERTS_PER_TEAM })}
							</p>
						)}

						{alerts.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<BellIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.intl.t("page.alerts.empty.title")}</Empty.Title>
								<Empty.Description>{ctx.intl.t("page.alerts.empty.description")}</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.intl.t("page.alerts.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.intl.t("page.alerts.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{ctx.intl.t("page.alerts.table.columns.name")}</Table.Column>
											<Table.Column>{ctx.intl.t("page.alerts.table.columns.scope")}</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alerts.table.columns.strategy")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alerts.table.columns.notifyOnRecovery")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alerts.table.columns.cooldown")}
											</Table.Column>
											<Table.Column></Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{alerts.map((alert) => (
											<Table.Row key={alert.id}>
												<Table.Cell>
													{alert.name}
													{/**
													 * A destination that answered it no longer exists stops receiving
													 * deliveries, so the row says why until the channel is saved again.
													 */}
													{alert.broken_at !== null && (
														<div mix={[vstack({ gap: 1, align: "start" })]}>
															<Badge {...badgeVariant("down")}>
																{ctx.intl.t("page.alerts.table.broken.label")}
															</Badge>
															<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
																{ctx.intl.t("page.alerts.table.broken.description", {
																	reason: alert.broken_reason ?? "",
																})}
															</p>
														</div>
													)}
												</Table.Cell>
												<Table.Cell>{scopeLabel(alert)}</Table.Cell>
												<Table.Cell>
													{ctx.intl.t(`page.alerts.table.types.${alert.config.strategy}`)}
												</Table.Cell>
												<Table.Cell>
													{alert.notify_on_recovery
														? ctx.intl.t("page.alerts.table.notifyOnRecovery.enabled")
														: ctx.intl.t("page.alerts.table.notifyOnRecovery.disabled")}
												</Table.Cell>
												<Table.Cell>
													{alert.cooldown_minutes === 0
														? ctx.intl.t("page.alerts.table.cooldown.none")
														: `${alert.cooldown_minutes}m`}
												</Table.Cell>
												<Table.Cell>
													<a
														href={routes.app.team.alerts.edit.href({
															team: ctx.team.slug,
															alertId: alert.id,
														})}
														mix={[
															fg("brand"),
															textDecoration("none"),
															hover(textDecoration("underline")),
														]}
													>
														{ctx.intl.t("page.alerts.table.actions.edit")}
													</a>
												</Table.Cell>
											</Table.Row>
										))}
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
