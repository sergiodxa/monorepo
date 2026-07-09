/**
 * DNS monitor detail page. Shows the monitor's configuration, stats derived from its
 * result history, and the history itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type {
	SelectDnsMonitor,
	SelectDnsMonitorResult,
	SelectMonitorDailyStats,
} from "~/database/schema";

import * as s from "~/resources/styles";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

namespace DnsMonitorShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectDnsMonitor;
		results: SelectDnsMonitorResult[];
		dailyStats: SelectMonitorDailyStats[];
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	ok: s.badgeUp,
	changed: s.badgeDegraded,
	error: s.badgeDown,
};

export default function DnsMonitorShowView(handle: Handle<DnsMonitorShowView.Props>) {
	return () => {
		let { team, monitor, results, dailyStats } = handle.props;

		let totalChecks = results.length;
		let okChecks = results.filter((result) => result.status === "ok").length;
		let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;
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
					<form method="post" action={routes.actions.checkDnsMonitor.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button type="submit" mix={[s.buttonSecondary]}>
							Check now
						</button>
					</form>
					<a
						href={routes.app.team.dnsMonitorEdit.href({ team: team.slug, monitorId: monitor.id })}
						mix={[s.buttonSecondary]}
					>
						Edit
					</a>
				</div>

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Domain</div>
						<code>{monitor.domain}</code>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Record type</div>
						<div mix={[s.statValue]}>{monitor.record_type}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Status</div>
						<span mix={[s.badge, STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}>
							{monitor.last_status ?? "not checked"}
						</span>
					</div>
					{monitor.expected_value && (
						<div mix={[s.statCard]}>
							<div mix={[s.mutedSmall]}>Expected value</div>
							<code>{monitor.expected_value}</code>
						</div>
					)}
					{monitor.last_value && (
						<div mix={[s.statCard]}>
							<div mix={[s.mutedSmall]}>Current value</div>
							<code>{monitor.last_value}</code>
						</div>
					)}
				</div>

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Success rate</div>
						<div mix={[s.statValue]}>{successRate === null ? "—" : `${successRate}%`}</div>
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

				<h2>Result history</h2>
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
								<th>Value</th>
								<th>Response time</th>
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
									<td>
										<code>{result.resolved_value ?? result.error_message ?? "—"}</code>
									</td>
									<td>{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
