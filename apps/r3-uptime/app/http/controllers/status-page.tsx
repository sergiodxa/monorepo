/**
 * Public status page controller. Loads a page by slug — private pages 404, since
 * this route is the page's only access path and private pages have no public route
 * at all. Resolves every attached HTTP/DNS/TCP/cron-job monitor's current status and
 * 365-day heatmap, and combines them into one page-level status.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import {
	CircleCheckBigIcon,
	CircleMinusIcon,
	CircleXIcon,
	ClockIcon,
	TriangleAlertIcon,
} from "@pkg/lucide-remix";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { ServiceStatus } from "~/app/services/status-page";
import type { SelectMonitorDailyStats } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary, status } from "~/resources/theme";
import routes from "~/routes/web";

const success = {
	50: "oklch(0.98 0.02 155)",
	200: "oklch(0.92 0.09 155)",
	800: "oklch(0.44 0.11 155)",
} as const;

const warning = {
	50: "oklch(0.98 0.02 85)",
	200: "oklch(0.92 0.12 85)",
	800: "oklch(0.42 0.12 85)",
} as const;

const danger = {
	50: "oklch(0.98 0.02 25)",
	200: "oklch(0.92 0.1 25)",
	800: "oklch(0.4 0.14 25)",
} as const;

const BANNER_MIX: Record<ServiceStatus, ReturnType<typeof css>> = {
	operational: css({
		background: success[50],
		borderColor: success[200],
		color: success[800],
		"@media (prefers-color-scheme: dark)": {
			background: "oklch(0.26 0.06 155 / 0.3)",
			borderColor: success[800],
			color: success[200],
		},
	}),
	degraded: css({
		background: warning[50],
		borderColor: warning[200],
		color: warning[800],
		"@media (prefers-color-scheme: dark)": {
			background: "oklch(0.24 0.06 85 / 0.3)",
			borderColor: warning[800],
			color: warning[200],
		},
	}),
	down: css({
		background: danger[50],
		borderColor: danger[200],
		color: danger[800],
		"@media (prefers-color-scheme: dark)": {
			background: "oklch(0.22 0.06 25 / 0.3)",
			borderColor: danger[800],
			color: danger[200],
		},
	}),
	unknown: css({
		background: success[50],
		borderColor: success[200],
		color: success[800],
		"@media (prefers-color-scheme: dark)": {
			background: "oklch(0.26 0.06 155 / 0.3)",
			borderColor: success[800],
			color: success[200],
		},
	}),
};

const BANNER_LABEL: Record<ServiceStatus, string> = {
	operational: "All Systems Operational",
	degraded: "Partial System Outage",
	down: "Major System Outage",
	unknown: "All Systems Operational",
};

/**
 * Icon shown in the overall-status banner. `computeOverallStatus` never actually
 * returns `"unknown"`, but this mirrors {@link BANNER_MIX} and {@link BANNER_LABEL}
 * by aliasing it to the operational icon rather than surfacing a separate "unknown"
 * banner state.
 */
const BANNER_ICON: Record<ServiceStatus, typeof CircleCheckBigIcon> = {
	operational: CircleCheckBigIcon,
	degraded: TriangleAlertIcon,
	down: CircleXIcon,
	unknown: CircleCheckBigIcon,
};

const BADGE_TONE: Record<ServiceStatus, BadgeTone> = {
	operational: "up",
	degraded: "degraded",
	down: "down",
	unknown: "neutral",
};

const BADGE_LABEL: Record<ServiceStatus, string> = {
	operational: "Operational",
	degraded: "Degraded",
	down: "Down",
	unknown: "Unknown",
};

/** Status icon shown left of each card's name, and (operational/degraded/down only) in the overall-status banner. */
const STATUS_ICON: Record<ServiceStatus, typeof CircleCheckBigIcon> = {
	operational: CircleCheckBigIcon,
	degraded: TriangleAlertIcon,
	down: CircleXIcon,
	unknown: CircleMinusIcon,
};

