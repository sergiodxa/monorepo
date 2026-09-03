/**
 * Dashboard tab-panel fragment controller. GET /app/:team/dashboard/panel/:type
 * loads and renders one monitor type's table with no document shell, so the
 * dashboard's `Frame` can swap it in without a full page reload. Alongside the tab
 * bar it renders `RefreshFrameButton`, which reloads the same `Frame` from the
 * current tab's fragment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { ActivityIcon, ClockIcon, GlobeIcon, NetworkIcon, PlusIcon } from "@sdxc/icons";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { fg } from "@sdxc/u/color";
import { absolute, flex, insBe, insBs, insIe, items, justify, relative } from "@sdxc/u/layout";
import { is, mbe } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { textDecoration } from "@sdxc/u/typography";
import { Badge, Empty, LinkButton, Table, Tabs } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { link } from "remix/ui";

import type { MonitorHealth, SparklinePoint } from "~/app/services/analytics";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { describeSchedule } from "~/app/lib/cron-text";
import { getTeamHttpSparklines, getTeamHttpSummaries } from "~/app/services/analytics";
import { badgeVariant } from "~/resources/components/badge";
import RefreshFrameButton from "~/resources/components/refresh-frame-button";
import Sparkline from "~/resources/views/monitors/sparkline";
import routes from "~/routes/web";

const DASHBOARD_TABS = ["http", "dns", "tcp", "cron-jobs"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

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

/**
 * Short, private cache window: long enough that a `<link rel="prefetch">` for an
 * inactive tab is reused by the real `Frame` fetch moments later, short enough that
 * monitor status stays fresh for someone who leaves the tab open.
 */
const CACHE_CONTROL = "private, max-age=5";

namespace DashboardPanel {
	interface Common {
		team: { slug: string };
		tabLabels: Record<DashboardTab, string>;
		/** Accessible label for the tab list, e.g. "Monitor type". */
		tabsListLabel: string;
		/** Accessible label for the active tab's panel, e.g. "HTTP monitors". */
		panelLabel: string;
		/** Label for the control that re-navigates the frame to the current tab, e.g. "Refresh". */
		refreshLabel: string;
		/**
		 * Per-render value appended to the refresh control's frame `src`, so clicking it
		 * always reaches the server instead of being answered from the browser cache by an
		 * earlier response still inside its {@link CACHE_CONTROL} window.
		 */
		refreshToken: string;
	}

	export type Props = Common &
		(
			| {
					tab: "http";
					httpRows: Array<{
						monitor: SelectMonitor;
						health: MonitorHealth;
						sparklinePoints: SparklinePoint[];
					}>;
					copy: {
						emptyTitle: string;
						emptyDescription: string;
						emptyCta: string;
						tableLabel: string;
						columns: { name: string; latencyChart: string; status: string };
						statusLabels: Record<MonitorHealth, string>;
					};
			  }
			| {
					tab: "dns";
					dnsMonitors: SelectDnsMonitor[];
					copy: {
						emptyTitle: string;
						emptyDescription: string;
						emptyCta: string;
						tableLabel: string;
						columns: { name: string; domain: string; status: string };
						notChecked: string;
					};
			  }
			| {
					tab: "tcp";
					tcpMonitors: SelectTcpMonitor[];
					copy: {
						emptyTitle: string;
						emptyDescription: string;
						emptyCta: string;
						tableLabel: string;
						columns: { name: string; endpoint: string; status: string };
						statusLabels: Record<string, string>;
					};
			  }
			| {
					tab: "cron-jobs";
					cronJobRows: CronJobRow[];
					copy: {
						emptyTitle: string;
						emptyDescription: string;
						emptyCta: string;
						tableLabel: string;
						columns: { name: string; schedule: string; status: string };
						statusLabels: Record<string, string>;
					};
			  }
		);
}

/**
 * Renders the tab bar plus the table for whichever tab {@link DashboardPanel.Props.tab}
 * names. The wrapper keeps the tab bar at full width so its block-end border spans the
 * row, with the refresh control absolutely positioned over the row's trailing end.
 */
