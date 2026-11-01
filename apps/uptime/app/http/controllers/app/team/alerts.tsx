/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`. Each row opens the alert's
 * edit form, says where it delivers and how often it may repeat, and marks a channel whose
 * destination stopped existing, so a broken alert is found before the next outage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, BellPlusIcon, HistoryIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";
import { Empty, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { SelectAlert } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MAX_ALERTS_PER_TEAM } from "~/app/models/alerts";
import { storedMonitorScope } from "~/app/services/monitor-scope";
import { listScopeMonitors } from "~/app/services/scope-monitors";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The flash the create, update and delete actions leave for the list they redirect to. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/alerts — the team's alerts list. */
export default createAction(routes.app.team.alerts.index, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await ctx.models.alerts.inTeam(ctx.team.id).orderBy("created_at", "desc").all();
		let atLimit = alerts.length >= MAX_ALERTS_PER_TEAM;
		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;
		let team = { team: ctx.team.slug };

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

		/** A zero cooldown still repeats at the dispatch floor, so it reads as the fastest allowed. */
		function cooldownLabel(minutes: number): string {
			if (minutes === 0) return ctx.intl.t("page.alerts.table.cooldown.none");
			return ctx.intl.t("page.alerts.table.cooldown.minutes", { count: minutes });
		}

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.alerts.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					toast={toast}
					heading={ctx.intl.t("page.alerts.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href(team),
						},
					]}
					description={
						atLimit
							? ctx.intl.t("page.alerts.limitReached", { limit: MAX_ALERTS_PER_TEAM })
							: undefined
					}
					actions={
						<LinkButton
							href={routes.app.team.alerts.history.href(team)}
							variant="outline"
							color="neutral"
						>
							<HistoryIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.alerts.header.action.history")}
						</LinkButton>
					}
					primaryAction={
						atLimit ? undefined : (
							<LinkButton href={routes.app.team.alerts.new.href(team)}>
								<BellPlusIcon size={16} strokeWidth={1.5} />
								{ctx.intl.t("page.alerts.header.action.create")}
							</LinkButton>
						)
					}
				>
					{alerts.length === 0 ? (
						<Empty kind="first-run" icon={<BellIcon size={24} strokeWidth={1.5} />}>
							<Empty.Title>{ctx.intl.t("page.alerts.empty.title")}</Empty.Title>
							<Empty.Description>{ctx.intl.t("page.alerts.empty.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.app.team.alerts.new.href(team)}>
									<PlusIcon size={16} strokeWidth={1.5} />
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
										<Table.Column>{ctx.intl.t("page.alerts.table.columns.strategy")}</Table.Column>
										<Table.Column>
											{ctx.intl.t("page.alerts.table.columns.notifyOnRecovery")}
										</Table.Column>
										<Table.Column numeric>
											{ctx.intl.t("page.alerts.table.columns.cooldown")}
										</Table.Column>
										<Table.ActionsColumn label={ctx.intl.t("page.alerts.table.columns.actions")} />
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{alerts.map((alert) => {
										let editHref = routes.app.team.alerts.edit.href({
											...team,
											alertId: alert.id,
										});

										return (
											<Table.Row key={alert.id}>
												<Table.Cell>
													<div mix={[vstack({ gap: 1, align: "start" })]}>
														<Table.RowLink href={editHref}>{alert.name}</Table.RowLink>
														{/**
														 * A destination that answered it no longer exists stops receiving
														 * deliveries, so the row says why until the channel is saved again.
														 */}
														{alert.broken_at !== null && (
															<>
																<Badge {...badgeVariant("down")}>
																	{ctx.intl.t("page.alerts.table.broken.label")}
																</Badge>
																<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
																	{ctx.intl.t("page.alerts.table.broken.description", {
																		reason: alert.broken_reason ?? "",
																	})}
																</p>
															</>
														)}
													</div>
												</Table.Cell>
												<Table.Cell>{scopeLabel(alert)}</Table.Cell>
												<Table.Cell>
													{ctx.intl.t(`page.alerts.table.types.${alert.config.strategy}`)}
												</Table.Cell>
												<Table.StatusCell color={alert.notify_on_recovery ? "success" : "neutral"}>
													{alert.notify_on_recovery
														? ctx.intl.t("page.alerts.table.notifyOnRecovery.enabled")
														: ctx.intl.t("page.alerts.table.notifyOnRecovery.disabled")}
												</Table.StatusCell>
												<Table.Cell numeric>{cooldownLabel(alert.cooldown_minutes)}</Table.Cell>
												<Table.Actions>
													<LinkButton href={editHref} size="sm" variant="ghost" color="neutral">
														{ctx.intl.t("page.alerts.table.actions.edit")}
													</LinkButton>
												</Table.Actions>
											</Table.Row>
										);
									})}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