/** Colors a status icon to match its {@link BadgeTone}; combine with the icon's `mix` prop. */
const ICON_COLOR_MIX: Record<BadgeTone, ReturnType<typeof css>> = {
	up: css({
		color: status.up.light,
		"@media (prefers-color-scheme: dark)": { color: status.up.dark },
	}),
	degraded: css({
		color: status.degraded.light,
		"@media (prefers-color-scheme: dark)": { color: status.degraded.dark },
	}),
	down: css({
		color: status.down.light,
		"@media (prefers-color-scheme: dark)": { color: status.down.dark },
	}),
	neutral: css({
		color: status.neutral.light,
		"@media (prefers-color-scheme: dark)": { color: status.neutral.dark },
	}),
};

namespace CardStatusIcon {
	export interface Props {
		status: ServiceStatus;
	}
}

/** Colored status icon shown to the left of a card's name, next to its {@link Badge} pill. */
function CardStatusIcon(handle: Handle<CardStatusIcon.Props>) {
	return () => {
		let Icon = STATUS_ICON[handle.props.status];
		return <Icon size={16} mix={[ICON_COLOR_MIX[BADGE_TONE[handle.props.status]]]} />;
	};
}

/** How many trailing days {@link MiniHeatmap}'s row of bars covers. */
const MINI_HEATMAP_DAYS = 90;

