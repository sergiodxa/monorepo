/**
 * Alert history page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, HistoryIcon } from "@pkg/lucide-remix";
import { Badge, Empty, LinkButton, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { fontSize } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import Alert from "~/app/data/alert";
import AlertEvent from "~/app/data/alert-event";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.alertHistory.header.title")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.alertHistory.table.columns.alert")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alertHistory.table.columns.monitor")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alertHistory.table.columns.eventType")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alertHistory.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.alertHistory.table.columns.sentAt")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{events.map((event) => (
											<Table.Row key={event.id}>
												<Table.Cell>
													{alertsById.get(event.alert_id)?.name ??
														ctx.i18next.t("page.alertHistory.table.unknownAlert")}
												</Table.Cell>
												<Table.Cell>
													{event.monitor_name ??
														ctx.i18next.t("page.alertHistory.table.unknownMonitor")}
												</Table.Cell>
												<Table.Cell>
													<Badge
														{...badgeVariant(EVENT_TYPE_BADGE_TONE[event.event_type] ?? "neutral")}
													>
														{ctx.i18next.t(`page.alertHistory.table.eventType.${event.event_type}`)}
													</Badge>
												</Table.Cell>
												<Table.Cell>
													<Badge {...badgeVariant(STATUS_BADGE_TONE[event.status] ?? "neutral")}>
														{ctx.i18next.t(`page.alertHistory.table.status.${event.status}`)}
													</Badge>
													{event.error_message && (
														<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
															{event.error_message}
														</p>
													)}
												</Table.Cell>
												<Table.Cell>{new Date(event.sent_at).toLocaleString()}</Table.Cell>
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
