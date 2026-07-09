/**
 * TCP monitor detail page. Shows the monitor's configuration, stats derived from its
 * result history, and the history itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type {
	SelectMonitorDailyStats,
	SelectTcpMonitor,
	SelectTcpMonitorResult,
} from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
import * as s from "~/resources/styles";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

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

export default function TcpMonitorShowView(handle: Handle<TcpMonitorShowView.Props>) {
	return () => {
		let { team, monitor, results, dailyStats } = handle.props;

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
				<div mix={[s.row]}>
					<h1>{monitor.name}</h1>
					<form method="post" action={routes.actions.checkTcpMonitor.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button type="submit" mix={[s.buttonSecondary]}>
							Check now
						</button>
					</form>
					<a
						href={routes.app.team.tcpMonitorEdit.href({ team: team.slug, monitorId: monitor.id })}
						mix={[s.buttonSecondary]}
					>
						Edit
					</a>
				</div>

				<div mix={[s.statRow]}>
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

				<div mix={[s.statRow]}>
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
					<EmptyState message="No checks yet." />
				) : (
					<table mix={[s.table]}>
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
									<td>{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}</td>
									<td>{result.error_message ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
