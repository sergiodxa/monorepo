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

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	up: s.badgeUp,
	timeout: s.badgeDegraded,
	down: s.badgeDown,
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
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Endpoint</div>
						<code>
							{monitor.host}:{monitor.port}
						</code>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Status</div>
						<span mix={[s.badge, STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}>
							{monitor.last_status ?? "pending"}
						</span>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Check interval</div>
						<div mix={[s.statValue]}>{monitor.interval_seconds}s</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Timeout</div>
						<div mix={[s.statValue]}>{monitor.timeout_ms}ms</div>
					</div>
				</div>

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Uptime</div>
						<div mix={[s.statValue]}>{uptimePercent === null ? "—" : `${uptimePercent}%`}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Avg response time</div>
						<div mix={[s.statValue]}>{avgResponseTime === null ? "—" : `${avgResponseTime}ms`}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Total checks</div>
						<div mix={[s.statValue]}>{totalChecks}</div>
					</div>
				</div>

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				<h2>Check history</h2>
				{results.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No checks yet.</p>
					</div>
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
										<span mix={[s.badge, STATUS_BADGE_MIX[result.status] ?? s.badgeNeutral]}>
											{result.status}
										</span>
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
