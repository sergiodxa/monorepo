/**
 * Team dashboard view. Shows stat cards (monitor count, 24h uptime, slowest response)
 * and a tabbed monitor table, one tab per monitor type.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { MonitorHealth, SparklinePoint } from "~/app/services/analytics";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
import Sparkline from "~/resources/views/monitors/sparkline";
import routes from "~/routes/web";

export type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

const TABS: Array<{ id: DashboardTab; label: string }> = [
	{ id: "http", label: "HTTP" },
	{ id: "dns", label: "DNS" },
	{ id: "tcp", label: "TCP" },
	{ id: "cron-jobs", label: "Cron jobs" },
];

const HEALTH_BADGE_TONE: Record<MonitorHealth, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
	pending: "neutral",
};

const DNS_STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

const TCP_STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
};

const CRON_JOB_STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
		monitorCount: number;
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		httpRows: Array<{
			monitor: SelectMonitor;
			health: MonitorHealth;
			sparklinePoints: SparklinePoint[];
		}>;
		sslCounts: { valid: number; expiring: number; expired: number };
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
				{props.analyticsUnavailable && (
					<EmptyState message="Analytics data temporarily unavailable. Please retry later." />
				)}

				<div
					mix={[
						css({
							display: "flex",
							flexWrap: "wrap",
							gap: 16,
							marginBottom: 24,
						}),
					]}
				>
					<StatCard label="HTTP monitors" value={props.monitorCount} />
					<StatCard
						label="Uptime (24h)"
						value={props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
					/>
					<StatCard
						label="Slowest response (24h)"
						value={props.slowestResponseMs === null ? "—" : `${props.slowestResponseMs}ms`}
					/>
					<StatCard
						label="SSL certificates"
						value={
							<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 8 })]}>
								<Badge tone="up">{props.sslCounts.valid} valid</Badge>
								<Badge tone="degraded">{props.sslCounts.expiring} expiring</Badge>
								<Badge tone="down">{props.sslCounts.expired} expired</Badge>
							</div>
						}
					/>
				</div>

				<nav
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							gap: 12,
							marginBottom: 16,
							paddingBottom: 12,
							borderBottom: "1px solid oklch(0.91 0.008 145)",
							"@media (prefers-color-scheme: dark)": {
								borderColor: "oklch(0.32 0.006 145)",
							},
						}),
					]}
				>
					{TABS.map((tab) => (
						<a
							key={tab.id}
							href={`${routes.app.team.dashboard.href({ team: props.team.slug })}?tab=${tab.id}`}
							aria-current={tab.id === props.tab ? "page" : undefined}
							mix={[
								css({
									color: "oklch(0.6 0.16 142)",
									textDecoration: "none",
									"&:hover": { textDecoration: "underline" },
									"@media (prefers-color-scheme: dark)": {
										color: "oklch(0.78 0.16 142)",
									},
								}),
							]}
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
	rows: Array<{ monitor: SelectMonitor; health: MonitorHealth; sparklinePoints: SparklinePoint[] }>;
}) {
	if (props.rows.length === 0) {
		return (
			<EmptyState
				message="No HTTP monitors yet."
				action={{
					href: routes.app.team.monitorNew.href({ team: props.team.slug }),
					label: "Create your first monitor",
				}}
			/>
		);
	}

	return (
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
							borderBottom: "1px solid oklch(0.91 0.008 145)",
						},
						"@media (prefers-color-scheme: dark)": {
							"& th, & td": { borderColor: "oklch(0.32 0.006 145)" },
						},
					}),
				]}
			>
				<thead>
					<tr>
						<th>Name</th>
						<th>Latency trend</th>
						<th>Status</th>
					</tr>
				</thead>
				<tbody>
					{props.rows.map(({ monitor, health, sparklinePoints }) => (
						<tr key={monitor.id}>
							<td>
								<a
									href={routes.app.team.monitorShow.href({
										team: props.team.slug,
										monitorId: monitor.id,
									})}
									mix={[
										css({
											color: "oklch(0.6 0.16 142)",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
											"@media (prefers-color-scheme: dark)": {
												color: "oklch(0.78 0.16 142)",
											},
										}),
									]}
								>
									{monitor.name}
								</a>
							</td>
							<td>
								<div mix={[css({ color: "oklch(0.6 0.16 142)" })]}>
									<Sparkline points={sparklinePoints} />
								</div>
							</td>
							<td>
								<Badge tone={HEALTH_BADGE_TONE[health]}>{health}</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function DnsTable(props: { team: { slug: string }; monitors: SelectDnsMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<EmptyState
				message="No DNS monitors yet."
				action={{
					href: routes.app.team.dnsMonitorNew.href({ team: props.team.slug }),
					label: "Create your first DNS monitor",
				}}
			/>
		);
	}

	return (
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
							borderBottom: "1px solid oklch(0.91 0.008 145)",
						},
						"@media (prefers-color-scheme: dark)": {
							"& th, & td": { borderColor: "oklch(0.32 0.006 145)" },
						},
					}),
				]}
			>
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
									mix={[
										css({
											color: "oklch(0.6 0.16 142)",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
											"@media (prefers-color-scheme: dark)": {
												color: "oklch(0.78 0.16 142)",
											},
										}),
									]}
								>
									{monitor.name}
								</a>
							</td>
							<td>
								<code>{monitor.domain}</code>
							</td>
							<td>
								<Badge tone={DNS_STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
									{monitor.last_status ?? "not checked"}
								</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function TcpTable(props: { team: { slug: string }; monitors: SelectTcpMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<EmptyState
				message="No TCP monitors yet."
				action={{
					href: routes.app.team.tcpMonitorNew.href({ team: props.team.slug }),
					label: "Create your first TCP monitor",
				}}
			/>
		);
	}

	return (
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
							borderBottom: "1px solid oklch(0.91 0.008 145)",
						},
						"@media (prefers-color-scheme: dark)": {
							"& th, & td": { borderColor: "oklch(0.32 0.006 145)" },
						},
					}),
				]}
			>
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
									mix={[
										css({
											color: "oklch(0.6 0.16 142)",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
											"@media (prefers-color-scheme: dark)": {
												color: "oklch(0.78 0.16 142)",
											},
										}),
									]}
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
								<Badge tone={TCP_STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
									{monitor.last_status ?? "pending"}
								</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

function CronJobsTable(props: { team: { slug: string }; monitors: SelectCronJobMonitor[] }) {
	if (props.monitors.length === 0) {
		return (
			<EmptyState
				message="No cron job monitors yet."
				action={{
					href: routes.app.team.cronJobNew.href({ team: props.team.slug }),
					label: "Create your first cron job monitor",
				}}
			/>
		);
	}

	return (
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
							borderBottom: "1px solid oklch(0.91 0.008 145)",
						},
						"@media (prefers-color-scheme: dark)": {
							"& th, & td": { borderColor: "oklch(0.32 0.006 145)" },
						},
					}),
				]}
			>
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
									mix={[
										css({
											color: "oklch(0.6 0.16 142)",
											textDecoration: "none",
											"&:hover": { textDecoration: "underline" },
											"@media (prefers-color-scheme: dark)": {
												color: "oklch(0.78 0.16 142)",
											},
										}),
									]}
								>
									{monitor.name}
								</a>
							</td>
							<td>{CronJobMonitor.describeCronExpression(monitor.cron_expression)}</td>
							<td>
								<Badge tone={CRON_JOB_STATUS_BADGE_TONE[monitor.status] ?? "neutral"}>
									{monitor.status}
								</Badge>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
