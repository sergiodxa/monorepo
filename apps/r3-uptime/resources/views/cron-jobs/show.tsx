/**
 * Cron-job monitor detail page. Shows the monitor's schedule/status, the copyable
 * ping URL with integration snippets, stats derived from ping history, and the
 * history itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type {
	SelectCronJobMonitor,
	SelectCronJobPing,
	SelectMonitorDailyStats,
} from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import * as s from "~/resources/styles";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

namespace CronJobShowView {
	export interface Props {
		team: { slug: string };
		monitor: SelectCronJobMonitor;
		pings: SelectCronJobPing[];
		pingUrl: string;
		dailyStats: SelectMonitorDailyStats[];
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	healthy: s.badgeUp,
	late: s.badgeDegraded,
	missed: s.badgeDown,
	new: s.badgeNeutral,
};

export default function CronJobShowView(handle: Handle<CronJobShowView.Props>) {
	return () => {
		let { team, monitor, pings, pingUrl, dailyStats } = handle.props;

		let totalPings = pings.length;
		let onTimeCount = pings.filter((ping) => ping.was_on_time).length;
		let onTimeRate = totalPings > 0 ? Math.round((onTimeCount / totalPings) * 100) : null;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>{monitor.name}</h1>
					<a
						href={routes.app.team.cronJobEdit.href({ team: team.slug, monitorId: monitor.id })}
						mix={[s.buttonSecondary]}
					>
						Edit
					</a>
				</div>

				{monitor.description && <p mix={[s.mutedSmall]}>{monitor.description}</p>}

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Schedule</div>
						<div mix={[s.statValue]}>
							{CronJobMonitor.describeCronExpression(monitor.cron_expression)}
						</div>
						<code>{monitor.cron_expression}</code>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Status</div>
						<span mix={[s.badge, STATUS_BADGE_MIX[monitor.status] ?? s.badgeNeutral]}>
							{monitor.status}
						</span>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Timezone</div>
						<div mix={[s.statValue]}>{monitor.timezone}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Grace period</div>
						<div mix={[s.statValue]}>{monitor.grace_period_seconds}s</div>
					</div>
				</div>

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Last ping</div>
						<div mix={[s.statValue]}>
							{monitor.last_ping_at === null
								? "Never"
								: new Date(monitor.last_ping_at).toLocaleString()}
						</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Next expected</div>
						<div mix={[s.statValue]}>
							{monitor.next_expected_at === null
								? "—"
								: new Date(monitor.next_expected_at).toLocaleString()}
						</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>On-time rate</div>
						<div mix={[s.statValue]}>{onTimeRate === null ? "—" : `${onTimeRate}%`}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Total pings</div>
						<div mix={[s.statValue]}>{totalPings}</div>
					</div>
				</div>

				<h2>Ping this monitor</h2>
				<p mix={[s.mutedSmall]}>
					Have your job send a POST request here after it finishes. No authentication required —
					treat this URL as a secret.
				</p>
				<pre mix={[s.mutedSmall]}>
					<code>POST {pingUrl}</code>
				</pre>
				<pre mix={[s.mutedSmall]}>
					<code>curl -X POST {pingUrl}</code>
				</pre>
				<pre mix={[s.mutedSmall]}>
					<code>0 * * * * your-job.sh &amp;&amp; curl -fsS -X POST {pingUrl}</code>
				</pre>

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				<h2>Ping history</h2>
				{pings.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No pings yet.</p>
					</div>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Time</th>
								<th>On time</th>
								<th>Source IP</th>
							</tr>
						</thead>
						<tbody>
							{pings.map((ping) => (
								<tr key={ping.id}>
									<td>{new Date(ping.created_at).toLocaleString()}</td>
									<td>
										<span mix={[s.badge, ping.was_on_time ? s.badgeUp : s.badgeDegraded]}>
											{ping.was_on_time ? "On time" : "Late"}
										</span>
									</td>
									<td>{ping.source_ip ?? "—"}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
