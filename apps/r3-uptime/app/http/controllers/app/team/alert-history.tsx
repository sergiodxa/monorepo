/**
 * Alert history page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, HistoryIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import routes from "~/routes/web";

const HISTORY_LIMIT = 100;

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	sent: "up",
	skipped_cooldown: "neutral",
	failed: "down",
};

const EVENT_TYPE_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/** GET /app/:team/alert-history — the team's alert delivery history. */
export default createAction(routes.app.team.alerts.history, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await Alert.listByTeam(db, ctx.team.id);
		let alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
		let events = await AlertEvent.listByAlertIds(db, [...alertsById.keys()], HISTORY_LIMIT);

		return ctx.render(
			<DocumentLayout
				title={`${ctx.team.name} · ${ctx.i18next.t("page.alertHistory.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.alertHistory.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("page.alertHistory.breadcrumbs.alerts"),
							href: routes.app.team.alerts.index.href({ team: ctx.team.slug }),
						},
					]}
				>
					<div>
						{events.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<HistoryIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.alertHistory.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.alertHistory.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.alerts.index.href({ team: ctx.team.slug })}>
										<BellIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.alertHistory.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
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
											<th>{ctx.i18next.t("page.alertHistory.table.columns.alert")}</th>
											<th>{ctx.i18next.t("page.alertHistory.table.columns.monitor")}</th>
											<th>{ctx.i18next.t("page.alertHistory.table.columns.eventType")}</th>
											<th>{ctx.i18next.t("page.alertHistory.table.columns.status")}</th>
											<th>{ctx.i18next.t("page.alertHistory.table.columns.sentAt")}</th>
										</tr>
									</thead>
									<tbody>
										{events.map((event) => (
											<tr key={event.id}>
												<td>
													{alertsById.get(event.alert_id)?.name ??
														ctx.i18next.t("page.alertHistory.table.unknownAlert")}
												</td>
												<td>
													{event.monitor_name ??
														ctx.i18next.t("page.alertHistory.table.unknownMonitor")}
												</td>
												<td>
													<Badge tone={EVENT_TYPE_BADGE_TONE[event.event_type] ?? "neutral"}>
														{ctx.i18next.t(`page.alertHistory.table.eventType.${event.event_type}`)}
													</Badge>
												</td>
												<td>
													<Badge tone={STATUS_BADGE_TONE[event.status] ?? "neutral"}>
														{ctx.i18next.t(`page.alertHistory.table.status.${event.status}`)}
													</Badge>
													{event.error_message && (
														<p
															mix={[
																css({
																	fontSize: "0.8125rem",
																	color: neutral[500],
																	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
																}),
															]}
														>
															{event.error_message}
														</p>
													)}
												</td>
												<td>{new Date(event.sent_at).toLocaleString()}</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
