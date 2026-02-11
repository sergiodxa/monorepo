import { cn } from "@pkg/cn";
import { isSameDay } from "date-fns";
import {
	CheckCircle2Icon,
	AlertTriangleIcon,
	XCircleIcon,
	MinusCircleIcon,
	ClockIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link } from "react-router";

import type { CronJobStatus } from "~/db/schema";

import * as BetterHeatmap from "~/components/heatmap-composable";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import Monitor from "~/models/monitor";
import daysOfLastNDays from "~/utils/days-of-last-n-days";
import getCellColor from "~/utils/get-cell-color";

import type { Route } from "./+types/status.$slug";

export const meta: Route.MetaFunction = ({ data }) => {
	if (!data) {
		return [{ title: "Status Page Not Found" }];
	}
	return [
		{ title: `${data.statusPage.title} - Status` },
		{
			name: "description",
			content: data.statusPage.description ?? `Status page for ${data.statusPage.title}`,
		},
	];
};

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("statusPage.loader.start", {
		route: "status.$slug",
		slug: params.slug,
	});

	let statusPage = await db().query.statusPages.findFirst({
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.slug, params.slug),
				operators.eq(fields.isPublic, true),
			);
		},
		with: {
			monitors: {
				orderBy(fields, operators) {
					return operators.asc(fields.order);
				},
			},
			cronJobs: {
				orderBy(fields, operators) {
					return operators.asc(fields.order);
				},
			},
		},
	});

	if (!statusPage) {
		logger().info("statusPage.loader.not-found", {
			route: "status.$slug",
			slug: params.slug,
		});
		throw new Response("Status page not found", { status: 404 });
	}

	let monitorIds = statusPage.monitors.map((m) => m.monitorId);
	let cronJobIds = statusPage.cronJobs.map((c) => c.cronJobMonitorId);

	if (monitorIds.length === 0 && cronJobIds.length === 0) {
		logger().info("statusPage.loader.complete", {
			route: "status.$slug",
			slug: params.slug,
			monitorCount: 0,
			cronJobCount: 0,
			overallStatus: "operational",
		});
		return {
			statusPage: {
				title: statusPage.title,
				description: statusPage.description,
				logoUrl: statusPage.logoUrl,
				showOverallStatus: statusPage.showOverallStatus,
			},
			monitors: [],
			cronJobs: [],
			overallStatus: "operational" as const,
			lastUpdated: new Date().toISOString(),
		};
	}

	let monitors =
		monitorIds.length > 0
			? await db().query.monitors.findMany({
					columns: {
						id: true,
						name: true,
						expectedStatus: true,
						degradedAfterMs: true,
					},
					where(fields, operators) {
						return operators.inArray(fields.id, monitorIds);
					},
					with: {
						results: {
							columns: { responseStatus: true, responseTimeMs: true, completedAt: true },
							where(fields, operators) {
								return operators.isNotNull(fields.completedAt);
							},
							orderBy(fields, operators) {
								return operators.desc(fields.completedAt);
							},
							limit: 1,
						},
					},
				})
			: [];

	let cronJobMonitors =
		cronJobIds.length > 0
			? await db().query.cronJobMonitors.findMany({
					columns: {
						id: true,
						name: true,
						status: true,
						cronExpression: true,
						lastPingAt: true,
					},
					where(fields, operators) {
						return operators.inArray(fields.id, cronJobIds);
					},
				})
			: [];

	let days = daysOfLastNDays(new Date(), 30);

	let monitorsWithData = await Promise.all(
		statusPage.monitors.map(async (spm) => {
			let monitor = monitors.find((m) => m.id === spm.monitorId);
			if (!monitor) return null;

			let results = await Monitor.getResultsById(db(), monitor.id);

			let lastResult = monitor.results[0];
			let status: "operational" | "degraded" | "down" | "unknown" = "unknown";

			if (lastResult) {
				let isSuccess = lastResult.responseStatus === monitor.expectedStatus;
				let isDegraded =
					lastResult.responseTimeMs !== null && lastResult.responseTimeMs > monitor.degradedAfterMs;

				if (!isSuccess) {
					status = "down";
				} else if (isDegraded) {
					status = "degraded";
				} else {
					status = "operational";
				}
			}

			let heatmapData = days.map((date) => {
				let point = results.find((r) => isSameDay(new Date(r.date), date));
				return {
					date: date.toISOString(),
					successRate: point ? point.successRate * 100 : null,
				};
			});

			return {
				id: monitor.id,
				name: spm.displayName ?? monitor.name,
				status,
				heatmap: heatmapData,
			};
		}),
	);

	let validMonitors = monitorsWithData.filter((m): m is NonNullable<typeof m> => m !== null);

	// Map cron job status to display status
	function mapCronJobStatus(
		status: CronJobStatus,
	): "operational" | "degraded" | "down" | "unknown" {
		switch (status) {
			case "healthy":
				return "operational";
			case "late":
				return "degraded";
			case "missed":
				return "down";
			case "new":
				return "unknown";
			default:
				return "unknown";
		}
	}

	let cronJobsWithData = statusPage.cronJobs.map((spc) => {
		let cronJob = cronJobMonitors.find((c) => c.id === spc.cronJobMonitorId);
		if (!cronJob) return null;

		return {
			id: cronJob.id,
			name: spc.displayName ?? cronJob.name,
			status: mapCronJobStatus(cronJob.status),
			cronExpression: cronJob.cronExpression,
			lastPingAt: cronJob.lastPingAt?.toISOString() ?? null,
		};
	});

	let validCronJobs = cronJobsWithData.filter((c): c is NonNullable<typeof c> => c !== null);

	let overallStatus: "operational" | "degraded" | "down" = "operational";

	// Combine monitors and cron jobs for overall status calculation
	let allItems = [...validMonitors.map((m) => m.status), ...validCronJobs.map((c) => c.status)];

	if (allItems.length > 0) {
		let downCount = allItems.filter((s) => s === "down").length;
		let degradedCount = allItems.filter((s) => s === "degraded").length;
		let totalCount = allItems.length;
		let notOperationalCount = downCount + degradedCount;

		if (notOperationalCount > totalCount / 2) {
			// Majority of services are down or degraded
			overallStatus = "down";
		} else if (notOperationalCount > 0) {
			// Some services are down but majority are up
			overallStatus = "degraded";
		}
	}

	logger().info("statusPage.loader.complete", {
		route: "status.$slug",
		slug: params.slug,
		monitorCount: validMonitors.length,
		cronJobCount: validCronJobs.length,
		overallStatus,
	});

	return {
		statusPage: {
			title: statusPage.title,
			description: statusPage.description,
			logoUrl: statusPage.logoUrl,
			showOverallStatus: statusPage.showOverallStatus,
		},
		monitors: validMonitors,
		cronJobs: validCronJobs,
		overallStatus,
		lastUpdated: new Date().toISOString(),
	};
}

