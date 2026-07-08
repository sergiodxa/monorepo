/**
 * Team dashboard view. Shows stat cards (monitor count, 24h uptime, slowest response)
 * and a tabbed monitor table, one tab per monitor type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { MonitorHealth } from "~/app/services/analytics";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

export type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

const TABS: Array<{ id: DashboardTab; label: string }> = [
	{ id: "http", label: "HTTP" },
	{ id: "dns", label: "DNS" },
	{ id: "tcp", label: "TCP" },
	{ id: "cron-jobs", label: "Cron jobs" },
];

const HEALTH_BADGE_MIX: Record<MonitorHealth, typeof s.badgeUp> = {
	up: s.badgeUp,
	degraded: s.badgeDegraded,
	down: s.badgeDown,
	pending: s.badgeNeutral,
};

const DNS_STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	ok: s.badgeUp,
	changed: s.badgeDegraded,
	error: s.badgeDown,
};

const TCP_STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	up: s.badgeUp,
	timeout: s.badgeDegraded,
	down: s.badgeDown,
};

const CRON_JOB_STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	healthy: s.badgeUp,
	late: s.badgeDegraded,
	missed: s.badgeDown,
	new: s.badgeNeutral,
};

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
		monitorCount: number;
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		httpRows: Array<{ monitor: SelectMonitor; health: MonitorHealth }>;
		dnsMonitors: SelectDnsMonitor[];
		tcpMonitors: SelectTcpMonitor[];
		cronJobMonitors: SelectCronJobMonitor[];
		analyticsUnavailable: boolean;
	}
}

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				<h1>{props.team.name}</h1>

				{props.analyticsUnavailable && (
					<div mix={[s.emptyState]}>
						<p>Analytics data temporarily unavailable. Please retry later.</p>
					</div>
				)}

				<div mix={[s.statRow]}>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>HTTP monitors</div>
						<div mix={[s.statValue]}>{props.monitorCount}</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Uptime (24h)</div>
						<div mix={[s.statValue]}>
							{props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
						</div>
					</div>
					<div mix={[s.statCard]}>
						<div mix={[s.mutedSmall]}>Slowest response (24h)</div>
						<div mix={[s.statValue]}>
							{props.slowestResponseMs === null ? "—" : `${props.slowestResponseMs}ms`}
						</div>
					</div>
				</div>

				<nav mix={[s.row]}>
					{TABS.map((tab) => (
						<a
							key={tab.id}
							href={`${routes.app.team.dashboard.href({ team: props.team.slug })}?tab=${tab.id}`}
							aria-current={tab.id === props.tab ? "page" : undefined}
							mix={[s.link]}
						>
							{tab.label}
						</a>
					))}
				</nav>

				{props.tab === "http" && HttpTable({ team: props.team, rows: props.httpRows })}
				{props.tab === "dns" && DnsTable({ team: props.team, monitors: props.dnsMonitors })}
				{props.tab === "tcp" && TcpTable({ team: props.team, monitors: props.tcpMonitors })}
				{props.tab === "cron-jobs" &&
					CronJobsTable({ team: props.team, monitors: props.cronJobMonitors })}
			</div>
		);
	};
}

function HttpTable(props: {
	team: { slug: string };
	rows: Array<{ monitor: SelectMonitor; health: MonitorHealth }>;
}) {
	if (props.rows.length === 0) {
		return (
			<div mix={[s.emptyState]}>
				<p>No HTTP monitors yet.</p>
				<a
					href={routes.app.team.monitorNew.href({ team: props.team.slug })}
					mix={[s.buttonPrimary]}
				>
					Create your first monitor
				</a>
			</div>
		);
	}

	return (
		<table mix={[s.table]}>
			<thead>
				<tr>
					<th>Name</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{props.rows.map(({ monitor, health }) => (
					<tr key={monitor.id}>
						<td>
							<a
								href={routes.app.team.monitorShow.href({
									team: props.team.slug,
									monitorId: monitor.id,
								})}
								mix={[s.link]}
							>
								{monitor.name}
							</a>
						</td>
						<td>
							<span mix={[s.badge, HEALTH_BADGE_MIX[health]]}>{health}</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function DnsTable(props: { team: { slug: string }; monitors: SelectDnsMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<div mix={[s.emptyState]}>
				<p>No DNS monitors yet.</p>
				<a
					href={routes.app.team.dnsMonitorNew.href({ team: props.team.slug })}
					mix={[s.buttonPrimary]}
				>
					Create your first DNS monitor
				</a>
			</div>
		);
	}

	return (
		<table mix={[s.table]}>
			<thead>
				<tr>
					<th>Name</th>
					<th>Domain</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{props.monitors.map((monitor) => (
					<tr key={monitor.id}>
						<td>
							<a
								href={routes.app.team.dnsMonitorShow.href({
									team: props.team.slug,
									monitorId: monitor.id,
								})}
								mix={[s.link]}
							>
								{monitor.name}
							</a>
						</td>
						<td>
							<code>{monitor.domain}</code>
						</td>
						<td>
							<span
								mix={[s.badge, DNS_STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}
							>
								{monitor.last_status ?? "not checked"}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function TcpTable(props: { team: { slug: string }; monitors: SelectTcpMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<div mix={[s.emptyState]}>
				<p>No TCP monitors yet.</p>
				<a
					href={routes.app.team.tcpMonitorNew.href({ team: props.team.slug })}
					mix={[s.buttonPrimary]}
				>
					Create your first TCP monitor
				</a>
			</div>
		);
	}

	return (
		<table mix={[s.table]}>
			<thead>
				<tr>
					<th>Name</th>
					<th>Endpoint</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{props.monitors.map((monitor) => (
					<tr key={monitor.id}>
						<td>
							<a
								href={routes.app.team.tcpMonitorShow.href({
									team: props.team.slug,
									monitorId: monitor.id,
								})}
								mix={[s.link]}
							>
								{monitor.name}
							</a>
						</td>
						<td>
							<code>
								{monitor.host}:{monitor.port}
							</code>
						</td>
						<td>
							<span
								mix={[s.badge, TCP_STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}
							>
								{monitor.last_status ?? "pending"}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function CronJobsTable(props: { team: { slug: string }; monitors: SelectCronJobMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<div mix={[s.emptyState]}>
				<p>No cron job monitors yet.</p>
				<a
					href={routes.app.team.cronJobNew.href({ team: props.team.slug })}
					mix={[s.buttonPrimary]}
				>
					Create your first cron job monitor
				</a>
			</div>
		);
	}

	return (
		<table mix={[s.table]}>
			<thead>
				<tr>
					<th>Name</th>
					<th>Schedule</th>
					<th>Status</th>
				</tr>
			</thead>
			<tbody>
				{props.monitors.map((monitor) => (
					<tr key={monitor.id}>
						<td>
							<a
								href={routes.app.team.cronJobShow.href({
									team: props.team.slug,
									monitorId: monitor.id,
								})}
								mix={[s.link]}
							>
								{monitor.name}
							</a>
						</td>
						<td>{CronJobMonitor.describeCronExpression(monitor.cron_expression)}</td>
						<td>
							<span mix={[s.badge, CRON_JOB_STATUS_BADGE_MIX[monitor.status] ?? s.badgeNeutral]}>
								{monitor.status}
							</span>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
