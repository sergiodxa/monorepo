/**
 * Public status page: header, an optional overall-status banner, one card per
 * attached HTTP/DNS/TCP monitor (status + 365-day heatmap) and cron job (status +
 * schedule + last ping), an empty state when nothing is attached, and a footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	CircleCheckBigIcon,
	CircleMinusIcon,
	CircleXIcon,
	ClockIcon,
	TriangleAlertIcon,
} from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { ServiceStatus } from "~/app/services/status-page";
import type { SelectMonitorDailyStats, SelectStatusPage } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import { neutral, primary, status } from "~/resources/theme";
import MiniHeatmap from "~/resources/views/shared/mini-heatmap";
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

interface HeatmapService {
	kind: "http" | "dns" | "tcp";
	id: string;
	name: string;
	status: ServiceStatus;
	days: SelectMonitorDailyStats[];
}

interface CronService {
	kind: "cron";
	id: string;
	name: string;
	cronExpression: string;
	lastPingAt: number | null;
	status: ServiceStatus;
}

namespace StatusPageView {
	export interface Props {
		page: SelectStatusPage;
		overallStatus: ServiceStatus;
		httpServices: HeatmapService[];
		dnsServices: HeatmapService[];
		tcpServices: HeatmapService[];
		cronServices: CronService[];
	}
}

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

/** Renders the public status page: an optional overall-status banner, one card per attached HTTP/DNS/TCP monitor with a 365-day heatmap, cron-job cards with schedule and last-ping time, or an empty state when nothing is attached. */
export default function StatusPageView(handle: Handle<StatusPageView.Props>) {
	return () => {
		let { page, overallStatus, httpServices, dnsServices, tcpServices, cronServices } =
			handle.props;
		let heatmapServices = [...httpServices, ...dnsServices, ...tcpServices];
		let isEmpty = heatmapServices.length === 0 && cronServices.length === 0;
		let BannerIcon = BANNER_ICON[overallStatus];

		return (
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
						<Empty.Description>No services are configured for this status page.</Empty.Description>
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
								{heatmapServices.length > 0 && <h2>Cron Jobs</h2>}
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
											<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
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
												Schedule: <code>{service.cronExpression}</code>
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
											Last ping:{" "}
											{service.lastPingAt ? new Date(service.lastPingAt).toLocaleString() : "never"}
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
		);
	};
}
