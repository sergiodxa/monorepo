/**
 * Cron-job monitor detail page. Shows the monitor's schedule/status, the copyable
 * ping URL with integration snippets, stats derived from ping history, and the
 * history itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

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

const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

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
				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					<h1>{monitor.name}</h1>
					<a
						href={routes.app.team.cronJobEdit.href({ team: team.slug, monitorId: monitor.id })}
						mix={[
							css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "8px 16px",
								borderRadius: 6,
								border: `2px solid ${neutral[300]}`,
								background: "#ffffff",
								color: neutral[500],
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: neutral[50] },
								"@media (prefers-color-scheme: dark)": {
									background: neutral[900],
									color: neutral[400],
									borderColor: neutral[700],
									"&:hover": { background: neutral[800] },
								},
							}),
						]}
					>
						Edit
					</a>
				</div>

				{monitor.description && (
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						{monitor.description}
					</p>
				)}

				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
					<div
						mix={[
							css({
								flex: "1 1 160px",
								padding: 16,
								borderRadius: 8,
								border: `1px solid ${neutral[200]}`,
								"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
							}),
						]}
					>
						<div
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							Schedule
						</div>
						<div mix={[css({ fontSize: "1.5rem", fontWeight: 700, lineHeight: "2rem" })]}>
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

				<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
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
				<p
					mix={[
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					Have your job send a POST request here after it finishes. No authentication required —
					treat this URL as a secret.
				</p>
				<pre
					mix={[
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					<code>POST {pingUrl}</code>
				</pre>
				<pre
					mix={[
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					<code>curl -X POST {pingUrl}</code>
				</pre>
				<pre
					mix={[
						css({
							fontSize: "0.8125rem",
							color: neutral[500],
							"@media (prefers-color-scheme: dark)": { color: neutral[400] },
						}),
					]}
				>
					<code>0 * * * * your-job.sh &amp;&amp; curl -fsS -X POST {pingUrl}</code>
				</pre>

				<h2>Uptime history</h2>
				<Heatmap days={dailyStats} />

				<h2>Ping history</h2>
				{pings.length === 0 ? (
					<EmptyState message="No pings yet." />
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
					</div>
				)}
			</div>
		);
	};
}
