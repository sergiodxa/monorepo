/**
 * Alerts list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, BellPlusIcon, HistoryIcon, PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hstack } from "@pkg/u/layout";
import { hover } from "@pkg/u/state";
import { fontSize, textDecoration } from "@pkg/u/typography";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SelectAlert } from "~/database/schema";

import Alert, { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import { listScopeMonitors } from "~/app/data/scope-monitors";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { storedMonitorScope } from "~/app/lib/monitor-scope";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/alerts — the team's alerts list. */
export default createAction(routes.app.team.alerts.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await Alert.listByTeam(db, ctx.team.id);
		let atLimit = alerts.length >= MAX_ALERTS_PER_TEAM;

		/**
		 * Names for the monitor-scoped rows, keyed across every type: a scope's id is unique
		 * on its own, and pairing it with its type here would only make the lookup below
		 * restate what {@link storedMonitorScope} already resolved.
		 */
		let scopeGroups = await listScopeMonitors(db, ctx.team.id);
		let monitorNamesById = new Map(
			scopeGroups.flatMap((group) => group.monitors.map((monitor) => [monitor.id, monitor.name])),
		);

		/** How one alert's scope reads in the table: a monitor's name, a type, or team-wide. */
		function scopeLabel(alert: SelectAlert): string {
			let scope = storedMonitorScope(alert);
			if (scope.monitorType === null) return ctx.i18next.t("page.alerts.table.scope.teamWide");
			if (scope.monitorId === null) {
				return ctx.i18next.t(`page.alerts.table.scope.allOfType.${scope.monitorType}`);
			}

			return (
				monitorNamesById.get(scope.monitorId) ??
				ctx.i18next.t("page.alerts.table.scope.unknownMonitor")
			);
		}

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${ctx.i18next.t("page.alerts.header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.alerts.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[hstack({ align: "center", gap: 3 })]}>
							<LinkButton href={routes.app.team.alerts.history.href({ team: ctx.team.slug })}>
								<HistoryIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.alerts.header.action.history")}
							</LinkButton>
							{!atLimit && (
								<LinkButton href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}>
									<BellPlusIcon size={16} strokeWidth={1.5} />
									{ctx.i18next.t("page.alerts.header.action.create")}
								</LinkButton>
							)}
						</div>
					}
				>
					<div>
						{atLimit && (
							<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{ctx.i18next.t("page.alerts.limitReached", { limit: MAX_ALERTS_PER_TEAM })}
							</p>
						)}

						{alerts.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<BellIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.alerts.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.alerts.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.alerts.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.alerts.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.alerts.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{ctx.i18next.t("page.alerts.table.columns.name")}</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alerts.table.columns.scope")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alerts.table.columns.strategy")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alerts.table.columns.notifyOnRecovery")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alerts.table.columns.cooldown")}
											</Table.Column>
											<Table.Column></Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{alerts.map((alert) => (
											<Table.Row key={alert.id}>
												<Table.Cell>{alert.name}</Table.Cell>
												<Table.Cell>{scopeLabel(alert)}</Table.Cell>
												<Table.Cell>
													{ctx.i18next.t(`page.alerts.table.types.${alert.config.strategy}`)}
												</Table.Cell>
												<Table.Cell>
													{alert.notify_on_recovery
														? ctx.i18next.t("page.alerts.table.notifyOnRecovery.enabled")
														: ctx.i18next.t("page.alerts.table.notifyOnRecovery.disabled")}
												</Table.Cell>
												<Table.Cell>
													{alert.cooldown_minutes === 0
														? ctx.i18next.t("page.alerts.table.cooldown.none")
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
														{ctx.i18next.t("page.alerts.table.actions.edit")}
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
	}),
});
