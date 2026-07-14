/**
 * The dashboard's tab bar and tab-panel fragment: rendered together, with no
 * document shell, so a named `Frame` reload keeps the tab bar's active state in
 * sync with whichever monitor-type table it swapped in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ActivityIcon, ClockIcon, GlobeIcon, NetworkIcon, PlusIcon } from "@pkg/lucide-remix";
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
import {
	Empty,
	EmptyAction,
	EmptyDescription,
	EmptyIcon,
	EmptyTitle,
} from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import { Tab, TabList } from "~/resources/components/tabs";
import { neutral, primary } from "~/resources/theme";
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

const linkColor = css({
	color: primary[600],
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": { color: primary[400] },
});

const table = css({
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
});

namespace DashboardPanelView {
	export type Props =
		| {
				tab: "http";
				team: { slug: string };
				httpRows: Array<{
					monitor: SelectMonitor;
					health: MonitorHealth;
					sparklinePoints: SparklinePoint[];
				}>;
		  }
		| { tab: "dns"; team: { slug: string }; dnsMonitors: SelectDnsMonitor[] }
		| { tab: "tcp"; team: { slug: string }; tcpMonitors: SelectTcpMonitor[] }
		| { tab: "cron-jobs"; team: { slug: string }; cronJobMonitors: SelectCronJobMonitor[] };
}

/** Renders the tab bar plus the table for whichever tab {@link DashboardPanelView.Props.tab} names. */
export default function DashboardPanelView(handle: Handle<DashboardPanelView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<>
				{/*
				 * Native browser prefetch for every inactive tab's fragment — no JS
				 * trigger needed, the browser fetches these as soon as it parses them.
				 * Reused by the click-triggered `Frame` fetch since both requests hit
				 * the same URL and the controller responds with a short `Cache-Control`.
				 */}
				{TABS.filter((tab) => tab.id !== props.tab).map((tab) => (
					<link
						key={tab.id}
						rel="prefetch"
						as="fetch"
						href={routes.app.team.dashboard.panel.href({ team: props.team.slug, type: tab.id })}
					/>
				))}

				<TabList
					aria-label="Monitor type"
					activeIndex={TABS.findIndex((tab) => tab.id === props.tab)}
				>
					{TABS.map((tab) => (
						<Tab
							key={tab.id}
							href={`${routes.app.team.dashboard.index.href({ team: props.team.slug })}?tab=${tab.id}`}
							frameSrc={routes.app.team.dashboard.panel.href({
								team: props.team.slug,
								type: tab.id,
							})}
							active={tab.id === props.tab}
							controls="dashboard-panel-content"
							frameTarget="dashboard-panel"
						>
							{tab.label}
						</Tab>
					))}
				</TabList>

				<div id="dashboard-panel-content" role="tabpanel" aria-label={`${props.tab} monitors`}>
					{props.tab === "http" && <HttpTable team={props.team} rows={props.httpRows} />}
					{props.tab === "dns" && <DnsTable team={props.team} monitors={props.dnsMonitors} />}
					{props.tab === "tcp" && <TcpTable team={props.team} monitors={props.tcpMonitors} />}
					{props.tab === "cron-jobs" && (
						<CronJobsTable team={props.team} monitors={props.cronJobMonitors} />
					)}
				</div>
			</>
		);
	};
}

namespace HttpTable {
	export interface Props {
		team: { slug: string };
		rows: Array<{
			monitor: SelectMonitor;
			health: MonitorHealth;
			sparklinePoints: SparklinePoint[];
		}>;
	}
}

