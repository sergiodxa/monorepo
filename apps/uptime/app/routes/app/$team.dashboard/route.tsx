import { cn } from "@pkg/cn";
import { Alert, Badge, Button, LinkButton, Menu, Popover, Table } from "@pkg/ui";
import {
	EllipsisVerticalIcon,
	LoaderIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	RefreshCwIcon,
	TrashIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { href, Link, useFetcher, useRevalidator } from "react-router";
import { Line, LineChart } from "recharts";
import { ClientOnly } from "remix-utils/client-only";
import { useGlobalPendingState } from "remix-utils/use-global-navigation-state";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { getContext } from "~/middleware/context-storage";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { i18next as getI18next, locale } from "~/middleware/i18next";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/route";

import { getDashboardDataByTeamId } from "./query.server";

export async function loader({ request }: Route.LoaderArgs) {
	let [{ monitorsCount, uptime, slowestEndpoint, monitors }, consumedPings, estimatedPings] =
		await Promise.all([
			measure("getDashboardDataByTeamId", () => {
				return getDashboardDataByTeamId({
					db: db(),
					teamId: team().id,
					locale: locale(),
					timeZone: getHints(request).timeZone,
					t: getI18next(getContext()).getFixedT(locale(), "translation", "page.dashboard.table"),
				});
			}),
			measure("getConsumedPings", async () => {
				return Customer.getUsagePerMonth(team().ownerId, { teamId: team().id }, new Date());
			}),
			measure("estimateConsumedPingsByTeam", () => {
				return Monitor.estimateConsumedPingsByTeam(db(), team().id, new Date());
			}),
		]);

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		consumedPings,
		estimatedPings,
		monitorsCount,
		uptime,
		slowestEndpoint,
		monitors,
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t, i18n } = useTranslation("translation", {
		keyPrefix: "page.dashboard",
	});

	let revalidator = useRevalidator();
	let isRevalidating = useSpinDelay(revalidator.state === "loading", {
		minDuration: 100,
		delay: 50,
	});

	useRevalidateOnDocumentVisible();

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<Button
					color="neutral"
					type="button"
					onPress={() => revalidator.revalidate()}
					className="flex-shrink-0 px-2"
					isPending={isRevalidating}
				>
					<RefreshCwIcon
						aria-hidden
						className={cn("size-4.5", {
							"animate-spin": isRevalidating,
						})}
					/>
					<span className="max-sm:sr-only">{t("header.action.refresh")}</span>
				</Button>
				<LinkButton
					color="neutral"
					href={href("/app/:team/monitors/new", params)}
					className="flex-shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
				</LinkButton>
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
						<Alert.Icon>
							<TriangleAlertIcon className="size-5" />
						</Alert.Icon>
						<Alert.Content>
							<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
							<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
						</Alert.Content>
						<Alert.Action>
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-6 p-5 lg:gap-12 lg:p-12">
				<div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
					<StatCard
						label={t("stats.monitors.label")}
						value={
							<Trans
								t={t}
								i18nKey="stats.monitors.value"
								values={{
									consumed: loaderData.consumedPings.toLocaleString(i18n.language, {
										minimumFractionDigits: 0,
										maximumFractionDigits: 0,
									}),
								}}
								components={{
									small: <small className="text-md" />,
								}}
							/>
						}
						description={t("stats.monitors.description", {
							estimated: loaderData.estimatedPings.toLocaleString(i18n.language, {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							}),
						})}
					/>
					{loaderData.slowestEndpoint ? (
						<StatCard
							label={
								<Trans
									t={t}
									i18nKey="stats.slowestEndpoint.label.default"
									values={{ name: loaderData.slowestEndpoint.monitorName }}
									components={{
										em: <em className="font-medium" />,
									}}
								/>
							}
							value={
								loaderData.slowestEndpoint.responseTimeMs
									? loaderData.slowestEndpoint.responseTimeMs.toLocaleString(i18n.language, {
											style: "unit",
											unit: "millisecond",
											minimumFractionDigits: 0,
											maximumFractionDigits: 0,
										})
									: null
							}
							description={t("stats.slowestEndpoint.description")}
						/>
					) : (
						<StatCard
							label={t("stats.slowestEndpoint.label.noData")}
							value={t("stats.slowestEndpoint.value.noData")}
							description={t("stats.slowestEndpoint.description")}
						/>
					)}

					<StatCard
						label={t("stats.uptime.label")}
						value={loaderData.uptime.toLocaleString(i18n.language, {
							style: "percent",
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						})}
						description={t("stats.uptime.description")}
					/>
				</div>

				<MonitorsTable team={params.team} monitors={loaderData.monitors} />
			</div>
		</>
	);
}

