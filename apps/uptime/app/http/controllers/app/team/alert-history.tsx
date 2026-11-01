/**
 * Alert history page controller. Requires `requireUser` + `requireTeam`. Reads as an incident
 * log: newest delivery first, what happened to which monitor, and whether the notice went out,
 * narrowed by event and delivery facets held in the URL so a filtered view is a link.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";

import { BellIcon, HistoryIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";
import { clearFiltersHref, Empty, FilterBar, paramValues, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import ListKeys from "~/resources/views/shared/list-keys";
import routes from "~/routes/web";

const HISTORY_LIMIT = 100;

/** The URL parameters the facets own, which "Clear filters" removes together. */
const FILTER_PARAMS = ["event", "status"];

/** Event types in the order an incident runs, which the event facet lists them in. */
const EVENT_TYPES = ["down", "degraded", "up"] as const;

/** Delivery outcomes the status facet offers; every `skipped_*` reason files under `skipped`. */
const DELIVERY_STATUSES = ["sent", "failed", "pending", "skipped"] as const;

/**
 * Only the two settled outcomes carry a tone: `pending` and every suppression reason
 * (`skipped_cooldown`, `skipped_cap`, and whichever `skipped_*` comes next) take the
 * neutral default, so adding one needs no edit here.
 */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	sent: "up",
	failed: "down",
};

/** The status dot's role per event type; an event type added later reads as neutral. */
const EVENT_COLOR: Record<string, "danger" | "warning" | "success"> = {
	down: "danger",
	degraded: "warning",
	up: "success",
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

/** The facet value a stored delivery status files under, folding every suppression into `skipped`. */
function statusFacet(status: string): string {
	return status.startsWith("skipped") ? "skipped" : status;
}

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

		let t = ctx.intl.t;
		let team = { team: ctx.team.slug };
		let eventFilter = paramValues(ctx.url, "event");
		let statusFilter = paramValues(ctx.url, "status");

		/**
		 * The facets narrow the rows already loaded, so the counts beside each option describe
		 * the same latest {@link HISTORY_LIMIT} deliveries the table draws from.
		 */
		let shown = events.filter(
			(event) =>
				(eventFilter.length === 0 || eventFilter.includes(event.event_type)) &&
				(statusFilter.length === 0 || statusFilter.includes(statusFacet(event.status))),
		);

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${t("page.alertHistory.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("page.alertHistory.header.title")}
					description={
						events.length > 0
							? t("page.alertHistory.header.description", { limit: HISTORY_LIMIT })
							: undefined
					}
					breadcrumbs={[
						{
							label: t("page.alertHistory.breadcrumbs.alerts"),
							href: routes.app.team.alerts.index.href(team),
						},
					]}
				>
					{events.length === 0 ? (
						<Empty kind="first-run" icon={<HistoryIcon size={24} strokeWidth={1.5} />}>
							<Empty.Title>{t("page.alertHistory.empty.title")}</Empty.Title>
							<Empty.Description>{t("page.alertHistory.empty.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={routes.app.team.alerts.index.href(team)}>
									<BellIcon size={16} strokeWidth={1.5} />
									{t("page.alertHistory.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<div mix={[vstack({ gap: 4 })]}>
							<FilterBar
								id="alert-history"
								url={ctx.url}
								locale={ctx.locale}
								collapse
								facets={[
									{
										name: "event",
										label: t("page.alertHistory.filters.event"),
										options: EVENT_TYPES.map((type) => ({
											value: type,
											label: t(`page.alertHistory.table.eventType.${type}`),
											count: events.filter((event) => event.event_type === type).length,
										})),
									},
									{
										name: "status",
										label: t("page.alertHistory.filters.status"),
										options: DELIVERY_STATUSES.map((status) => ({
											value: status,
											label: t(`page.alertHistory.table.status.${status}`),
											count: events.filter((event) => statusFacet(event.status) === status).length,
										})),
									},
								]}
								labels={{
									toolbar: t("page.alertHistory.filters.toolbar"),
									tabs: t("page.alertHistory.filters.toolbar"),
									filters: t("page.alertHistory.filters.filters"),
									apply: t("page.alertHistory.filters.apply"),
									is: t("page.alertHistory.filters.is"),
									isAnyOf: t("page.alertHistory.filters.isAnyOf"),
									clear: t("page.alertHistory.filters.clear"),
									remove: (field, values) =>
										t("page.alertHistory.filters.remove", { field, values }),
								}}
							/>

							{shown.length === 0 ? (
								<Empty kind="no-results" size="compact">
									<Empty.Title>{t("page.alertHistory.noResults.title")}</Empty.Title>
									<Empty.Description>
										{t("page.alertHistory.noResults.description")}
									</Empty.Description>
									<Empty.Action>
										<LinkButton
											href={clearFiltersHref(ctx.url, FILTER_PARAMS)}
											variant="outline"
											color="neutral"
										>
											{t("page.alertHistory.filters.clear")}
										</LinkButton>
									</Empty.Action>
								</Empty>
							) : (
								<Table.Container>
									<ListKeys t={ctx.intl.t} filterBar="alert-history" />
									<Table aria-label={t("page.alertHistory.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("page.alertHistory.table.columns.sentAt")}</Table.Column>
												<Table.Column>
													{t("page.alertHistory.table.columns.eventType")}
												</Table.Column>
												<Table.Column>{t("page.alertHistory.table.columns.monitor")}</Table.Column>
												<Table.Column>{t("page.alertHistory.table.columns.alert")}</Table.Column>
												<Table.Column>{t("page.alertHistory.table.columns.status")}</Table.Column>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{shown.map((event) => {
												let alert = alertsById.get(event.alert_id);

												return (
													<Table.Row key={event.id}>
														<Table.DateCell date={event.sent_at} locale={ctx.locale} local />
														<Table.StatusCell color={EVENT_COLOR[event.event_type] ?? "neutral"}>
															{t(`page.alertHistory.table.eventType.${event.event_type}`)}
														</Table.StatusCell>
														<Table.Cell>
															{event.monitor_name ?? t("page.alertHistory.table.unknownMonitor")}
														</Table.Cell>
														<Table.Cell>
															{alert ? (
																<Table.RowLink
																	href={routes.app.team.alerts.edit.href({
																		...team,
																		alertId: alert.id,
																	})}
																>
																	{alert.name}
																</Table.RowLink>
															) : (
																t("page.alertHistory.table.unknownAlert")
															)}
														</Table.Cell>
														<Table.Cell>
															<div mix={[vstack({ gap: 1, align: "start" })]}>
																<Badge
																	{...badgeVariant(STATUS_BADGE_TONE[event.status] ?? "neutral")}
																>
																	{statusLabel(t, event.status)}
																</Badge>
																{event.error_message && (
																	<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
																		{event.error_message}
																	</p>
																)}
															</div>
														</Table.Cell>
													</Table.Row>
												);
											})}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</div>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