function HttpTable(handle: Handle<HttpTable.Props>) {
	return () => {
		let { team, rows } = handle.props;

		if (rows.length === 0) {
			return (
				<Empty>
					<EmptyIcon>
						<ActivityIcon size={48} strokeWidth={1.5} />
					</EmptyIcon>
					<EmptyTitle>No HTTP monitors yet</EmptyTitle>
					<EmptyDescription>
						Create an HTTP monitor to start tracking your endpoints.
					</EmptyDescription>
					<EmptyAction>
						<LinkButton href={routes.app.team.monitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							Create Monitor
						</LinkButton>
					</EmptyAction>
				</Empty>
			);
		}

		return (
			<div mix={[css({ overflowX: "auto" })]}>
				<table mix={[table]}>
					<thead>
						<tr>
							<th>Name</th>
							<th>Latency trend</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{rows.map(({ monitor, health, sparklinePoints }) => (
							<tr key={monitor.id}>
								<td>
									<a
										href={routes.app.team.monitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[linkColor]}
									>
										{monitor.name}
									</a>
								</td>
								<td>
									<div mix={[css({ color: primary[600] })]}>
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
	};
}

namespace DnsTable {
	export interface Props {
		team: { slug: string };
		monitors: SelectDnsMonitor[];
	}
}

function DnsTable(handle: Handle<DnsTable.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		if (monitors.length === 0) {
			return (
				<Empty>
					<EmptyIcon>
						<GlobeIcon size={48} strokeWidth={1.5} />
					</EmptyIcon>
					<EmptyTitle>No DNS monitors yet</EmptyTitle>
					<EmptyDescription>Create a DNS monitor to track DNS record changes.</EmptyDescription>
					<EmptyAction>
						<LinkButton href={routes.app.team.dnsMonitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							Create DNS Monitor
						</LinkButton>
					</EmptyAction>
				</Empty>
			);
		}

		return (
			<div mix={[css({ overflowX: "auto" })]}>
				<table mix={[table]}>
					<thead>
						<tr>
							<th>Name</th>
							<th>Domain</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{monitors.map((monitor) => (
							<tr key={monitor.id}>
								<td>
									<a
										href={routes.app.team.dnsMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[linkColor]}
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
	};
}

namespace TcpTable {
	export interface Props {
		team: { slug: string };
		monitors: SelectTcpMonitor[];
	}
}

function TcpTable(handle: Handle<TcpTable.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		if (monitors.length === 0) {
			return (
				<Empty>
					<EmptyIcon>
						<NetworkIcon size={48} strokeWidth={1.5} />
					</EmptyIcon>
					<EmptyTitle>No TCP monitors yet</EmptyTitle>
					<EmptyDescription>
						Create a TCP monitor to check if ports are open and responsive.
					</EmptyDescription>
					<EmptyAction>
						<LinkButton href={routes.app.team.tcpMonitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							Create TCP Monitor
						</LinkButton>
					</EmptyAction>
				</Empty>
			);
		}

		return (
			<div mix={[css({ overflowX: "auto" })]}>
				<table mix={[table]}>
					<thead>
						<tr>
							<th>Name</th>
							<th>Endpoint</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{monitors.map((monitor) => (
							<tr key={monitor.id}>
								<td>
									<a
										href={routes.app.team.tcpMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[linkColor]}
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
	};
}

namespace CronJobsTable {
	export interface Props {
		team: { slug: string };
		monitors: SelectCronJobMonitor[];
	}
}

function CronJobsTable(handle: Handle<CronJobsTable.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		if (monitors.length === 0) {
			return (
				<Empty>
					<EmptyIcon>
						<ClockIcon size={48} strokeWidth={1.5} />
					</EmptyIcon>
					<EmptyTitle>No cron jobs yet</EmptyTitle>
					<EmptyDescription>
						Create a cron job monitor to track your scheduled tasks.
					</EmptyDescription>
					<EmptyAction>
						<LinkButton href={routes.app.team.cronJobs.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							Create Cron Job
						</LinkButton>
					</EmptyAction>
				</Empty>
			);
		}

		return (
			<div mix={[css({ overflowX: "auto" })]}>
				<table mix={[table]}>
					<thead>
						<tr>
							<th>Name</th>
							<th>Schedule</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{monitors.map((monitor) => (
							<tr key={monitor.id}>
								<td>
									<a
										href={routes.app.team.cronJobs.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[linkColor]}
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
	};
}
