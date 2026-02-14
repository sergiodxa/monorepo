import { cn } from "@pkg/cn";
import {
	Alert,
	Badge,
	Button,
	Card,
	confirm,
	Empty,
	LinkButton,
	Menu,
	Popover,
	Skeleton,
	Table,
	Tabs,
} from "@pkg/ui";
import {
	ActivityIcon,
	ClockIcon,
	EllipsisVerticalIcon,
	GlobeIcon,
	LoaderIcon,
	NetworkIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	RefreshCwIcon,
	TrashIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { Suspense, use, useEffect, useRef } from "react";
import { Trans, useTranslation } from "react-i18next";
import { href, Link, useFetcher, useRevalidator } from "react-router";
import { Line, LineChart } from "recharts";
import { ClientOnly } from "remix-utils/client-only";
import { useGlobalPendingState } from "remix-utils/use-global-navigation-state";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { dashboardTab } from "~/cookies";
import { useTeam } from "~/hooks/use-team";
import { getContext } from "~/middleware/context-storage";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { i18next as getI18next, locale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/route";

import {
	getCronJobsData,
	getDnsMonitorsData,
	getHttpMonitorsData,
	getTcpMonitorsData,
} from "./query.server";

type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<Skeleton className="h-6 w-24" />
				<aside className="ml-auto flex items-center gap-2">
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-20" />
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-32" />
				</aside>
			</header>

			<div className="flex flex-col gap-6 p-5 lg:gap-12 lg:p-12">
				{/* Row 1 - Overview (3 cards) */}
				<div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
					<StatCardSkeleton />
					<StatCardSkeleton />
					<StatCardSkeleton />
				</div>

				{/* Row 2 - Monitor Breakdown (4 cards) */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
					<StatCardSkeleton />
					<StatCardSkeleton />
					<StatCardSkeleton />
					<StatCardSkeleton />
				</div>

				{/* Tabs skeleton */}
				<div className="flex gap-2 border-b border-neutral-200 pb-2 dark:border-neutral-800">
					<Skeleton className="h-8 w-20 rounded-lg" />
					<Skeleton className="h-8 w-20 rounded-lg" />
					<Skeleton className="h-8 w-20 rounded-lg" />
					<Skeleton className="h-8 w-24 rounded-lg" />
				</div>

				<MonitorsTableSkeleton />
			</div>
		</>
	);
}

function StatCardSkeleton() {
	return (
		<Card>
			<Card.Header className="pb-2">
				<Skeleton className="h-4 w-24" />
			</Card.Header>
			<Card.Content className="pt-0">
				<Skeleton className="mb-2 h-8 w-20" />
				<Skeleton className="h-3 w-40" />
			</Card.Content>
		</Card>
	);
}

function MonitorsTableSkeleton() {
	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label="Loading monitors">
				<Table.Header>
					<Table.Column isRowHeader>
						<Skeleton className="h-4 w-16" />
					</Table.Column>
					<Table.Column>
						<Skeleton className="h-4 w-20 max-lg:hidden" />
					</Table.Column>
					<Table.Column>
						<Skeleton className="h-4 w-12" />
					</Table.Column>
					<Table.Column align="right">
						<Skeleton className="ml-auto h-4 w-24 max-sm:hidden" />
					</Table.Column>
					<Table.Column align="right">
						<span className="sr-only">Actions</span>
					</Table.Column>
				</Table.Header>

				<Table.Body items={[{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }]}>
					{(item) => (
						<Table.Row key={item.id}>
							<Table.Cell>
								<Skeleton className="h-4 w-32" />
							</Table.Cell>
							<Table.Cell className="w-50 max-lg:hidden">
								<Skeleton className="h-6 w-50" />
							</Table.Cell>
							<Table.Cell className="w-44">
								<Skeleton className="h-6 w-16 rounded-full" />
							</Table.Cell>
							<Table.Cell className="w-36 text-right max-sm:hidden">
								<Skeleton className="ml-auto h-4 w-16" />
							</Table.Cell>
							<Table.Cell className="w-17 text-right">
								<Skeleton className="ml-auto h-10 w-10 rounded-lg" />
							</Table.Cell>
						</Table.Row>
					)}
				</Table.Body>
			</Table>
		</div>
	);
}

