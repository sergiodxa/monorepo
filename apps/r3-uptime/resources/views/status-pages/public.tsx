/**
 * Public status page: header, an optional overall-status banner, one card per
 * attached HTTP/DNS/TCP monitor (status + 365-day heatmap) and cron job (status +
 * schedule + last ping), an empty state when nothing is attached, and a footer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { ServiceStatus } from "~/app/services/status-page";
import type { SelectMonitorDailyStats, SelectStatusPage } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = {
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
} as const;

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

/** Success scale shades used on this page, hue 155. */
const success = {
	50: "oklch(0.98 0.02 155)",
	200: "oklch(0.92 0.09 155)",
	800: "oklch(0.44 0.11 155)",
} as const;

/** Warning scale shades used on this page, hue 85. */
const warning = {
	50: "oklch(0.98 0.02 85)",
	200: "oklch(0.92 0.12 85)",
	800: "oklch(0.42 0.12 85)",
} as const;

/** Danger scale shades used on this page, hue 25. */
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

export default function StatusPageView(handle: Handle<StatusPageView.Props>) {
	return () => {
		let { page, overallStatus, httpServices, dnsServices, tcpServices, cronServices } =
			handle.props;
		let heatmapServices = [...httpServices, ...dnsServices, ...tcpServices];
		let isEmpty = heatmapServices.length === 0 && cronServices.length === 0;

		return (
			<main
				mix={[
					css({
						maxWidth: 896,
						margin: "0 auto",
						padding: "40px 20px",
					}),
				]}
			>
				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					{page.logo_url && <img src={page.logo_url} alt={page.name} width={40} height={40} />}
					<div>
						<h1 mix={[css({ margin: "0 0 4px" })]}>{page.title}</h1>
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
				</div>

				{page.show_overall_status && (
					<div
						mix={[
							css({
								display: "flex",
								alignItems: "center",
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
						{BANNER_LABEL[overallStatus]}
					</div>
				)}

				{isEmpty ? (
					<EmptyState message="No services are configured for this status page." />
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
									<strong>{service.name}</strong>
									<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
								</div>
								<Heatmap days={service.days} />
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
											<strong>{service.name}</strong>
											<Badge tone={BADGE_TONE[service.status]}>{BADGE_LABEL[service.status]}</Badge>
										</div>
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
											Schedule: <code>{service.cronExpression}</code>
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