function DashboardPanel(handle: Handle<DashboardPanel.Props>) {
	return () => {
		let props = handle.props;
		let refreshHref = `${routes.app.team.dashboard.index.href({ team: props.team.slug })}?tab=${props.tab}`;
		let refreshSrc = `${routes.app.team.dashboard.panel.href({
			team: props.team.slug,
			type: props.tab,
		})}?refresh=${props.refreshToken}`;

		return (
			<>
				{DASHBOARD_TABS.filter((tab) => tab !== props.tab).map((tab) => (
					<link
						key={tab}
						rel="prefetch"
						as="fetch"
						href={routes.app.team.dashboard.panel.href({ team: props.team.slug, type: tab })}
					/>
				))}

				<div mix={[relative(), mbe(4)]}>
					<Tabs>
						<Tabs.List
							aria-label={props.tabsListLabel}
							activeIndex={DASHBOARD_TABS.findIndex((tab) => tab === props.tab)}
							tabSize="110px"
						>
							{DASHBOARD_TABS.map((tab) => {
								let href = `${routes.app.team.dashboard.index.href({ team: props.team.slug })}?tab=${tab}`;
								let frameSrc = routes.app.team.dashboard.panel.href({
									team: props.team.slug,
									type: tab,
								});

								return (
									<Tabs.Tab
										key={tab}
										href={href}
										aria-selected={tab === props.tab}
										aria-controls="dashboard-panel-content"
										tabIndex={tab === props.tab ? 0 : -1}
										mix={[
											is("110px"),
											justify("center"),
											link(href, { target: "dashboard-panel", src: frameSrc }),
										]}
									>
										{props.tabLabels[tab]}
									</Tabs.Tab>
								);
							})}
						</Tabs.List>
					</Tabs>

					<div mix={[absolute(), insIe(0), insBs(0), insBe(0), flex(), items("center")]}>
						<RefreshFrameButton
							href={refreshHref}
							src={refreshSrc}
							target="dashboard-panel"
							label={props.refreshLabel}
						/>
					</div>
				</div>

				<div id="dashboard-panel-content" role="tabpanel" aria-label={props.panelLabel}>
					{props.tab === "http" && (
						<HttpTable team={props.team} rows={props.httpRows} copy={props.copy} />
					)}
					{props.tab === "dns" && (
						<DnsTable team={props.team} monitors={props.dnsMonitors} copy={props.copy} />
					)}
					{props.tab === "tcp" && (
						<TcpTable team={props.team} monitors={props.tcpMonitors} copy={props.copy} />
					)}
					{props.tab === "cron-jobs" && (
						<CronJobsTable team={props.team} rows={props.cronJobRows} copy={props.copy} />
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
		copy: {
			emptyTitle: string;
			emptyDescription: string;
			emptyCta: string;
			tableLabel: string;
			columns: { name: string; latencyChart: string; status: string };
			statusLabels: Record<MonitorHealth, string>;
		};
	}
}

function HttpTable(handle: Handle<HttpTable.Props>) {
	return () => {
		let { team, rows, copy } = handle.props;

		if (rows.length === 0) {
			return (
				<Empty>
					<Empty.Icon>
						<ActivityIcon size={24} strokeWidth={1.5} />
					</Empty.Icon>
					<Empty.Title>{copy.emptyTitle}</Empty.Title>
					<Empty.Description>{copy.emptyDescription}</Empty.Description>
					<Empty.Action>
						<LinkButton href={routes.app.team.monitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							{copy.emptyCta}
						</LinkButton>
					</Empty.Action>
				</Empty>
			);
		}

		return (
			<Table.Container>
				<Table aria-label={copy.tableLabel}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{copy.columns.name}</Table.Column>
							<Table.Column>{copy.columns.latencyChart}</Table.Column>
							<Table.Column>{copy.columns.status}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map(({ monitor, health, sparklinePoints }) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<a
										href={routes.app.team.monitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
									>
										{monitor.name}
									</a>
								</Table.Cell>
								<Table.Cell>
									<div mix={fg("brand")}>
										<Sparkline points={sparklinePoints} />
									</div>
								</Table.Cell>
								<Table.Cell>
									<Badge {...badgeVariant(HEALTH_BADGE_TONE[health])}>
										{copy.statusLabels[health]}
									</Badge>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace DnsTable {
	export interface Props {
		team: { slug: string };
		monitors: SelectDnsMonitor[];
		copy: {
			emptyTitle: string;
			emptyDescription: string;
			emptyCta: string;
			tableLabel: string;
			columns: { name: string; domain: string; status: string };
			notChecked: string;
		};
	}
}

/**
 * A DNS monitor is a whole domain, so a row here names the domain and its last outcome
 * only: record counts are a second query this glance-only tab skips, owned instead by
 * the list page and the monitor's own page.
 */
function DnsTable(handle: Handle<DnsTable.Props>) {
	return () => {
		let { team, monitors, copy } = handle.props;

		if (monitors.length === 0) {
			return (
				<Empty>
					<Empty.Icon>
						<GlobeIcon size={24} strokeWidth={1.5} />
					</Empty.Icon>
					<Empty.Title>{copy.emptyTitle}</Empty.Title>
					<Empty.Description>{copy.emptyDescription}</Empty.Description>
					<Empty.Action>
						<LinkButton href={routes.app.team.dnsMonitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							{copy.emptyCta}
						</LinkButton>
					</Empty.Action>
				</Empty>
			);
		}

		return (
			<Table.Container>
				<Table aria-label={copy.tableLabel}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{copy.columns.name}</Table.Column>
							<Table.Column>{copy.columns.domain}</Table.Column>
							<Table.Column>{copy.columns.status}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{monitors.map((monitor) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<a
										href={routes.app.team.dnsMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
									>
										{monitor.name}
									</a>
								</Table.Cell>
								<Table.Cell>
									<code>{monitor.domain}</code>
								</Table.Cell>
								<Table.Cell>
									<Badge
										{...badgeVariant(DNS_STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{monitor.last_status ?? copy.notChecked}
									</Badge>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace TcpTable {
	export interface Props {
		team: { slug: string };
		monitors: SelectTcpMonitor[];
		copy: {
			emptyTitle: string;
			emptyDescription: string;
			emptyCta: string;
			tableLabel: string;
			columns: { name: string; endpoint: string; status: string };
			statusLabels: Record<string, string>;
		};
	}
}

function TcpTable(handle: Handle<TcpTable.Props>) {
	return () => {
		let { team, monitors, copy } = handle.props;

		if (monitors.length === 0) {
			return (
				<Empty>
					<Empty.Icon>
						<NetworkIcon size={24} strokeWidth={1.5} />
					</Empty.Icon>
					<Empty.Title>{copy.emptyTitle}</Empty.Title>
					<Empty.Description>{copy.emptyDescription}</Empty.Description>
					<Empty.Action>
						<LinkButton href={routes.app.team.tcpMonitors.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							{copy.emptyCta}
						</LinkButton>
					</Empty.Action>
				</Empty>
			);
		}

		return (
			<Table.Container>
				<Table aria-label={copy.tableLabel}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{copy.columns.name}</Table.Column>
							<Table.Column>{copy.columns.endpoint}</Table.Column>
							<Table.Column>{copy.columns.status}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{monitors.map((monitor) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<a
										href={routes.app.team.tcpMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
									>
										{monitor.name}
									</a>
								</Table.Cell>
								<Table.Cell>
									<code>
										{monitor.host}:{monitor.port}
									</code>
								</Table.Cell>
								<Table.Cell>
									<Badge
										{...badgeVariant(TCP_STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{copy.statusLabels[monitor.last_status ?? "pending"] ?? monitor.last_status}
									</Badge>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/**
 * A cron-job monitor together with its schedule already described in the viewer's
 * language, built by the controller since the tables here render with no request
 * context to build the sentence themselves.
 */
interface CronJobRow {
	monitor: SelectCronJobMonitor;
	schedule: string;
}

namespace CronJobsTable {
	export interface Props {
		team: { slug: string };
		rows: CronJobRow[];
		copy: {
			emptyTitle: string;
			emptyDescription: string;
			emptyCta: string;
			tableLabel: string;
			columns: { name: string; schedule: string; status: string };
			statusLabels: Record<string, string>;
		};
	}
}

function CronJobsTable(handle: Handle<CronJobsTable.Props>) {
	return () => {
		let { team, rows, copy } = handle.props;

		if (rows.length === 0) {
			return (
				<Empty>
					<Empty.Icon>
						<ClockIcon size={24} strokeWidth={1.5} />
					</Empty.Icon>
					<Empty.Title>{copy.emptyTitle}</Empty.Title>
					<Empty.Description>{copy.emptyDescription}</Empty.Description>
					<Empty.Action>
						<LinkButton href={routes.app.team.cronJobs.new.href({ team: team.slug })}>
							<PlusIcon size={20} strokeWidth={1.5} />
							{copy.emptyCta}
						</LinkButton>
					</Empty.Action>
				</Empty>
			);
		}

		return (
			<Table.Container>
				<Table aria-label={copy.tableLabel}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{copy.columns.name}</Table.Column>
							<Table.Column>{copy.columns.schedule}</Table.Column>
							<Table.Column>{copy.columns.status}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map(({ monitor, schedule }) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<a
										href={routes.app.team.cronJobs.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
										mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
									>
										{monitor.name}
									</a>
								</Table.Cell>
								<Table.Cell>{schedule}</Table.Cell>
								<Table.Cell>
									<Badge {...badgeVariant(CRON_JOB_STATUS_BADGE_TONE[monitor.status] ?? "neutral")}>
										{copy.statusLabels[monitor.status] ?? monitor.status}
									</Badge>
								</Table.Cell>
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/** GET /app/:team/dashboard/panel/:type — one monitor-type table, fragment-only. */
export default createAction(routes.app.team.dashboard.panel, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { type } = s.parse(s.object({ type: s.enum_(DASHBOARD_TABS) }), ctx.params);
		let headers = { "Cache-Control": CACHE_CONTROL };

		let tabLabels: Record<DashboardTab, string> = {
			http: ctx.i18next.t("page.dashboard.tabs.http"),
			dns: ctx.i18next.t("page.dashboard.tabs.dns"),
			tcp: ctx.i18next.t("page.dashboard.tabs.tcp"),
			"cron-jobs": ctx.i18next.t("page.dashboard.tabs.cronJobs"),
		};
		let tabsListLabel = ctx.i18next.t("page.dashboard.panel.tabsLabel");
		let panelLabel = ctx.i18next.t("page.dashboard.panel.tabPanelLabel", { tab: tabLabels[type] });
		let refreshLabel = ctx.i18next.t("page.dashboard.panel.refresh");
		let refreshToken = String(Date.now());

		if (type === "dns") {
			let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.team.id);
			return ctx.render(
				<DashboardPanel
					tab="dns"
					team={ctx.team}
					dnsMonitors={dnsMonitors}
					tabLabels={tabLabels}
					tabsListLabel={tabsListLabel}
					panelLabel={panelLabel}
					refreshLabel={refreshLabel}
					refreshToken={refreshToken}
					copy={{
						emptyTitle: ctx.i18next.t("page.dnsMonitors.empty.title"),
						emptyDescription: ctx.i18next.t("page.dnsMonitors.empty.description"),
						emptyCta: ctx.i18next.t("page.dnsMonitors.empty.cta"),
						tableLabel: ctx.i18next.t("page.dnsMonitors.table.label"),
						columns: {
							name: ctx.i18next.t("page.dnsMonitors.table.columns.name"),
							domain: ctx.i18next.t("page.dnsMonitors.table.columns.domain"),
							status: ctx.i18next.t("page.dnsMonitors.table.columns.status"),
						},
						notChecked: ctx.i18next.t("page.dnsMonitors.table.notChecked"),
					}}
				/>,
				{ headers },
			);
		}

		if (type === "tcp") {
			let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.team.id);
			return ctx.render(
				<DashboardPanel
					tab="tcp"
					team={ctx.team}
					tcpMonitors={tcpMonitors}
					tabLabels={tabLabels}
					tabsListLabel={tabsListLabel}
					panelLabel={panelLabel}
					refreshLabel={refreshLabel}
					refreshToken={refreshToken}
					copy={{
						emptyTitle: ctx.i18next.t("page.tcpMonitors.empty.title"),
						emptyDescription: ctx.i18next.t("page.tcpMonitors.empty.description"),
						emptyCta: ctx.i18next.t("page.tcpMonitors.empty.cta"),
						tableLabel: ctx.i18next.t("page.tcpMonitors.table.label"),
						columns: {
							name: ctx.i18next.t("page.tcpMonitors.table.columns.name"),
							endpoint: ctx.i18next.t("page.tcpMonitors.table.columns.endpoint"),
							status: ctx.i18next.t("page.tcpMonitors.table.columns.status"),
						},
						statusLabels: {
							up: ctx.i18next.t("page.tcpMonitors.table.status.up"),
							down: ctx.i18next.t("page.tcpMonitors.table.status.down"),
							timeout: ctx.i18next.t("page.tcpMonitors.table.status.timeout"),
							pending: ctx.i18next.t("page.tcpMonitors.table.status.pending"),
						},
					}}
				/>,
				{ headers },
			);
		}

		if (type === "cron-jobs") {
			let cronJobMonitors = await CronJobMonitor.listByTeam(db, ctx.team.id);
			let cronJobRows: CronJobRow[] = cronJobMonitors.map((monitor) => ({
				monitor,
				schedule: describeSchedule(monitor.cron_expression, {
					locale: ctx.locale,
					t: ctx.i18next.t,
				}),
			}));
			return ctx.render(
				<DashboardPanel
					tab="cron-jobs"
					team={ctx.team}
					cronJobRows={cronJobRows}
					tabLabels={tabLabels}
					tabsListLabel={tabsListLabel}
					panelLabel={panelLabel}
					refreshLabel={refreshLabel}
					refreshToken={refreshToken}
					copy={{
						emptyTitle: ctx.i18next.t("page.cronJobs.empty.title"),
						emptyDescription: ctx.i18next.t("page.cronJobs.empty.description"),
						emptyCta: ctx.i18next.t("page.cronJobs.empty.cta"),
						tableLabel: ctx.i18next.t("page.cronJobs.table.label"),
						columns: {
							name: ctx.i18next.t("page.cronJobs.table.columns.name"),
							schedule: ctx.i18next.t("page.cronJobs.table.columns.schedule"),
							status: ctx.i18next.t("page.cronJobs.table.columns.status"),
						},
						statusLabels: {
							healthy: ctx.i18next.t("page.cronJobs.table.status.healthy"),
							late: ctx.i18next.t("page.cronJobs.table.status.late"),
							missed: ctx.i18next.t("page.cronJobs.table.status.missed"),
							new: ctx.i18next.t("page.cronJobs.table.status.new"),
						},
					}}
				/>,
				{ headers },
			);
		}

		let [monitors, summaries, sparklines] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
			getTeamHttpSparklines(ctx.team.id),
		]);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let sparklinesByMonitorId: Map<string, SparklinePoint[]> = isFailure(sparklines)
			? new Map()
			: sparklines.data;
		let healthByMonitorId = new Map(
			summaryList.map((summary) => [summary.monitorId, summary.health]),
		);
		let httpRows = monitors.map((monitor) => ({
			monitor,
			health: healthByMonitorId.get(monitor.id) ?? ("pending" as MonitorHealth),
			sparklinePoints: sparklinesByMonitorId.get(monitor.id) ?? [],
		}));

		return ctx.render(
			<DashboardPanel
				tab="http"
				team={ctx.team}
				httpRows={httpRows}
				tabLabels={tabLabels}
				tabsListLabel={tabsListLabel}
				panelLabel={panelLabel}
				refreshLabel={refreshLabel}
				refreshToken={refreshToken}
				copy={{
					emptyTitle: ctx.i18next.t("page.dashboard.empty.title"),
					emptyDescription: ctx.i18next.t("page.dashboard.empty.description"),
					emptyCta: ctx.i18next.t("page.dashboard.empty.cta"),
					tableLabel: ctx.i18next.t("page.dashboard.table.label"),
					columns: {
						name: ctx.i18next.t("page.dashboard.table.columns.name"),
						latencyChart: ctx.i18next.t("page.dashboard.table.columns.latencyChart"),
						status: ctx.i18next.t("page.dashboard.table.columns.status"),
					},
					statusLabels: {
						up: ctx.i18next.t("page.dashboard.table.status.up"),
						degraded: ctx.i18next.t("page.dashboard.table.status.degraded"),
						down: ctx.i18next.t("page.dashboard.table.status.down"),
						pending: ctx.i18next.t("page.dashboard.table.status.unknown"),
					},
				}}
			/>,
			{ headers },
		);
	}),
});