/** The last {@link MINI_HEATMAP_DAYS} days (today inclusive) as `"YYYY-MM-DD"` strings, oldest first. */
function buildLastNDays(): string[] {
	let today = new Date();
	let end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

	let dates: string[] = [];
	for (let i = MINI_HEATMAP_DAYS - 1; i >= 0; i--) {
		dates.push(new Date(end.getTime() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
	}
	return dates;
}

/**
 * Aggregate uptime across `days` as a formatted percentage, or `null` when
 * there's no data at all. `days` may cover more than {@link MINI_HEATMAP_DAYS}
 * (the caller passes a full year's worth) — this only sums entries whose `date`
 * falls in `dates`, so the percentage matches the same window the bars render.
 */
function calculateUptimePercentage(
	days: SelectMonitorDailyStats[],
	dates: string[],
): string | null {
	let windowDates = new Set(dates);
	let totalChecks = 0;
	let successfulChecks = 0;

	for (let day of days) {
		if (!windowDates.has(day.date)) continue;
		totalChecks += day.total_checks;
		successfulChecks += day.successful_checks;
	}

	if (totalChecks === 0) return null;

	let percentage = (successfulChecks / totalChecks) * 100;
	return `${percentage.toFixed(percentage === 100 ? 0 : 2)}% uptime`;
}

namespace MiniHeatmap {
	export interface Props {
		days: SelectMonitorDailyStats[];
	}
}

/**
 * Renders a single-row, last-90-days heatmap for `days`, as thin vertical bars with
 * a range/uptime caption above and a status-color legend below. A single row of
 * thin vertical bars for the last 90 days (today inclusive), one per day, colored
 * by that day's `monitor_daily_stats.status`. Days with no data (not yet reached, or
 * the monitor didn't exist yet) render as empty bars. The bars stretch to fill the
 * full row width (no per-bar max width), so the row never trails off into empty
 * space regardless of how many days actually have data. This caption/legend copy is
 * a new design for this component and has no equivalent copy to translate, so it's
 * hardcoded rather than pulled from `ctx.i18next`.
 */
function MiniHeatmap(handle: Handle<MiniHeatmap.Props>) {
	return () => {
		let byDate = new Map(handle.props.days.map((day) => [day.date, day]));
		let dates = buildLastNDays();
		let uptime = calculateUptimePercentage(handle.props.days, dates);

		return (
			<div>
				<div mix={[css({ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 })]}>
					<span
						mix={[
							css({
								fontSize: "0.75rem",
								color: "oklch(0.55 0.01 145)",
								whiteSpace: "nowrap",
								"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
							}),
						]}
					>
						90 days ago
					</span>
					<div
						mix={[
							css({
								flex: 1,
								height: 1,
								background: "oklch(0.87 0.01 145)",
								"@media (prefers-color-scheme: dark)": { background: "oklch(0.4 0.01 145)" },
							}),
						]}
					/>
					{uptime !== null && (
						<span
							mix={[
								css({
									fontSize: "0.75rem",
									color: "oklch(0.55 0.01 145)",
									whiteSpace: "nowrap",
									"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
								}),
							]}
						>
							{uptime}
						</span>
					)}
					<div
						mix={[
							css({
								flex: 1,
								height: 1,
								background: "oklch(0.87 0.01 145)",
								"@media (prefers-color-scheme: dark)": { background: "oklch(0.4 0.01 145)" },
							}),
						]}
					/>
					<span
						mix={[
							css({
								fontSize: "0.75rem",
								color: "oklch(0.55 0.01 145)",
								whiteSpace: "nowrap",
								"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
							}),
						]}
					>
						Today
					</span>
				</div>

				<div mix={[css({ display: "flex", alignItems: "stretch", gap: 2, height: 32 })]}>
					{dates.map((date) => {
						let day = byDate.get(date);
						return (
							<div
								key={date}
								title={
									day
										? `${date}: ${day.status} (${day.successful_checks}/${day.total_checks})`
										: date
								}
								mix={[
									css({ flex: 1, minWidth: 2, borderRadius: 1 }),
									day?.status === "up"
										? css({ background: "oklch(0.7 0.2 155)" })
										: day?.status === "degraded"
											? css({ background: "oklch(0.72 0.18 85)" })
											: day?.status === "down"
												? css({ background: "oklch(0.68 0.2 25)" })
												: css({
														background: "oklch(0.91 0.008 145)",
														"@media (prefers-color-scheme: dark)": {
															background: "oklch(0.42 0.008 145)",
														},
													}),
								]}
							/>
						);
					})}
				</div>

				<div
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							justifyContent: "flex-end",
							gap: 12,
							marginTop: 6,
						}),
					]}
				>
					<div mix={[css({ display: "flex", alignItems: "center", gap: 4 })]}>
						<div
							mix={[
								css({ width: 10, height: 10, borderRadius: 2 }),
								css({ background: "oklch(0.7 0.2 155)" }),
							]}
						/>
						<span
							mix={[
								css({
									fontSize: "0.75rem",
									color: "oklch(0.55 0.01 145)",
									whiteSpace: "nowrap",
									"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
								}),
							]}
						>
							100%
						</span>
					</div>
					<div mix={[css({ display: "flex", alignItems: "center", gap: 4 })]}>
						<div
							mix={[
								css({ width: 10, height: 10, borderRadius: 2 }),
								css({ background: "oklch(0.72 0.18 85)" }),
							]}
						/>
						<span
							mix={[
								css({
									fontSize: "0.75rem",
									color: "oklch(0.55 0.01 145)",
									whiteSpace: "nowrap",
									"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
								}),
							]}
						>
							Partial
						</span>
					</div>
					<div mix={[css({ display: "flex", alignItems: "center", gap: 4 })]}>
						<div
							mix={[
								css({ width: 10, height: 10, borderRadius: 2 }),
								css({ background: "oklch(0.68 0.2 25)" }),
							]}
						/>
						<span
							mix={[
								css({
									fontSize: "0.75rem",
									color: "oklch(0.55 0.01 145)",
									whiteSpace: "nowrap",
									"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
								}),
							]}
						>
							Down
						</span>
					</div>
					<div mix={[css({ display: "flex", alignItems: "center", gap: 4 })]}>
						<div
							mix={[
								css({ width: 10, height: 10, borderRadius: 2 }),
								css({
									background: "oklch(0.91 0.008 145)",
									"@media (prefers-color-scheme: dark)": { background: "oklch(0.42 0.008 145)" },
								}),
							]}
						/>
						<span
							mix={[
								css({
									fontSize: "0.75rem",
									color: "oklch(0.55 0.01 145)",
									whiteSpace: "nowrap",
									"@media (prefers-color-scheme: dark)": { color: "oklch(0.65 0.01 145)" },
								}),
							]}
						>
							No data
						</span>
					</div>
				</div>
			</div>
		);
	};
}

