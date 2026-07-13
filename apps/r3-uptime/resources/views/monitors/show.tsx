/**
 * HTTP monitor detail page. Shows the monitor's configuration, SSL status, a recent
 * latency sparkline from Analytics Engine, a calendar-year uptime heatmap from
 * `monitor_daily_stats`, and run/edit actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SparklinePoint } from "~/app/services/analytics";
import type { SelectMonitor, SelectMonitorDailyStats } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { calculateSslStatus } from "~/app/services/ssl-info";
import Badge from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import { neutral } from "~/resources/theme";
import Sparkline from "~/resources/views/monitors/sparkline";
import Heatmap from "~/resources/views/shared/heatmap";

namespace MonitorShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		sparkline: SparklinePoint[];
		dailyStats: SelectMonitorDailyStats[];
	}
}

/** Renders configuration stat cards, the recent-latency sparkline, the uptime heatmap, and an SSL status summary (or a "not enabled" note when SSL monitoring is off). */
export default function MonitorShowView(handle: Handle<MonitorShowView.Props>) {
	return () => {
		let { monitor, sparkline, dailyStats } = handle.props;

		return (
			<div>
				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
					<StatCard label="URL" value={<code>{monitor.url}</code>} />
					<StatCard label="Method" value={monitor.method} />
					<StatCard label="Check interval" value={`${monitor.interval_seconds}s`} />
				</div>

				<h2>Recent response time</h2>
				<Sparkline points={sparkline} />

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				<h2>SSL certificate</h2>
				{SslSummary({ monitor })}
			</div>
		);
	};
}

function SslSummary(props: { monitor: SelectMonitor }) {
	if (!props.monitor.ssl_monitoring_enabled) {
		return (
			<p
				mix={[
					css({
						fontSize: "0.8125rem",
						color: neutral[500],
						"@media (prefers-color-scheme: dark)": { color: neutral[400] },
					}),
				]}
			>
				SSL monitoring is not enabled for this monitor.
			</p>
		);
	}

	let { status, daysUntilExpiry } = calculateSslStatus(
		props.monitor.ssl_expires_at,
		props.monitor.ssl_expiry_warning_days,
	);

	let tone: BadgeTone =
		status === "valid"
			? "up"
			: status === "expiring"
				? "degraded"
				: status === "expired"
					? "down"
					: "neutral";

	return (
		<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
			<StatCard label="Status" value={<Badge tone={tone}>{status}</Badge>} />
			<StatCard label="Days until expiry" value={daysUntilExpiry ?? "—"} />
			<StatCard label="Issuer" value={props.monitor.ssl_issuer ?? "—"} />
		</div>
	);
}
