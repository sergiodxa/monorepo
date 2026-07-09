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
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
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

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
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
					<StatCard
						label="Status"
						value={
							<Badge tone={STATUS_BADGE_TONE[monitor.status] ?? "neutral"}>{monitor.status}</Badge>
						}
					/>
					<StatCard label="Timezone" value={monitor.timezone} />
					<StatCard label="Grace period" value={`${monitor.grace_period_seconds}s`} />
				</div>

				<div mix={[s.statRow]}>
					<StatCard
						label="Last ping"
						value={
							monitor.last_ping_at === null
								? "Never"
								: new Date(monitor.last_ping_at).toLocaleString()
						}
					/>
					<StatCard
						label="Next expected"
						value={
							monitor.next_expected_at === null
								? "—"
								: new Date(monitor.next_expected_at).toLocaleString()
						}
					/>
					<StatCard label="On-time rate" value={onTimeRate === null ? "—" : `${onTimeRate}%`} />
					<StatCard label="Total pings" value={totalPings} />
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
					<EmptyState message="No pings yet." />
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
										<Badge tone={ping.was_on_time ? "up" : "degraded"}>
											{ping.was_on_time ? "On time" : "Late"}
										</Badge>
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