/** GET /status/:slug — the public view of a status page. */
export default createAction(
	routes.statusPage,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

		let page = await StatusPage.findBySlugPublic(db, slug);
		if (!page) return notFound("Not Found");

		let attachments = await StatusPage.listAttachments(db, page.id);

		let [allMonitors, allDnsMonitors, allTcpMonitors, allCronJobs, httpSummaries] =
			await Promise.all([
				Monitor.listByTeam(db, page.team_id),
				DnsMonitor.listByTeam(db, page.team_id),
				TcpMonitor.listByTeam(db, page.team_id),
				CronJobMonitor.listByTeam(db, page.team_id),
				getTeamHttpSummaries(page.team_id),
			]);

		let healthByMonitorId = new Map(
			isFailure(httpSummaries)
				? []
				: httpSummaries.data.map((summary) => [summary.monitorId, summary.health]),
		);
		let monitorsById = new Map(allMonitors.map((monitor) => [monitor.id, monitor]));
		let dnsMonitorsById = new Map(allDnsMonitors.map((monitor) => [monitor.id, monitor]));
		let tcpMonitorsById = new Map(allTcpMonitors.map((monitor) => [monitor.id, monitor]));
		let cronJobsById = new Map(allCronJobs.map((monitor) => [monitor.id, monitor]));

		let httpServices = await Promise.all(
			attachments.monitors
				.map((row) => monitorsById.get(row.monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "http" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveHttpStatus(healthByMonitorId.get(monitor.id) ?? "pending"),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http"),
				})),
		);

		let dnsServices = await Promise.all(
			attachments.dnsMonitors
				.map((row) => dnsMonitorsById.get(row.dns_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "dns" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveDnsStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "dns"),
				})),
		);

		let tcpServices = await Promise.all(
			attachments.tcpMonitors
				.map((row) => tcpMonitorsById.get(row.tcp_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "tcp" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveTcpStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "tcp"),
				})),
		);

		let cronServices = attachments.cronJobs
			.map((row) => cronJobsById.get(row.cron_job_monitor_id))
			.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
			.map((monitor) => ({
				kind: "cron" as const,
				id: monitor.id,
				name: monitor.name,
				cronExpression: monitor.cron_expression,
				lastPingAt: monitor.last_ping_at,
				status: deriveCronStatus(monitor.status),
			}));

		let overallStatus = computeOverallStatus([
			...httpServices.map((service) => service.status),
			...dnsServices.map((service) => service.status),
			...tcpServices.map((service) => service.status),
			...cronServices.map((service) => service.status),
		]);

		let heatmapServices = [...httpServices, ...dnsServices, ...tcpServices];
		let isEmpty = heatmapServices.length === 0 && cronServices.length === 0;
		let BannerIcon = BANNER_ICON[overallStatus];

		return ctx.render(
			<DocumentLayout title={page.title}>
				<main
					mix={[
						css({
							maxWidth: 640,
							margin: "0 auto",
							padding: "40px 20px",
						}),
					]}
				>
					<div
						mix={[
							css({
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								textAlign: "center",
								gap: 4,
								marginBottom: 32,
							}),
						]}
					>
						{page.logo_url && (
							<img
								src={page.logo_url}
								alt={page.name}
								width={64}
								height={64}
								mix={[css({ marginBottom: 12 })]}
							/>
						)}
						<h1 mix={[css({ margin: "0 0 4px", fontSize: "1.875rem", fontWeight: 700 })]}>
							{page.title}
						</h1>
						{page.description && (
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": {
											color: neutral[400],
										},
									}),
								]}
							>
								{page.description}
							</p>
						)}
					</div>

					{page.show_overall_status && (
						<div
							mix={[
								css({
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: 10,
									padding: "14px 18px",
									borderRadius: 8,
									border: "1px solid transparent",
									fontWeight: 600,
									marginBottom: 24,
								}),
								BANNER_MIX[overallStatus],
							]}
						>
							<BannerIcon size={22} />
							<span>{BANNER_LABEL[overallStatus]}</span>
						</div>
					)}

					{isEmpty ? (
						<Empty>
							<Empty.Description>
								No services are configured for this status page.
							</Empty.Description>
						</Empty>
					) : (
						<>
							{heatmapServices.map((service) => (
								<div
									key={`${service.kind}-${service.id}`}
									mix={[
										css({
											display: "flex",
											flexDirection: "column",
											gap: 8,
											padding: 16,
											borderRadius: 8,
											border: `1px solid ${neutral[200]}`,
											background: "#ffffff",
											marginBottom: 12,
											"@media (prefers-color-scheme: dark)": {
												borderColor: neutral[800],
												background: neutral[900],
											},
										}),
									]}
								>
									<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
										<CardStatusIcon status={service.status} />
										<strong>{service.name}</strong>
										<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
									</div>
									<MiniHeatmap days={service.days} />
								</div>
							))}

							{cronServices.length > 0 && (
								<>
									{heatmapServices.length > 0 && (
										<h2>{ctx.i18next.t("statusPage.cronJobs.title")}</h2>
									)}
									{cronServices.map((service) => (
										<div
											key={service.id}
											mix={[
												css({
													display: "flex",
													flexDirection: "column",
													gap: 8,
													padding: 16,
													borderRadius: 8,
													border: `1px solid ${neutral[200]}`,
													background: "#ffffff",
													marginBottom: 12,
													"@media (prefers-color-scheme: dark)": {
														borderColor: neutral[800],
														background: neutral[900],
													},
												}),
											]}
										>
											<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
												<CardStatusIcon status={service.status} />
												<strong>{service.name}</strong>
												<Badge tone={BADGE_TONE[service.status]}>
													{BADGE_LABEL[service.status]}
												</Badge>
											</div>
											<p
												mix={[
													css({
														display: "flex",
														alignItems: "center",
														gap: 4,
														fontSize: "0.8125rem",
														color: neutral[500],
														"@media (prefers-color-scheme: dark)": {
															color: neutral[400],
														},
													}),
												]}
											>
												<ClockIcon size={12} />
												<span>
													{ctx.i18next.t("statusPage.cronJobs.schedule")}:{" "}
													<code>{service.cronExpression}</code>
												</span>
											</p>
											<p
												mix={[
													css({
														fontSize: "0.8125rem",
														color: neutral[500],
														"@media (prefers-color-scheme: dark)": {
															color: neutral[400],
														},
													}),
												]}
											>
												{ctx.i18next.t("statusPage.cronJobs.lastPing")}:{" "}
												{service.lastPingAt
													? new Date(service.lastPingAt).toLocaleString()
													: ctx.i18next.t("statusPage.cronJobs.never")}
											</p>
										</div>
									))}
								</>
							)}
						</>
					)}

					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": {
									color: neutral[400],
								},
							}),
						]}
					>
						Last updated {new Date().toLocaleString()} ·{" "}
						<a
							href={routes.home.href()}
							mix={[
								css({
									color: primary[600],
									textDecoration: "none",
									"&:hover": { textDecoration: "underline" },
									"@media (prefers-color-scheme: dark)": {
										color: primary[400],
									},
								}),
							]}
						>
							Powered by Uptime
						</a>
					</p>
				</main>
			</DocumentLayout>,
		);
	}),
);
