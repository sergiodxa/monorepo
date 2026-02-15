import { cn } from "@pkg/cn";
import { Alert, Badge, Button, Card, LinkButton } from "@pkg/ui";
import { format, subDays } from "date-fns";
import {
	LockIcon,
	PencilIcon,
	PlayIcon,
	RefreshCwIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShieldXIcon,
} from "lucide-react";
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
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";
import { createSslInfo } from "~/services/check-ssl";
import daysOfYear from "~/utils/days-of-year";
import groupDatesPerWeek from "~/utils/group-dates-per-week";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("monitor.loader.start", {
		route: "monitors.$monitorId",
		monitorId: params.monitorId,
		teamId: team().id,
	});

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

	if (!monitor) {
		logger().info("monitor.loader.not-found", {
			route: "monitors.$monitorId",
			monitorId: params.monitorId,
			teamId: team().id,
		});
		return redirect(href("/app/:team/dashboard", params));
	}

	// Prepare SSL info
	let sslInfo = createSslInfo({
		sslMonitoringEnabled: monitor.sslMonitoringEnabled,
		sslExpiryWarningDays: monitor.sslExpiryWarningDays,
		sslExpiresAt: monitor.sslExpiresAt,
		sslIssuer: monitor.sslIssuer,
		sslLastCheckedAt: monitor.sslLastCheckedAt,
		sslStatus: monitor.sslStatus,
	});

	logger().info("monitor.loader.complete", {
		route: "monitors.$monitorId",
		monitorId: params.monitorId,
		monitorName: monitor.name,
		resultsCount: results.length,
		sslStatus: sslInfo.status,
	});

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
		ssl: sslInfo,
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
					className="shrink-0 px-2"
				>
					<PencilIcon aria-hidden className="size-4.5" />
					<span className="max-sm:sr-only">{t("header.action.edit")}</span>
				</LinkButton>

				<Button
					color="neutral"
					type="button"
					onPress={() => revalidator.revalidate()}
					className="shrink-0 px-2"
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

				{/* SSL Certificate Status Card */}
				<SslStatusCard
					ssl={loaderData.ssl}
					monitorId={loaderData.monitor.id}
					teamSlug={params.team}
				/>

				<div className="-mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
					<Heatmap points={loaderData.results} weeks={loaderData.weeks} size="lg" />
				</div>
			</div>
		</>
	);
}

function SslStatusCard({
	ssl,
	monitorId,
	teamSlug,
}: {
	ssl: ReturnType<typeof createSslInfo>;
	monitorId: string;
	teamSlug: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.monitor.ssl" });

	let statusIcon = {
		valid: <ShieldCheckIcon className="text-green-600 dark:text-green-400 size-5" />,
		expiring: <ShieldAlertIcon className="text-yellow-600 dark:text-yellow-400 size-5" />,
		expired: <ShieldXIcon className="text-red-600 dark:text-red-400 size-5" />,
		error: <ShieldXIcon className="text-red-600 dark:text-red-400 size-5" />,
		unknown: <LockIcon className="size-5 text-neutral-400" />,
	}[ssl.status];

	let statusColor = {
		valid: "success",
		expiring: "warning",
		expired: "danger",
		error: "danger",
		unknown: "neutral",
	}[ssl.status] as "success" | "warning" | "danger" | "neutral";

	return (
		<Card>
			<Card.Header>
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						{statusIcon}
						<Card.Title>{t("title")}</Card.Title>
					</div>
					<Badge color={statusColor}>{t(`status.${ssl.status}`)}</Badge>
				</div>
			</Card.Header>
			<Card.Content>
				{ssl.enabled ? (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						<div>
							<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
								{t("expiresAt")}
							</p>
							<p className="text-lg font-semibold">
								{ssl.expiresAt ? format(ssl.expiresAt, "MMM d, yyyy") : "-"}
							</p>
							{ssl.daysUntilExpiry !== null && (
								<p className="text-sm text-neutral-500 dark:text-neutral-400">
									{t("expiresIn", { days: ssl.daysUntilExpiry })}
								</p>
							)}
						</div>
						<div>
							<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
								{t("issuer")}
							</p>
							<p className="text-lg font-semibold">{ssl.issuer || "-"}</p>
						</div>
						<div>
							<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
								{t("lastChecked")}
							</p>
							<p className="text-lg font-semibold">
								{ssl.lastCheckedAt ? format(ssl.lastCheckedAt, "MMM d, yyyy HH:mm") : "-"}
							</p>
						</div>
						<div className="flex items-end justify-end">
							<LinkButton
								color="neutral"
								size="sm"
								href={href("/app/:team/monitors/:monitorId/edit", {
									team: teamSlug,
									monitorId,
								})}
							>
								<PencilIcon className="size-4" />
								{t("configure")}
							</LinkButton>
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between">
						<p className="text-neutral-500 dark:text-neutral-400">{t("notConfigured")}</p>
						<LinkButton
							color="primary"
							size="sm"
							href={href("/app/:team/monitors/:monitorId/edit", {
								team: teamSlug,
								monitorId,
							})}
						>
							<LockIcon className="size-4" />
							{t("configure")}
						</LinkButton>
					</div>
				)}
			</Card.Content>
		</Card>
	);
}
