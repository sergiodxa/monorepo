/**
 * Route module for the team's alert history page. Its loader gathers the team's alerts, then
 * loads the 100 most recent alert events, enriching each with its originating alert and
 * monitor. The page renders an empty state when there is no history or a table of events
 * showing the alert, monitor, event type, delivery status, and timestamp. It exists to give
 * teams an audit trail of when and how alert notifications were dispatched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cn } from "@pkg/cn";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { HistoryIcon, BellIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

import { AppHeader } from "~/components/app-header";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("alertHistory.loader.start", {
		route: "alert-history",
		teamId: team().id,
	});

	// Query approach using team alerts
	let teamAlerts = await measure("findTeamAlerts", () => {
		return db().query.alerts.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			columns: { id: true, name: true },
		});
	});

	let alertIds = teamAlerts.map((a) => a.id);

	if (alertIds.length === 0) {
		logger().info("alertHistory.loader.complete", {
			route: "alert-history",
			teamId: team().id,
			alertCount: 0,
			eventCount: 0,
		});
		return { events: [], alerts: teamAlerts };
	}

	let { inArray, desc } = await import("drizzle-orm");
	let schema = await import("~/db/schema");

	let events = await measure("findEventsForAlerts", async () => {
		return db()
			.select()
			.from(schema.alertEvents)
			.where(inArray(schema.alertEvents.alertId, alertIds))
			.orderBy(desc(schema.alertEvents.sentAt))
			.limit(100);
	});

	// Get monitors for events
	let monitorIds = [...new Set(events.map((e) => e.monitorId))];
	let monitors =
		monitorIds.length > 0
			? await db().query.monitors.findMany({
					where(fields, operators) {
						return operators.inArray(fields.id, monitorIds);
					},
					columns: { id: true, name: true },
				})
			: [];

	let monitorMap = new Map(monitors.map((m) => [m.id, m]));
	let alertMap = new Map(teamAlerts.map((a) => [a.id, a]));

	let enrichedEvents = events.map((event) => ({
		...event,
		alert: alertMap.get(event.alertId),
		monitor: monitorMap.get(event.monitorId),
	}));

	logger().info("alertHistory.loader.complete", {
		route: "alert-history",
		teamId: team().id,
		alertCount: teamAlerts.length,
		eventCount: enrichedEvents.length,
	});

	return { events: enrichedEvents, alerts: teamAlerts };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.alertHistory" });
	let id = useId();

	let columns = [
		{ id: "alert" as const, name: t("table.columns.alert"), align: "left" as const },
		{ id: "monitor" as const, name: t("table.columns.monitor"), align: "left" as const },
		{ id: "eventType" as const, name: t("table.columns.eventType"), align: "center" as const },
		{ id: "status" as const, name: t("table.columns.status"), align: "center" as const },
		{ id: "sentAt" as const, name: t("table.columns.sentAt"), align: "right" as const },
	];

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: t("breadcrumbs.alerts"), href: href("/app/:team/alerts", params) },
					{ label: t("header.title") },
				]}
			/>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{loaderData.events.length === 0 ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<HistoryIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/alerts", params)}>
								<BellIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<div className="flex flex-col gap-4">
						<h2 id={`${id}-history-table`}>{t("table.label")}</h2>

						<Table aria-labelledby={`${id}-history-table`}>
							<Table.Header columns={columns}>
								{(column: (typeof columns)[number]) => (
									<Table.Column align={column.align} isRowHeader={column.id === "alert"}>
										{column.name}
									</Table.Column>
								)}
							</Table.Header>

							<Table.Body items={loaderData.events}>
								{(event: (typeof loaderData.events)[number]) => (
									<AlertEventRow key={event.id} event={event} />
								)}
							</Table.Body>
						</Table>
					</div>
				)}
			</div>
		</>
	);
}

function AlertEventRow(props: { event: Route.ComponentProps["loaderData"]["events"][number] }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.alertHistory.table" });

	let statusColors = {
		sent: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
		skipped_cooldown: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
		failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
	};

	let eventTypeColors = {
		down: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
		up: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
		degraded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
	};

	return (
		<Table.Row>
			<Table.Cell>
				<span className="font-semibold">{props.event.alert?.name ?? t("unknownAlert")}</span>
			</Table.Cell>
			<Table.Cell>{props.event.monitor?.name ?? t("unknownMonitor")}</Table.Cell>
			<Table.Cell className="text-center">
				<span
					className={cn(
						"inline-flex rounded-full px-2 py-1 text-xs font-medium",
						eventTypeColors[props.event.eventType],
					)}
				>
					{t(`eventType.${props.event.eventType}`)}
				</span>
			</Table.Cell>
			<Table.Cell className="text-center">
				<span
					className={cn(
						"inline-flex rounded-full px-2 py-1 text-xs font-medium",
						statusColors[props.event.status],
					)}
				>
					{t(`status.${props.event.status}`)}
				</span>
			</Table.Cell>
			<Table.Cell className="text-right">
				<time dateTime={props.event.sentAt.toISOString()}>
					{new Intl.DateTimeFormat("en-US", {
						dateStyle: "short",
						timeStyle: "medium",
					}).format(props.event.sentAt)}
				</time>
			</Table.Cell>
		</Table.Row>
	);
}