function MonitorsTable(props: {
	team: string;
	monitors: Route.ComponentProps["loaderData"]["monitors"];
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard.table",
	});

	let showLastIncident = props.monitors.some((m) => m.lastIncident);

	let columns = [
		{
			id: "name" as const,
			name: t("columns.name"),
			align: "left" as const,
		},
		{
			id: "latencyChart" as const,
			name: t("columns.latencyChart"),
			align: "left" as const,
		},
		{
			id: "status" as const,
			name: t("columns.status"),
			align: "left" as const,
		},
		showLastIncident
			? {
					id: "lastIncident" as const,
					name: t("columns.lastIncident"),
					align: "right" as const,
				}
			: null,
		{
			id: "responseTime" as const,
			name: t("columns.responseTime"),
			align: "right" as const,
		},
		{
			id: "actions" as const,
			name: t("columns.actions"),
			align: "right" as const,
		},
	].filter(Boolean);

	return (
		<div className="w-full overflow-x-auto">
			<Table aria-label={t("label")} className="min-w-full">
				<Table.Header columns={columns}>
					{(column) => {
						return (
							<Table.Column align={column.align} isRowHeader={column.id === "name"}>
								<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
							</Table.Column>
						);
					}}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => (
						<MonitorTableRow
							team={props.team}
							monitor={monitor}
							showLastIncident={showLastIncident}
						/>
					)}
				</Table.Body>
			</Table>
		</div>
	);
}

function MonitorTableRow(props: {
	monitor: Route.ComponentProps["loaderData"]["monitors"][number];
	team: string;
	showLastIncident?: boolean;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard.table",
	});

	let playMonitorFetcher = useFetcher();
	let isPlaying = useSpinDelay(playMonitorFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let deleteMonitorFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteMonitorFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	return (
		<Table.Row>
			<Table.Cell className="text-left">
				<Link
					to={href("/app/:team/monitors/:monitorId", {
						team: props.team,
						monitorId: props.monitor.id,
					})}
					className="line-clamp-1 inline hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>

			<Table.Cell className="w-50 text-left">
				<ClientOnly fallback={<div className="h-6 w-50" />}>
					{() => (
						<LineChart
							width={200}
							height={24}
							data={props.monitor.latency}
							margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
						>
							<Line type="monotone" dataKey="latency" stroke="currentColor" dot={false} />
						</LineChart>
					)}
				</ClientOnly>
			</Table.Cell>

			<Table.Cell className="w-44 text-left">
				{props.monitor.status === "unknown" && (
					<Badge color="neutral" variant="outline">
						{t("status.unknown")}
					</Badge>
				)}
				{props.monitor.status === "up" && (
					<Badge color="primary" variant="outline">
						{t("status.up")}
					</Badge>
				)}
				{props.monitor.status === "degraded" && (
					<Badge color="warning" variant="outline">
						{t("status.degraded")}
					</Badge>
				)}
				{props.monitor.status === "down" && (
					<Badge color="danger" variant="outline">
						{t("status.down")}
					</Badge>
				)}
			</Table.Cell>

			{props.showLastIncident && (
				<Table.Cell className="w-52 text-right">{props.monitor.lastIncident}</Table.Cell>
			)}

			<Table.Cell className="w-36 text-right">{props.monitor.responseTime}</Table.Cell>

			<Table.Cell className="w-17 text-right">
				<Menu.Trigger>
					<Button color="neutral" type="button" className="ml-auto p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								isDisabled={isPlaying}
								onAction={() => {
									playMonitorFetcher.submit(
										{ monitorId: props.monitor.id },
										{
											method: "POST",
											action: href("/actions/:team/play-monitor", {
												team: props.team,
											}),
										},
									);
								}}
							>
								<PlayIcon className="size-5" />
								<span>{t("actions.play")}</span>
								{isPlaying && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>

							<Menu.Item isDisabled>
								<PencilIcon className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={() => {
									if (
										window.confirm(
											t("confirmation.deleteMonitor", {
												name: props.monitor.name,
											}),
										)
									) {
										deleteMonitorFetcher.submit(
											{ monitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-monitor", {
													team: props.team,
												}),
											},
										);
									}
								}}
							>
								<TrashIcon className="size-5" />
								<span>{t("actions.delete")}</span>
								{isDeleting && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}

function useRevalidateOnDocumentVisible() {
	let state = useGlobalPendingState();
	let stateRef = useRef(state);

	useEffect(() => {
		stateRef.current = state;
	}, [state]);

	let { revalidate } = useRevalidator();
	let previousVisibilityState = useRef<DocumentVisibilityState>("visible");

	useEffect(() => {
		window.addEventListener("visibilitychange", handler);
		return () => void window.removeEventListener("visibilitychange", handler);

		function handler() {
			let isVisible = document.visibilityState === "visible";
			let wasHidden = previousVisibilityState.current === "hidden";
			let isIdle = stateRef.current === "idle";
			if (isVisible && wasHidden && isIdle) revalidate();
			previousVisibilityState.current = document.visibilityState;
		}
	}, [revalidate]);
}