export default function Component({ loaderData }: Route.ComponentProps) {
	let { statusPage, monitors, cronJobs, overallStatus, lastUpdated } = loaderData;
	let { t } = useTranslation("translation", { keyPrefix: "statusPage" });

	return (
		<div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
			<div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
				<header className="mb-8 text-center">
					{statusPage.logoUrl && (
						<img src={statusPage.logoUrl} alt="" className="mx-auto mb-4 h-16 w-auto" />
					)}
					<h1 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">
						{statusPage.title}
					</h1>
					{statusPage.description && (
						<p className="mt-2 text-neutral-600 dark:text-neutral-400">{statusPage.description}</p>
					)}
				</header>

				{statusPage.showOverallStatus && <OverallStatusBanner status={overallStatus} />}

				<div className="mt-8 space-y-4">
					{monitors.length === 0 && cronJobs.length === 0 ? (
						<div className="rounded-lg border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-neutral-900">
							<p className="text-neutral-500 dark:text-neutral-400">
								No monitors configured for this status page.
							</p>
						</div>
					) : (
						<>
							{monitors.map((monitor) => (
								<MonitorCard key={monitor.id} monitor={monitor} />
							))}
							{cronJobs.length > 0 && (
								<>
									{monitors.length > 0 && (
										<h2 className="pt-4 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
											{t("cronJobs.title")}
										</h2>
									)}
									{cronJobs.map((cronJob) => (
										<CronJobCard key={cronJob.id} cronJob={cronJob} />
									))}
								</>
							)}
						</>
					)}
				</div>

				<footer className="mt-12 border-t border-neutral-200 pt-6 text-center dark:border-neutral-800">
					<p className="text-sm text-neutral-500 dark:text-neutral-400">
						Last updated:{" "}
						{new Date(lastUpdated).toLocaleString(undefined, {
							dateStyle: "medium",
							timeStyle: "short",
						})}
					</p>
					<p className="mt-2 text-sm text-neutral-400 dark:text-neutral-500">
						Powered by{" "}
						<Link
							to={href("/")}
							className="font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
						>
							Uptime
						</Link>
					</p>
				</footer>
			</div>
		</div>
	);
}