export async function loader({ request }: Route.LoaderArgs) {
	logger().info("dashboard.loader.start", {
		route: "dashboard",
		teamId: team().id,
	});

	// Read selected tab from cookie
	let cookieValue = await dashboardTab.parse(request.headers.get("Cookie"));
	let selectedTab: DashboardTab =
		cookieValue && ["http", "dns", "tcp", "cron-jobs"].includes(cookieValue)
			? (cookieValue as DashboardTab)
			: "http";

	let dbInstance = db();
	let teamId = team().id;
	let localeValue = locale();
	let timeZone = getHints(request).timeZone;
	let t = getI18next(getContext()).getFixedT(localeValue, "translation", "page.dashboard.table");

	// Return promises for streaming - don't await non-critical data
	// Critical: hasActiveSubscription and selectedTab are awaited
	// Non-critical: all monitor data streams in
	return {
		hasActiveSubscription: await hasActiveSubscription(),
		selectedTab,
		// Overview cards - stream independently
		consumedPings: measure("getConsumedPings", () =>
			Customer.getUsagePerMonth(team().ownerId, { teamId }, new Date()),
		),
		estimatedPings: measure("estimateConsumedPingsByTeam", () =>
			Monitor.estimateConsumedPingsByTeam(dbInstance, teamId, new Date()),
		),
		// HTTP monitors data - streams as a unit
		httpData: measure("getHttpMonitorsData", () =>
			getHttpMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone, t }),
		),
		// DNS monitors data - streams as a unit
		dnsData: measure("getDnsMonitorsData", () =>
			getDnsMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		),
		// TCP monitors data - streams as a unit
		tcpData: measure("getTcpMonitorsData", () =>
			getTcpMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		),
		// Cron jobs data - streams as a unit
		cronData: measure("getCronJobsData", () =>
			getCronJobsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard",
	});

	let revalidator = useRevalidator();
	let isRevalidating = useSpinDelay(revalidator.state === "loading", {
		minDuration: 100,
		delay: 50,
	});

	let fetcher = useFetcher();

	useRevalidateOnDocumentVisible();

	function handleTabChange(key: React.Key) {
		fetcher.submit(
			{ tab: key.toString() },
			{
				method: "POST",
				action: href("/actions/:team/set-dashboard-tab", { team: params.team }),
			},
		);
	}

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
					<RefreshCwIcon aria-hidden className="size-4.5" />
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
				{/* Row 1 - Overview (3 cards) */}
				<div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
					<Suspense fallback={<StatCardSkeleton />}>
						<ConsumedPingsCard
							consumedPingsPromise={loaderData.consumedPings}
							estimatedPingsPromise={loaderData.estimatedPings}
						/>
					</Suspense>
					<Suspense fallback={<StatCardSkeleton />}>
						<UptimeCard httpDataPromise={loaderData.httpData} />
					</Suspense>
					<Suspense fallback={<StatCardSkeleton />}>
						<SlowestEndpointCard httpDataPromise={loaderData.httpData} />
					</Suspense>
				</div>

				{/* Row 2 - Monitor Breakdown (4 cards) */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
					<Suspense fallback={<StatCardSkeleton />}>
						<HttpMonitorsCard httpDataPromise={loaderData.httpData} />
					</Suspense>
					<Suspense fallback={<StatCardSkeleton />}>
						<DnsMonitorsCard dnsDataPromise={loaderData.dnsData} />
					</Suspense>
					<Suspense fallback={<StatCardSkeleton />}>
						<TcpMonitorsCard tcpDataPromise={loaderData.tcpData} />
					</Suspense>
					<Suspense fallback={<StatCardSkeleton />}>
						<CronJobsCard cronDataPromise={loaderData.cronData} />
					</Suspense>
				</div>

				{/* Tabs */}
				<Tabs defaultSelectedKey={loaderData.selectedTab} onSelectionChange={handleTabChange}>
					<Tabs.List>
						<Tabs.Tab id="http">{t("tabs.http")}</Tabs.Tab>
						<Tabs.Tab id="dns">{t("tabs.dns")}</Tabs.Tab>
						<Tabs.Tab id="tcp">{t("tabs.tcp")}</Tabs.Tab>
						<Tabs.Tab id="cron-jobs">{t("tabs.cronJobs")}</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panels>
						<Tabs.Panel id="http">
							<Suspense fallback={<MonitorsTableSkeleton />}>
								<HttpMonitorsPanel team={params.team} httpDataPromise={loaderData.httpData} />
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="dns">
							<Suspense fallback={<MonitorsTableSkeleton />}>
								<DnsMonitorsPanel team={params.team} dnsDataPromise={loaderData.dnsData} />
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="tcp">
							<Suspense fallback={<MonitorsTableSkeleton />}>
								<TcpMonitorsPanel team={params.team} tcpDataPromise={loaderData.tcpData} />
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="cron-jobs">
							<Suspense fallback={<MonitorsTableSkeleton />}>
								<CronJobsPanel team={params.team} cronDataPromise={loaderData.cronData} />
							</Suspense>
						</Tabs.Panel>
					</Tabs.Panels>
				</Tabs>
			</div>
		</>
	);
}

