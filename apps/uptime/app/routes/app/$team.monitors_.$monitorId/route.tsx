import { cn } from "@pkg/cn";
import { Alert, Button, Card, LinkButton, Skeleton } from "@pkg/ui";
import { subDays } from "date-fns";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { href, Link, redirect, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { ActionButton } from "~/components/action-button";
import { AppHeader } from "~/components/app-header";
import { Heatmap } from "~/components/heatmap";
import { StatCard } from "~/components/stat-card";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { locale } from "~/middleware/i18next";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";
import daysOfYear from "~/utils/days-of-year";
import groupDatesPerWeek from "~/utils/group-dates-per-week";

import type { Route } from "./+types/route";

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<div className="flex flex-col justify-center gap-1">
					<Skeleton className="h-3 w-32" />
					<Skeleton className="h-4 w-40" />
				</div>
				<aside className="ml-auto flex items-center gap-2">
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-28" />
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-20" />
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-20" />
				</aside>
			</header>

			<div className="flex flex-col gap-6 p-5 lg:gap-12 lg:p-12">
				<div className="grid gap-4 lg:grid-cols-3 lg:gap-8">
					<StatCardSkeleton />
					<StatCardSkeleton />
					<StatCardSkeleton />
				</div>

				<HeatmapSkeleton />
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

function HeatmapSkeleton() {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex justify-between">
				<Skeleton className="h-4 w-16" />
				<Skeleton className="h-4 w-16" />
			</div>
			<Skeleton className="h-40 w-full rounded-lg" />
		</div>
	);
}

export async function loader({ params }: Route.LoaderArgs) {
	let dates = daysOfYear(new Date());
	let weeks = groupDatesPerWeek(dates);

	let [monitor, results, estimated, slowestResult, consumed] = await Promise.all([
		measure("findMonitorById", () => {
			return db().query.monitors.findFirst({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.id, params.monitorId),
						operators.eq(fields.teamId, team().id),
					);
				},
			});
		}),
		measure("Monitor.getResultsById", () => {
			return Monitor.getResultsById(db(), params.monitorId);
		}),
		measure("Monitor.estimateConsumedPingsByMonitor", () => {
			return Monitor.estimateConsumedPingsByMonitor(db(), params.monitorId, new Date());
		}),
		measure("findSlowestResult", async () => {
			let result = await db().query.monitorResults.findFirst({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.monitorId, params.monitorId),
						operators.isNotNull(fields.responseTimeMs),
						operators.gte(fields.completedAt, subDays(new Date(), 1)),
					);
				},
				orderBy(fields, operators) {
					return operators.desc(fields.responseTimeMs);
				},
			});

			return result?.responseTimeMs ?? 0;
		}),
		measure("findMonitorUsagePerMonth", () => {
			return Customer.getUsagePerMonth(team().ownerId, { monitorId: params.monitorId }, new Date());
		}),
	]);

	if (!monitor) return redirect(href("/app/:team/dashboard", params));

	return {
		stats: {
			usage: {
				consumed,
				estimated: estimated.toLocaleString(locale(), {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			},

			slowestResult: slowestResult.toLocaleString(locale(), {
				style: "unit",
				unit: "millisecond",
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			}),

			uptime: {
				value: (1).toLocaleString(locale(), {
					style: "percent",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			},
		},
		hasActiveSubscription: await hasActiveSubscription(),
		monitor: { id: monitor.id, name: monitor.name },
		results,
		weeks,
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.monitor" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	let revalidator = useRevalidator();
	let isRevalidating = useSpinDelay(revalidator.state === "loading", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<>
			<AppHeader
				heading={loaderData.monitor.name}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: loaderData.monitor.name },
				]}
			>
				<ActionButton
					id={loaderData.monitor.id}
					intent="play"
					label={t("header.action.play")}
					color="neutral"
					action={href("/actions/:team/play-monitor", params)}
				>
					<PlayIcon aria-hidden className="size-4.5" />
					<span className="max-sm:sr-only">{t("header.action.play")}</span>
				</ActionButton>

				<LinkButton
					color="neutral"
					href={href("/app/:team/monitors/:monitorId/edit", {
						team: params.team,
						monitorId: loaderData.monitor.id,
					})}
					className="flex-shrink-0 px-2"
				>
					<PencilIcon aria-hidden className="size-4.5" />
					<span className="max-sm:sr-only">{t("header.action.edit")}</span>
				</LinkButton>

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
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
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

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<div className="grid gap-4 md:grid-cols-3 md:gap-8">
					<StatCard
						label={t("stats.monitors.label")}
						value={
							<Trans
								t={t}
								i18nKey="stats.monitors.value"
								values={{ consumed: loaderData.stats.usage.consumed }}
								components={{
									small: <small className="text-md" />,
								}}
							/>
						}
						description={t("stats.monitors.description", {
							estimated: loaderData.stats.usage.estimated,
						})}
					/>

					<StatCard
						label={t("stats.slowestResult.label")}
						value={loaderData.stats.slowestResult}
						description={t("stats.slowestResult.description")}
					/>

					<StatCard
						label={t("stats.uptime.label")}
						value={loaderData.stats.uptime.value}
						description={t("stats.uptime.description")}
					/>
				</div>

				<div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
					<Heatmap points={loaderData.results} weeks={loaderData.weeks} size="lg" />
				</div>
			</div>
		</>
	);
}