function OverallStatusBanner({ status }: { status: "operational" | "degraded" | "down" }) {
	let config = {
		operational: {
			icon: CheckCircle2Icon,
			label: "All Systems Operational",
			bgColor: "bg-green-50 dark:bg-green-950/30",
			borderColor: "border-green-200 dark:border-green-800",
			textColor: "text-green-800 dark:text-green-200",
			iconColor: "text-green-600 dark:text-green-400",
		},
		degraded: {
			icon: AlertTriangleIcon,
			label: "Partial System Outage",
			bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
			borderColor: "border-yellow-200 dark:border-yellow-800",
			textColor: "text-yellow-800 dark:text-yellow-200",
			iconColor: "text-yellow-600 dark:text-yellow-400",
		},
		down: {
			icon: XCircleIcon,
			label: "Major System Outage",
			bgColor: "bg-red-50 dark:bg-red-950/30",
			borderColor: "border-red-200 dark:border-red-800",
			textColor: "text-red-800 dark:text-red-200",
			iconColor: "text-red-600 dark:text-red-400",
		},
	}[status];

	let Icon = config.icon;

	return (
		<div
			className={cn(
				"flex items-center justify-center gap-3 rounded-lg border p-4",
				config.bgColor,
				config.borderColor,
			)}
		>
			<Icon className={cn("h-6 w-6", config.iconColor)} />
			<span className={cn("text-lg font-semibold", config.textColor)}>{config.label}</span>
		</div>
	);
}

function MonitorCard({
	monitor,
}: {
	monitor: {
		id: string;
		name: string;
		status: "operational" | "degraded" | "down" | "unknown";
		heatmap: Array<{ date: string; successRate: number | null }>;
	};
}) {
	let statusConfig = {
		operational: {
			icon: CheckCircle2Icon,
			label: "Operational",
			iconColor: "text-green-500",
			badgeColor: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
		},
		degraded: {
			icon: AlertTriangleIcon,
			label: "Degraded",
			iconColor: "text-yellow-500",
			badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
		},
		down: {
			icon: XCircleIcon,
			label: "Down",
			iconColor: "text-red-500",
			badgeColor: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
		},
		unknown: {
			icon: MinusCircleIcon,
			label: "Unknown",
			iconColor: "text-neutral-400",
			badgeColor: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
		},
	}[monitor.status];

	let Icon = statusConfig.icon;

	return (
		<div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Icon className={cn("h-5 w-5", statusConfig.iconColor)} />
					<span className="font-medium text-neutral-900 dark:text-neutral-100">{monitor.name}</span>
				</div>
				<span
					className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusConfig.badgeColor)}
				>
					{statusConfig.label}
				</span>
			</div>

			<div className="mt-4">
				<MiniHeatmap data={monitor.heatmap} />
			</div>
		</div>
	);
}