// Streaming card components that use React.use() to suspend until data is ready

function ConsumedPingsCard(props: {
	consumedPingsPromise: Promise<number>;
	estimatedPingsPromise: Promise<number>;
}) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let consumedPings = use(props.consumedPingsPromise);
	let estimatedPings = use(props.estimatedPingsPromise);

	return (
		<StatCard
			label={t("stats.monitors.label")}
			value={
				<Trans
					t={t}
					i18nKey="stats.monitors.value"
					values={{
						consumed: consumedPings.toLocaleString(i18n.language, {
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
				estimated: estimatedPings.toLocaleString(i18n.language, {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			})}
		/>
	);
}

function UptimeCard(props: {
	httpDataPromise: Promise<Awaited<ReturnType<typeof getHttpMonitorsData>>>;
}) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let httpData = use(props.httpDataPromise);

	return (
		<StatCard
			label={t("stats.uptime.label")}
			value={httpData.uptime.toLocaleString(i18n.language, {
				style: "percent",
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			})}
			description={t("stats.uptime.description")}
		/>
	);
}

function SlowestEndpointCard(props: {
	httpDataPromise: Promise<Awaited<ReturnType<typeof getHttpMonitorsData>>>;
}) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let httpData = use(props.httpDataPromise);

	if (httpData.slowestEndpoint) {
		return (
			<StatCard
				label={
					<Trans
						t={t}
						i18nKey="stats.slowestEndpoint.label.default"
						values={{ name: httpData.slowestEndpoint.monitorName }}
						components={{
							em: <em className="font-medium" />,
						}}
					/>
				}
				value={
					httpData.slowestEndpoint.responseTimeMs
						? httpData.slowestEndpoint.responseTimeMs.toLocaleString(i18n.language, {
								style: "unit",
								unit: "millisecond",
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})
						: null
				}
				description={t("stats.slowestEndpoint.description")}
			/>
		);
	}

	return (
		<StatCard
			label={t("stats.slowestEndpoint.label.noData")}
			value={t("stats.slowestEndpoint.value.noData")}
			description={t("stats.slowestEndpoint.description")}
		/>
	);
}

function HttpMonitorsCard(props: {
	httpDataPromise: Promise<Awaited<ReturnType<typeof getHttpMonitorsData>>>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let httpData = use(props.httpDataPromise);

	return (
		<StatCard
			label={t("stats.httpMonitors.label")}
			value={httpData.httpMonitorsCount}
			description={t("stats.httpMonitors.description", {
				up: httpData.httpMonitorsUp,
				down: httpData.httpMonitorsDown,
			})}
		/>
	);
}

function DnsMonitorsCard(props: {
	dnsDataPromise: Promise<Awaited<ReturnType<typeof getDnsMonitorsData>>>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let dnsData = use(props.dnsDataPromise);

	return (
		<StatCard
			label={t("stats.dnsMonitors.label")}
			value={dnsData.dnsMonitorsCount}
			description={t("stats.dnsMonitors.description", {
				ok: dnsData.dnsMonitorsOk,
				changed: dnsData.dnsMonitorsChanged,
				error: dnsData.dnsMonitorsError,
			})}
		/>
	);
}

function TcpMonitorsCard(props: {
	tcpDataPromise: Promise<Awaited<ReturnType<typeof getTcpMonitorsData>>>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let tcpData = use(props.tcpDataPromise);

	return (
		<StatCard
			label={t("stats.tcpMonitors.label")}
			value={tcpData.tcpMonitorsCount}
			description={t("stats.tcpMonitors.description", {
				up: tcpData.tcpMonitorsUp,
				down: tcpData.tcpMonitorsDown,
			})}
		/>
	);
}

function CronJobsCard(props: {
	cronDataPromise: Promise<Awaited<ReturnType<typeof getCronJobsData>>>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });
	let cronData = use(props.cronDataPromise);

	return (
		<StatCard
			label={t("stats.cronJobs.label")}
			value={cronData.cronJobsCount}
			description={t("stats.cronJobs.description", {
				healthy: cronData.cronJobsHealthy,
				late: cronData.cronJobsLate,
				missed: cronData.cronJobsMissed,
			})}
		/>
	);
}

// Streaming panel components for tabs

function HttpMonitorsPanel(props: {
	team: string;
	httpDataPromise: Promise<Awaited<ReturnType<typeof getHttpMonitorsData>>>;
}) {
	let httpData = use(props.httpDataPromise);
	return <HttpMonitorsTable team={props.team} monitors={httpData.httpMonitors} />;
}

function DnsMonitorsPanel(props: {
	team: string;
	dnsDataPromise: Promise<Awaited<ReturnType<typeof getDnsMonitorsData>>>;
}) {
	let dnsData = use(props.dnsDataPromise);
	return <DnsMonitorsTable team={props.team} monitors={dnsData.dnsMonitors} />;
}

function TcpMonitorsPanel(props: {
	team: string;
	tcpDataPromise: Promise<Awaited<ReturnType<typeof getTcpMonitorsData>>>;
}) {
	let tcpData = use(props.tcpDataPromise);
	return <TcpMonitorsTable team={props.team} monitors={tcpData.tcpMonitors} />;
}

function CronJobsPanel(props: {
	team: string;
	cronDataPromise: Promise<Awaited<ReturnType<typeof getCronJobsData>>>;
}) {
	let cronData = use(props.cronDataPromise);
	return <CronJobsTable team={props.team} cronJobs={cronData.cronJobs} />;
}

// HTTP Monitors Table
function HttpMonitorsTable(props: {
	team: string;
	monitors: Awaited<ReturnType<typeof getHttpMonitorsData>>["httpMonitors"];
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard.table",
	});
	let { t: tPage } = useTranslation("translation", {
		keyPrefix: "page.dashboard",
	});

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<ActivityIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/monitors/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

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
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")} className="min-w-full">
				<Table.Header columns={columns}>
					{(column) => {
						return (
							<Table.Column align={column.align} isRowHeader={column.id === "name"}>
								<span
									className={cn({
										"sr-only": column.id === "actions",
										"max-lg:hidden": column.id === "latencyChart",
										"max-md:hidden": column.id === "lastIncident",
										"max-sm:hidden": column.id === "responseTime",
									})}
								>
									{column.name}
								</span>
							</Table.Column>
						);
					}}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => (
						<HttpMonitorTableRow
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

function HttpMonitorTableRow(props: {
	monitor: Awaited<ReturnType<typeof getHttpMonitorsData>>["httpMonitors"][number];
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

			<Table.Cell className="w-50 text-left max-lg:hidden">
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

			<Table.Cell className="text-left sm:w-44">
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
				<Table.Cell className="w-52 text-right max-md:hidden">
					{props.monitor.lastIncident}
				</Table.Cell>
			)}

			<Table.Cell className="w-36 text-right max-sm:hidden">
				{props.monitor.responseTime}
			</Table.Cell>

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

							<Menu.Item
								href={href("/app/:team/monitors/:monitorId/edit", {
									team: props.team,
									monitorId: props.monitor.id,
								})}
							>
								<PencilIcon className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("confirmation.deleteMonitor", {
											name: props.monitor.name,
										}),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
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

// DNS Monitors Table
function DnsMonitorsTable(props: {
	team: string;
	monitors: Awaited<ReturnType<typeof getDnsMonitorsData>>["dnsMonitors"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.dnsMonitors" });

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<GlobeIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/dns/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "domain" as const, name: t("columns.domain"), align: "left" as const },
		{ id: "recordType" as const, name: t("columns.recordType"), align: "center" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "lastChecked" as const, name: t("columns.lastChecked"), align: "left" as const },
		{ id: "actions" as const, name: t("columns.actions"), align: "center" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => <DnsMonitorTableRow key={monitor.id} team={props.team} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function DnsMonitorTableRow(props: {
	team: string;
	monitor: Awaited<ReturnType<typeof getDnsMonitorsData>>["dnsMonitors"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "warning" | "danger" | "neutral" =
		props.monitor.lastStatus === "ok"
			? "primary"
			: props.monitor.lastStatus === "changed"
				? "warning"
				: props.monitor.lastStatus === "error"
					? "danger"
					: "neutral";

	let statusText =
		props.monitor.lastStatus === "ok"
			? "OK"
			: props.monitor.lastStatus === "changed"
				? "Changed"
				: props.monitor.lastStatus === "error"
					? "Error"
					: "Unknown";

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/dns/:dnsMonitorId", {
						team: props.team,
						dnsMonitorId: props.monitor.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<code className="text-sm">{props.monitor.domain}</code>
			</Table.Cell>
			<Table.Cell className="w-20 text-center">
				<Badge color="neutral" variant="outline">
					{props.monitor.recordType}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{statusText}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.monitor.lastCheckedAt ?? (
					<span className="text-neutral-500">{t("neverChecked")}</span>
				)}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/app/:team/dns/:dnsMonitorId", {
									team: props.team,
									dnsMonitorId: props.monitor.id,
								})}
							>
								<GlobeIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/dns/:dnsMonitorId/edit", {
									team: props.team,
									dnsMonitorId: props.monitor.id,
								})}
							>
								<PencilIcon aria-hidden className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(t("confirmation.delete", props.monitor), {
										confirmLabel: t("actions.delete"),
										color: "danger",
									});
									if (confirmed) {
										deleteFetcher.submit(
											{ dnsMonitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-dns-monitor", {
													team: team.slug,
												}),
											},
										);
									}
								}}
							>
								<TrashIcon aria-hidden className="size-5" />
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

