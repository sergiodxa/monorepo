/**
 * Team dashboard route: the main overview page rendering uptime stats and monitor tables
 * for a team. Its loader reads the selected tab from a cookie and returns streamed promises
 * for HTTP, DNS, TCP, cron and SSL monitor data plus ping usage, which the component reveals
 * via Suspense/Await cards, tabs and a subscription alert. It exists to give teams a single
 * at-a-glance view of all their monitors and consumption.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Alert, Button, LinkButton, Tabs } from "@pkg/ui";
import { PlusIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Await, href, Link, useFetcher, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { dashboardTab } from "~/cookies";
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

import { ConsumedPingsCard } from "./components/consumed-ping-card";
import { CronJobsCard } from "./components/cron-jobs-card";
import { CronJobsTable } from "./components/cron-jobs-table";
import { DnsMonitorsCard } from "./components/dns-monitors-card";
import { DnsMonitorsTable } from "./components/dns-monitors-table";
import { HttpMonitorsCard } from "./components/http-monitors-card";
import { HttpMonitorsTable } from "./components/http-monitors-table";
import { MonitorsTableError } from "./components/monitors-table-error";
import { MonitorsTableSkeleton } from "./components/monitors-table-skeleton";
import { SlowestEndpointCard } from "./components/slowest-endpoint-card";
import { SslMonitorsCard } from "./components/ssl-monitors-card";
import { StatCardError } from "./components/stat-card-error";
import { StatCardSkeleton } from "./components/stat-card-skeleton";
import { TcpMonitorsCard } from "./components/tcp-monitors-card";
import { TcpMonitorsTable } from "./components/tcp-monitors-table";
import { UptimeCard } from "./components/uptime-card";
import {
	getCronJobsData,
	getDnsMonitorsData,
	getHttpMonitorsData,
	getTcpMonitorsData,
	getSslMonitorsData,
} from "./query.server";

type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

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

	return {
		nonce: Date.now(),
		selectedTab,
		consumedPings: measure("getConsumedPings", () =>
			Customer.getUsagePerMonth(team().ownerId, { teamId }, new Date()),
		),
		estimatedPings: measure("estimateConsumedPingsByTeam", () =>
			Monitor.estimateConsumedPingsByTeam(dbInstance, teamId, new Date()),
		),
		httpData: getHttpMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone, t }),
		dnsData: getDnsMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		tcpData: getTcpMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		cronData: getCronJobsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		sslData: getSslMonitorsData({ db: dbInstance, teamId, locale: localeValue, timeZone }),
		hasActiveSubscription: await hasActiveSubscription(),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard",
	});

	let revalidator = useRevalidator();
	let isRevalidating = useSpinDelay(revalidator.state === "loading", {
		minDuration: 200,
		delay: 50,
	});

	let fetcher = useFetcher();

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
					onPress={() => revalidator.revalidate()}
					className="shrink-0 px-2"
					isPending={isRevalidating}
				>
					<RefreshCwIcon aria-hidden className="size-4.5" />
					<span className="max-sm:sr-only">{t("header.action.refresh")}</span>
				</Button>
				<LinkButton
					color="neutral"
					href={href("/app/:team/monitors/new", params)}
					className="shrink-0 px-2"
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

			<div className="flex flex-col gap-4 p-5 lg:gap-10 lg:p-12">
				<Suspense fallback={null}>
					<Await resolve={loaderData.httpData}>
						{(httpData) =>
							httpData.analyticsError ? (
								<Alert color="warning" className="w-full">
									<Alert.Icon>
										<TriangleAlertIcon className="size-4" />
									</Alert.Icon>
									<Alert.Content>
										<Alert.Title>
											{t("alert.analytics.title", { defaultValue: "Analytics data unavailable" })}
										</Alert.Title>
										<Alert.Description>
											{t("alert.analytics.description", {
												defaultValue: httpData.analyticsError,
											})}
										</Alert.Description>
									</Alert.Content>
								</Alert>
							) : null
						}
					</Await>
				</Suspense>
				<div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
					<Suspense key={`pings-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await
							resolve={Promise.all([loaderData.consumedPings, loaderData.estimatedPings])}
							errorElement={<StatCardError />}
						>
							{([consumedPings, estimatedPings]) => (
								<ConsumedPingsCard consumedPings={consumedPings} estimatedPings={estimatedPings} />
							)}
						</Await>
					</Suspense>
					<Suspense key={`uptime-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.httpData} errorElement={<StatCardError />}>
							{(httpData) => <UptimeCard httpData={httpData} />}
						</Await>
					</Suspense>
					<Suspense key={`slowest-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.httpData} errorElement={<StatCardError />}>
							{(httpData) => <SlowestEndpointCard httpData={httpData} />}
						</Await>
					</Suspense>
				</div>

				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
					<Suspense key={`http-card-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.httpData} errorElement={<StatCardError />}>
							{(httpData) => <HttpMonitorsCard httpData={httpData} />}
						</Await>
					</Suspense>
					<Suspense key={`dns-card-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.dnsData} errorElement={<StatCardError />}>
							{(dnsData) => <DnsMonitorsCard dnsData={dnsData} />}
						</Await>
					</Suspense>
					<Suspense key={`tcp-card-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.tcpData} errorElement={<StatCardError />}>
							{(tcpData) => <TcpMonitorsCard tcpData={tcpData} />}
						</Await>
					</Suspense>
					<Suspense key={`cron-card-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.cronData} errorElement={<StatCardError />}>
							{(cronData) => <CronJobsCard cronData={cronData} />}
						</Await>
					</Suspense>
					<Suspense key={`ssl-card-${loaderData.nonce}`} fallback={<StatCardSkeleton />}>
						<Await resolve={loaderData.sslData} errorElement={<StatCardError />}>
							{(sslData) => <SslMonitorsCard sslData={sslData} />}
						</Await>
					</Suspense>
				</div>

				<Tabs defaultSelectedKey={loaderData.selectedTab} onSelectionChange={handleTabChange}>
					<Tabs.List>
						<Tabs.Tab id="http">{t("tabs.http")}</Tabs.Tab>
						<Tabs.Tab id="dns">{t("tabs.dns")}</Tabs.Tab>
						<Tabs.Tab id="tcp">{t("tabs.tcp")}</Tabs.Tab>
						<Tabs.Tab id="cron-jobs">{t("tabs.cronJobs")}</Tabs.Tab>
					</Tabs.List>

					<Tabs.Panels>
						<Tabs.Panel id="http">
							<Suspense key={`http-table-${loaderData.nonce}`} fallback={<MonitorsTableSkeleton />}>
								<Await resolve={loaderData.httpData} errorElement={<MonitorsTableError />}>
									{(httpData) => (
										<HttpMonitorsTable team={params.team} monitors={httpData.httpMonitors} />
									)}
								</Await>
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="dns">
							<Suspense key={`dns-table-${loaderData.nonce}`} fallback={<MonitorsTableSkeleton />}>
								<Await resolve={loaderData.dnsData} errorElement={<MonitorsTableError />}>
									{(dnsData) => (
										<DnsMonitorsTable team={params.team} monitors={dnsData.dnsMonitors} />
									)}
								</Await>
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="tcp">
							<Suspense key={`tcp-table-${loaderData.nonce}`} fallback={<MonitorsTableSkeleton />}>
								<Await resolve={loaderData.tcpData} errorElement={<MonitorsTableError />}>
									{(tcpData) => (
										<TcpMonitorsTable team={params.team} monitors={tcpData.tcpMonitors} />
									)}
								</Await>
							</Suspense>
						</Tabs.Panel>
						<Tabs.Panel id="cron-jobs">
							<Suspense key={`cron-table-${loaderData.nonce}`} fallback={<MonitorsTableSkeleton />}>
								<Await resolve={loaderData.cronData} errorElement={<MonitorsTableError />}>
									{(cronData) => <CronJobsTable team={params.team} cronJobs={cronData.cronJobs} />}
								</Await>
							</Suspense>
						</Tabs.Panel>
					</Tabs.Panels>
				</Tabs>
			</div>
		</>
	);
}
