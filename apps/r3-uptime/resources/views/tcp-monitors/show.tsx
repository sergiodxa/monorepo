/**
 * TCP monitor detail page. Shows the monitor's configuration, stats derived from its
 * result history, and the history itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type {
	SelectMonitorDailyStats,
	SelectTcpMonitor,
	SelectTcpMonitorResult,
} from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import { Empty, EmptyDescription } from "~/resources/components/empty";
import StatCard from "~/resources/components/stat-card";
import { neutral } from "~/resources/theme";
import Heatmap from "~/resources/views/shared/heatmap";

namespace TcpMonitorShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectTcpMonitor;
		results: SelectTcpMonitorResult[];
		dailyStats: SelectMonitorDailyStats[];
	}
}

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
};

/** Renders configuration/status stat cards, uptime and response-time stats computed from `results`, the uptime heatmap, and the check history table. */
export default function TcpMonitorShowView(handle: Handle<TcpMonitorShowView.Props>) {
	return () => {
		let { monitor, results, dailyStats } = handle.props;

		let totalChecks = results.length;
		let upChecks = results.filter((result) => result.status === "up").length;
		let uptimePercent = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : null;
		let timedResults = results.filter((result) => result.response_time_ms !== null);
		let avgResponseTime =
			timedResults.length > 0
				? Math.round(
						timedResults.reduce((sum, result) => sum + (result.response_time_ms ?? 0), 0) /
							timedResults.length,
					)
				: null;

		return (
			<div>
				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
					<StatCard
						label="Endpoint"
						value={
							<code>
								{monitor.host}:{monitor.port}
							</code>
						}
					/>
					<StatCard
						label="Status"
						value={
							<Badge tone={STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
								{monitor.last_status ?? "pending"}
							</Badge>
						}
					/>
					<StatCard label="Check interval" value={`${monitor.interval_seconds}s`} />
					<StatCard label="Timeout" value={`${monitor.timeout_ms}ms`} />
				</div>

				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
					<StatCard label="Uptime" value={uptimePercent === null ? "—" : `${uptimePercent}%`} />
					<StatCard
						label="Avg response time"
						value={avgResponseTime === null ? "—" : `${avgResponseTime}ms`}
					/>
					<StatCard label="Total checks" value={totalChecks} />
				</div>

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				<h2>Check history</h2>
				{results.length === 0 ? (
					<Empty>
						<EmptyDescription>No checks yet.</EmptyDescription>
					</Empty>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Checked at</th>
									<th>Status</th>
									<th>Response time</th>
									<th>Error</th>
								</tr>
							</thead>
							<tbody>
								{results.map((result) => (
									<tr key={result.id}>
										<td>{new Date(result.checked_at).toLocaleString()}</td>
										<td>
											<Badge tone={STATUS_BADGE_TONE[result.status] ?? "neutral"}>
												{result.status}
											</Badge>
										</td>
										<td>
											{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}
										</td>
										<td>{result.error_message ?? "—"}</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