// TCP Monitors Table
function TcpMonitorsTable(props: {
	team: string;
	monitors: Awaited<ReturnType<typeof getTcpMonitorsData>>["tcpMonitors"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.tcpMonitors" });

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<NetworkIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/tcp/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "endpoint" as const, name: t("columns.endpoint"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "responseTime" as const, name: t("columns.responseTime"), align: "right" as const },
		{ id: "lastChecked" as const, name: t("columns.lastChecked"), align: "left" as const },
		{ id: "actions" as const, name: t("columns.actions"), align: "center" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => <TcpMonitorTableRow key={monitor.id} team={props.team} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function TcpMonitorTableRow(props: {
	team: string;
	monitor: Awaited<ReturnType<typeof getTcpMonitorsData>>["tcpMonitors"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "danger" | "neutral" =
		props.monitor.lastStatus === "up"
			? "primary"
			: props.monitor.lastStatus === "down" || props.monitor.lastStatus === "timeout"
				? "danger"
				: "neutral";

	let statusText =
		props.monitor.lastStatus === "up"
			? t("status.up")
			: props.monitor.lastStatus === "down"
				? t("status.down")
				: props.monitor.lastStatus === "timeout"
					? t("status.timeout")
					: t("status.pending");

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/tcp/:tcpMonitorId", {
						team: props.team,
						tcpMonitorId: props.monitor.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<code className="rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800">
					{props.monitor.host}:{props.monitor.port}
				</code>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{statusText}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-32 text-right">
				{props.monitor.lastResponseTimeMs ? `${props.monitor.lastResponseTimeMs}ms` : "-"}
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.monitor.lastCheckedAt ?? <span className="text-neutral-500">Never</span>}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.edit")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/app/:team/tcp/:tcpMonitorId", {
									team: props.team,
									tcpMonitorId: props.monitor.id,
								})}
							>
								<NetworkIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/tcp/:tcpMonitorId/edit", {
									team: props.team,
									tcpMonitorId: props.monitor.id,
								})}
							>
								<PencilIcon aria-hidden className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("actions.confirmation.delete", { name: props.monitor.name }),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ tcpMonitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-tcp-monitor", { team: team.slug }),
											},
										);
									}
								}}
							>
								<TrashIcon aria-hidden className="size-5" />
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