function CronJobCard({
	cronJob,
}: {
	cronJob: {
		id: string;
		name: string;
		status: "operational" | "degraded" | "down" | "unknown";
		cronExpression: string;
		lastPingAt: string | null;
	};
}) {
	let { t } = useTranslation("translation", { keyPrefix: "statusPage.cronJobs" });

	let statusConfig = {
		operational: {
			icon: CheckCircle2Icon,
			label: "Operational",
			iconColor: "text-green-500",
			badgeColor: "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200",
		},
		degraded: {
			icon: AlertTriangleIcon,
			label: "Degraded",
			iconColor: "text-yellow-500",
			badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200",
		},
		down: {
			icon: XCircleIcon,
			label: "Down",
			iconColor: "text-red-500",
			badgeColor: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200",
		},
		unknown: {
			icon: MinusCircleIcon,
			label: "Unknown",
			iconColor: "text-neutral-400",
			badgeColor: "bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200",
		},
	}[cronJob.status];

	let Icon = statusConfig.icon;

	return (
		<div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Icon className={cn("h-5 w-5", statusConfig.iconColor)} />
					<div className="flex flex-col">
						<span className="font-medium text-neutral-900 dark:text-neutral-100">
							{cronJob.name}
						</span>
						<div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
							<ClockIcon className="h-3 w-3" />
							<span>
								{t("schedule")}: {cronJob.cronExpression}
							</span>
						</div>
					</div>
				</div>
				<div className="flex flex-col items-end gap-1">
					<span
						className={cn(
							"rounded-full px-2.5 py-0.5 text-xs font-medium",
							statusConfig.badgeColor,
						)}
					>
						{statusConfig.label}
					</span>
					<span className="text-xs text-neutral-500 dark:text-neutral-400">
						{t("lastPing")}:{" "}
						{cronJob.lastPingAt
							? new Date(cronJob.lastPingAt).toLocaleString(undefined, {
									dateStyle: "short",
									timeStyle: "short",
								})
							: t("never")}
					</span>
				</div>
			</div>
		</div>
	);
}

function MiniHeatmap({ data }: { data: Array<{ date: string; successRate: number | null }> }) {
	let { t } = useTranslation("translation", { keyPrefix: "statusPage.heatmap" });

	return (
		<div className="flex flex-col gap-1">
			<div className="flex justify-between text-xs text-neutral-500 dark:text-neutral-400">
				<span>{t("daysAgo")}</span>
				<span>{t("today")}</span>
			</div>
			<div className="flex gap-0.5">
				{data.map((point) => (
					<BetterHeatmap.CellTooltip
						key={point.date}
						message={`${new Date(point.date).toLocaleDateString(undefined, {
							month: "short",
							day: "numeric",
						})}: ${point.successRate !== null ? t("tooltip.uptime", { percentage: point.successRate.toFixed(1) }) : t("tooltip.noData")}`}
					>
						<div className={cn("h-6 flex-1 rounded-sm", getCellColor(point.successRate))} />
					</BetterHeatmap.CellTooltip>
				))}
			</div>
			<div className="mt-1 flex items-center justify-end gap-2 text-xs text-neutral-500 dark:text-neutral-400">
				<div className="flex items-center gap-1">
					<div className="bg-green-500 h-2.5 w-2.5 rounded-sm" />
					<span>{t("legend.full")}</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="bg-yellow-500 h-2.5 w-2.5 rounded-sm" />
					<span>{t("legend.partial")}</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="bg-red-500 h-2.5 w-2.5 rounded-sm" />
					<span>{t("legend.down")}</span>
				</div>
				<div className="flex items-center gap-1">
					<div className="h-2.5 w-2.5 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
					<span>{t("legend.noData")}</span>
				</div>
			</div>
		</div>
	);
}

export function ErrorBoundary() {
	let { t } = useTranslation("translation", { keyPrefix: "statusPage.error" });

	return (
		<div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
			<div className="text-center">
				<h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t("title")}</h1>
				<p className="mt-2 text-neutral-600 dark:text-neutral-400">{t("description")}</p>
				<Link
					to={href("/")}
					className="mt-4 inline-block text-sm font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-neutral-100"
				>
					{t("goHome")}
				</Link>
			</div>
		</div>
	);
}
