/**
 * Alert history page controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { formatDateTime } from "@sdxc/dates";
import { BellIcon, HistoryIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { fontSize } from "@sdxc/u/typography";
import { Badge, Empty, LinkButton, Table } from "@sdxc/ui";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const HISTORY_LIMIT = 100;

/**
 * Only the two settled outcomes carry a tone: `pending` and every suppression reason
 * (`skipped_cooldown`, `skipped_cap`, and whichever `skipped_*` comes next) take the
 * neutral default, so adding one needs no edit here.
 */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	sent: "up",
	failed: "down",
};

/**
 * The translated label for an alert event's status; a status the locales have no copy for
 * reads as "skipped", so a status added to the database later still renders a label.
 */
function statusLabel(t: Translate, status: string): string {
	let key = `page.alertHistory.table.status.${status}`;
	let label = t(key);
	return label === key ? t("page.alertHistory.table.status.skipped") : label;
}

const EVENT_TYPE_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/** GET /app/:team/alert-history — the team's alert delivery history. */
export default createAction(routes.app.team.alerts.history, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let alerts = await ctx.models.alerts.inTeam(ctx.team.id).orderBy("created_at", "desc").all();
		let alertsById = new Map(alerts.map((alert) => [alert.id, alert]));
		let events = await ctx.models.alertEvents.latestForAlerts(
			[...alertsById.keys()],
			HISTORY_LIMIT,
		);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${ctx.intl.t("page.alertHistory.header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.alertHistory.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("page.alertHistory.breadcrumbs.alerts"),
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
								<Empty.Title>{ctx.intl.t("page.alertHistory.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.intl.t("page.alertHistory.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.alerts.index.href({ team: ctx.team.slug })}>
										<BellIcon size={20} strokeWidth={1.5} />
										{ctx.intl.t("page.alertHistory.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.intl.t("page.alertHistory.header.title")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.intl.t("page.alertHistory.table.columns.alert")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alertHistory.table.columns.monitor")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alertHistory.table.columns.eventType")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alertHistory.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.intl.t("page.alertHistory.table.columns.sentAt")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{events.map((event) => (
											<Table.Row key={event.id}>
												<Table.Cell>
													{alertsById.get(event.alert_id)?.name ??
														ctx.intl.t("page.alertHistory.table.unknownAlert")}
												</Table.Cell>
												<Table.Cell>
													{event.monitor_name ??
														ctx.intl.t("page.alertHistory.table.unknownMonitor")}
												</Table.Cell>
												<Table.Cell>
													<Badge
														{...badgeVariant(EVENT_TYPE_BADGE_TONE[event.event_type] ?? "neutral")}
													>
														{ctx.intl.t(`page.alertHistory.table.eventType.${event.event_type}`)}
													</Badge>
												</Table.Cell>
												<Table.Cell>
													<Badge {...badgeVariant(STATUS_BADGE_TONE[event.status] ?? "neutral")}>
														{statusLabel(ctx.intl.t, event.status)}
													</Badge>
													{event.error_message && (
														<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
															{event.error_message}
														</p>
													)}
												</Table.Cell>
												<Table.Cell>
													{formatDateTime(new Date(event.sent_at), {
														locale: ctx.locale,
														timeZone: "UTC",
													})}
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