// Cron Jobs Table
function CronJobsTable(props: {
	team: string;
	cronJobs: Awaited<ReturnType<typeof getCronJobsData>>["cronJobs"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.cronJobs" });

	if (props.cronJobs.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<ClockIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/cron-jobs/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "schedule" as const, name: t("columns.schedule"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "lastPing" as const, name: t("columns.lastPing"), align: "left" as const },
		{ id: "nextExpected" as const, name: t("columns.nextExpected"), align: "left" as const },
		{ id: "actions" as const, name: t("columns.actions"), align: "center" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.cronJobs}>
					{(cronJob) => <CronJobTableRow key={cronJob.id} team={props.team} cronJob={cronJob} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function CronJobTableRow(props: {
	team: string;
	cronJob: Awaited<ReturnType<typeof getCronJobsData>>["cronJobs"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "warning" | "danger" | "neutral" =
		props.cronJob.status === "healthy"
			? "primary"
			: props.cronJob.status === "late"
				? "warning"
				: props.cronJob.status === "missed"
					? "danger"
					: "neutral";

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/cron-jobs/:cronJobId", {
						team: props.team,
						cronJobId: props.cronJob.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.cronJob.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<span className="text-sm">{props.cronJob.schedule}</span>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{t(`status.${props.cronJob.status}`)}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.cronJob.lastPingAt ?? <span className="text-neutral-500">Never</span>}
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.cronJob.nextExpectedAt ?? <span className="text-neutral-500">-</span>}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.edit")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/app/:team/cron-jobs/:cronJobId", {
									team: props.team,
									cronJobId: props.cronJob.id,
								})}
							>
								<ClockIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/cron-jobs/:cronJobId/edit", {
									team: props.team,
									cronJobId: props.cronJob.id,
								})}
							>
								<PencilIcon aria-hidden className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("actions.confirmation.delete", { name: props.cronJob.name }),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ cronJobId: props.cronJob.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-cron-job", { team: team.slug }),
											},
										);
									}
								}}
							>
								<TrashIcon aria-hidden className="size-5" />
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
