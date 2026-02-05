import { cn } from "@pkg/cn";
import {
	EllipsisVerticalIcon,
	LoaderIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	RefreshCwIcon,
	TrashIcon,
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
import { Alert } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { LinkButton } from "~/components/ui/link-button";
import { Menu } from "~/components/ui/menu";
import { ColumnAlignment, Table } from "~/components/ui/table";
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
				{loaderData.monitors.length > 0 && (
					<LinkButton
						color="neutral"
						href={href("/app/:team/monitors/new", params)}
						className="flex-shrink-0 px-2"
					>
						<PlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("header.action.create")}</span>
					</LinkButton>
				)}
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert
						intent="warning"
						title={t("alert.subscription.title")}
						description={t("alert.subscription.description")}
						cta={
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						}
					/>
				</div>
			)}

			<div className="p-5 lg:p-12 flex flex-col gap-6 lg:gap-12">
				<div className="grid lg:grid-cols-3 gap-4 lg:gap-8">
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
			align: ColumnAlignment.Left,
		},
		{
			id: "latencyChart" as const,
			name: t("columns.latencyChart"),
			align: ColumnAlignment.Left,
		},
		{
			id: "status" as const,
			name: t("columns.status"),
			align: ColumnAlignment.Left,
		},
		showLastIncident
			? {
					id: "lastIncident" as const,
					name: t("columns.lastIncident"),
					align: ColumnAlignment.Right,
				}
			: null,
		{
			id: "responseTime" as const,
			name: t("columns.responseTime"),
			align: ColumnAlignment.Right,
		},
		{
			id: "actions" as const,
			name: t("columns.actions"),
			align: ColumnAlignment.Right,
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
					className="hover:underline line-clamp-1 inline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>

			<Table.Cell className="text-left w-50">
				<ClientOnly fallback={<div className="w-50 h-6" />}>
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

			<Table.Cell className="text-left w-44">
				{props.monitor.status === "unknown" && (
					<StatusPill status="unknown" label={t("status.unknown")} />
				)}
				{props.monitor.status === "up" && <StatusPill status="up" label={t("status.up")} />}
				{props.monitor.status === "degraded" && (
					<StatusPill status="degraded" label={t("status.degraded")} />
				)}
				{props.monitor.status === "down" && <StatusPill status="down" label={t("status.down")} />}
			</Table.Cell>

			{props.showLastIncident && (
				<Table.Cell className="text-right w-52">{props.monitor.lastIncident}</Table.Cell>
			)}

			<Table.Cell className="text-right w-36">{props.monitor.responseTime}</Table.Cell>

			<Table.Cell className="text-right w-17">
				<Menu.Trigger>
					<Button color="neutral" type="button" className="p-2 ml-auto">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Menu.Popover
						style={{ minWidth: "var(--trigger-width)" }}
						placement="left top"
						className={cn(
							"rounded-lg",
							"border border-neutral-300 shadow shadow-neutral-300",
							"bg-neutral-50 text-neutral-950",
							"dark:border-neutral-700 dark:shadow-neutral-700",
							"dark:bg-neutral-950 dark:text-neutral-50",
						)}
					>
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
								{isPlaying && <LoaderIcon aria-hidden className="size-5 animate-spin ml-auto" />}
							</Menu.Item>

							<Menu.Item isDisabled>
								<PencilIcon className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								isDisabled={isDeleting}
								className={cn(
									"text-danger-500",
									// Hovered
									"data-[hovered]:bg-danger-100 data-[hovered]:text-danger-900",
									"dark:data-[hovered]:bg-danger-800 dark:data-[hovered]:text-danger-50",
									// Focused
									"data-[focused]:bg-danger-100 data-[focused]:text-danger-900",
									"dark:data-[focused]:bg-danger-800 dark:data-[focused]:text-danger-50",
									// Disabled
									"data-[disabled]:text-neutral-400 data-[disabled]:cursor-not-allowed",
									"dark:data-[disabled]:text-neutral-600",
								)}
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
								{isDeleting && <LoaderIcon aria-hidden className="size-5 animate-spin ml-auto" />}
							</Menu.Item>
						</Menu>
					</Menu.Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}

function StatusPill(props: { status: "up" | "down" | "degraded" | "unknown"; label: string }) {
	return (
		<span
			className={cn("leading-none py-1 px-2 rounded-full border", {
				"text-primary-950 bg-primary-100 border-primary-300 dark:text-primary-300 dark:bg-primary-900 dark:border-primary-300":
					props.status === "up",
				"text-warning-950 bg-warning-100 border-warning-300 dark:text-warning-300 dark:bg-warning-900 dark:border-warning-300":
					props.status === "degraded",
				"text-danger-950 bg-danger-100 border-danger-300 dark:text-danger-300 dark:bg-danger-900 dark:border-danger-300":
					props.status === "down",
				"text-neutral-950 bg-neutral-50 border-neutral-300 dark:text-neutral-300 dark:bg-neutral-900 dark:border-neutral-300":
					props.status === "unknown",
			})}
		>
			{props.label}
		</span>
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
