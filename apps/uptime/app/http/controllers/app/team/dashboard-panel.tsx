/**
 * Dashboard tab-panel fragment controller. GET /app/:team/dashboard/panel/:type
 * loads and renders one monitor type's table with no document shell, so the
 * dashboard's `Frame` swaps it in without a full page reload.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { ActivityIcon, ClockIcon, GlobeIcon, NetworkIcon, PlusIcon } from "@sdxc/icons";
import { isFailure } from "@sdxc/result";
import { justify } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { LinkButton, Tabs } from "@sdxc/ui";
import { AutoRefresh, Empty, Sparkline, Table } from "@sdxc/ui/app";
import { link } from "remix/component";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { MonitorHealth, SparklinePoint } from "~/app/services/analytics";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSparklines, getTeamHttpSummaries } from "~/app/services/analytics";
import { describeSchedule } from "~/app/services/cron-text";
import PanelToolbar from "~/resources/views/dashboard/panel-toolbar";
import routes from "~/routes/web";

const DASHBOARD_TABS = ["http", "dns", "tcp", "cron-jobs"] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

/** The tone a status cell's dot is drawn in. */
type SemanticColor = NonNullable<Table.StatusCellProps["color"]>;

/** Seconds between the panel's automatic reloads the menu offers; 0 is off. */
const REFRESH_INTERVALS = [0, 30, 60, 300] as const;

const HEALTH_COLOR: Record<MonitorHealth, SemanticColor> = {
	up: "success",
	degraded: "warning",
	down: "danger",
	pending: "neutral",
};

/** A trend line takes its row's alarm colour only when the row is in trouble. */
const SPARKLINE_TONE: Record<MonitorHealth, Sparkline.Tone> = {
	up: "brand",
	degraded: "warning",
	down: "danger",
	pending: "brand",
};

const DNS_STATUS_COLOR: Record<string, SemanticColor> = {
	ok: "success",
	changed: "warning",
	error: "danger",
};

const TCP_STATUS_COLOR: Record<string, SemanticColor> = {
	up: "success",
	timeout: "warning",
	down: "danger",
};

const CRON_JOB_STATUS_COLOR: Record<string, SemanticColor> = {
	healthy: "success",
	late: "warning",
	missed: "danger",
	new: "neutral",
};

/**
 * Short, private cache window: long enough that a `<link rel="prefetch">` for an
 * inactive tab is reused by the real `Frame` fetch moments later, and shorter than the
 * briefest auto-refresh interval, so every automatic reload reaches the server.
 */
const CACHE_CONTROL = "private, max-age=5";

/**
 * Reads an auto-refresh interval from the URL, keeping only the intervals the menu offers,
 * so a hand-edited value turns the reloads off instead of hammering the server.
 *
 * @param value The raw `refresh` search parameter.
 * @returns Seconds between reloads, 0 when off.
 */
export function refreshInterval(value: string | null): number {
	let seconds = Number(value);
	return (REFRESH_INTERVALS as readonly number[]).includes(seconds) ? seconds : 0;
}

/** Appends `refresh` to a URL only while auto-refresh is on, so the default URL stays clean. */
function withRefresh(href: string, refresh: number): string {
	return refresh > 0 ? `${href}${href.includes("?") ? "&" : "?"}refresh=${refresh}` : href;
}

/**
 * The dashboard page showing `tab`, which a tab's link and an interval's menu item lead to
 * when the frame runtime is not there to intercept them.
 */
function dashboardHref(team: string, tab: DashboardTab, refresh: number): string {
	return withRefresh(`${routes.app.team.dashboard.index.href({ team })}?tab=${tab}`, refresh);
}

/**
 * The fragment URL the dashboard's panel frame loads for `tab`, carrying the interval so
 * the panel it returns draws the menu with the same choice.
 *
 * @param team The team's slug.
 * @param tab The monitor type shown.
 * @param refresh Seconds between automatic reloads, 0 when off.
 * @returns The panel's frame `src`.
 */
export function panelSrc(team: string, tab: DashboardTab, refresh: number): string {
	return withRefresh(routes.app.team.dashboard.panel.href({ team, type: tab }), refresh);
}

namespace DashboardPanel {
	interface Common {
		team: { slug: string };
		tabLabels: Record<DashboardTab, string>;
		/** Accessible label for the tab list, e.g. "Monitor type". */
		tabsListLabel: string;
		/** Accessible label for the active tab's panel, e.g. "HTTP monitors". */
		panelLabel: string;
		/** Seconds between automatic reloads, 0 when off. */
		refresh: number;
		locale: string;
		/** The auto-refresh control's strings and the menu's interval names, in menu order. */
		autoRefresh: { trigger: string; updated: string; options: AutoRefresh.Option[] };
		/** The request's time, so every "2m ago" in the table counts from the same instant. */
		now: number;
	}

	export type Props = Common &
		(
			| { tab: "http"; httpRows: HttpRow[]; copy: HttpTable.Copy }
			| { tab: "dns"; dnsMonitors: SelectDnsMonitor[]; copy: DnsTable.Copy }
			| { tab: "tcp"; tcpMonitors: SelectTcpMonitor[]; copy: TcpTable.Copy }
			| { tab: "cron-jobs"; cronJobRows: CronJobRow[]; copy: CronJobsTable.Copy }
		);
}

/**
 * Renders the tab bar plus the table for whichever tab {@link DashboardPanel.Props.tab}
 * names, under a toolbar holding the type tabs and the auto-refresh control that reloads this
 * panel's frame.
 */
function DashboardPanel(handle: Handle<DashboardPanel.Props>) {
	return () => {
		let props = handle.props;
		let { slug } = props.team;

		return (
			<>
				{DASHBOARD_TABS.filter((tab) => tab !== props.tab).map((tab) => (
					<link key={tab} rel="prefetch" as="fetch" href={panelSrc(slug, tab, props.refresh)} />
				))}

				<PanelToolbar
					tabs={
						<Tabs>
							<Tabs.List
								aria-label={props.tabsListLabel}
								activeIndex={DASHBOARD_TABS.findIndex((tab) => tab === props.tab)}
								tabSize="110px"
							>
								{DASHBOARD_TABS.map((tab) => {
									let href = dashboardHref(slug, tab, props.refresh);

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
												link(href, {
													target: "dashboard-panel",
													src: panelSrc(slug, tab, props.refresh),
												}),
											]}
										>
											{props.tabLabels[tab]}
										</Tabs.Tab>
									);
								})}
							</Tabs.List>
						</Tabs>
					}
					refresh={
						<AutoRefresh
							id="dashboard-panel-refresh"
							value={props.refresh}
							options={props.autoRefresh.options}
							hrefFor={(seconds) => dashboardHref(slug, props.tab, seconds)}
							frame="dashboard-panel"
							locale={props.locale}
							labels={{ trigger: props.autoRefresh.trigger, updated: props.autoRefresh.updated }}
						/>
					}
				/>

				<div id="dashboard-panel-content" role="tabpanel" aria-label={props.panelLabel}>
					{props.tab === "http" && (
						<HttpTable
							team={props.team}
							rows={props.httpRows}
							copy={props.copy}
							locale={props.locale}
							now={props.now}
						/>
					)}
					{props.tab === "dns" && (
						<DnsTable
							team={props.team}
							monitors={props.dnsMonitors}
							copy={props.copy}
							locale={props.locale}
							now={props.now}
						/>
					)}
					{props.tab === "tcp" && (
						<TcpTable
							team={props.team}
							monitors={props.tcpMonitors}
							copy={props.copy}
							locale={props.locale}
							now={props.now}
						/>
					)}
					{props.tab === "cron-jobs" && (
						<CronJobsTable
							team={props.team}
							rows={props.cronJobRows}
							copy={props.copy}
							locale={props.locale}
							now={props.now}
						/>
					)}
				</div>
			</>
		);
	};
}

/** The copy every type's first-run state shows. */
interface EmptyCopy {
	emptyTitle: string;
	emptyDescription: string;
	emptyCta: string;
}

namespace FirstRun {
	export interface Props {
		icon: RemixNode;
		href: string;
		copy: EmptyCopy;
	}
}

/** A type with no monitors yet: what the table will hold and the one action that fills it. */
function FirstRun(handle: Handle<FirstRun.Props>) {
	return () => {
		let { icon, href, copy } = handle.props;

		return (
			<Empty kind="first-run" icon={icon}>
				<Empty.Title>{copy.emptyTitle}</Empty.Title>
				<Empty.Description>{copy.emptyDescription}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href}>
						<PlusIcon size={20} strokeWidth={1.5} />
						{copy.emptyCta}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	};
}

/** Formats milliseconds the way every response-time cell in the panel reads. */
const MILLISECONDS: Intl.NumberFormatOptions = {
	style: "unit",
	unit: "millisecond",
	maximumFractionDigits: 0,
};

/** One HTTP monitor with the health and latency points the analytics store holds for it. */
interface HttpRow {
	monitor: SelectMonitor;
	health: MonitorHealth;
	sparklinePoints: SparklinePoint[];
}

namespace HttpTable {
	export interface Copy extends EmptyCopy {
		tableLabel: string;
		columns: {
			name: string;
			status: string;
			responseTime: string;
			latencyChart: string;
			lastChecked: string;
		};
		statusLabels: Record<MonitorHealth, string>;
		/** Names one row's trend for assistive tech, with the monitor's name filled in. */
		latencyTrend: (name: string) => string;
	}

	export interface Props {
		team: { slug: string };
		rows: HttpRow[];
		copy: Copy;
		locale: string;
		now: number;
	}
}

function HttpTable(handle: Handle<HttpTable.Props>) {
	return () => {
		let { team, rows, copy, locale, now } = handle.props;

		if (rows.length === 0) {
			return (
				<FirstRun
					icon={<ActivityIcon size={24} strokeWidth={1.5} />}
					href={routes.app.team.monitors.new.href({ team: team.slug })}
					copy={copy}
				/>
			);
		}

		return (
			<Table.Container>
				<Table aria-label={copy.tableLabel}>
					<Table.Header>
						<Table.Row>
							<Table.Column>{copy.columns.name}</Table.Column>
							<Table.Column>{copy.columns.status}</Table.Column>
							<Table.Column numeric>{copy.columns.responseTime}</Table.Column>
							<Table.Column>{copy.columns.latencyChart}</Table.Column>
							<Table.Column>{copy.columns.lastChecked}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map(({ monitor, health, sparklinePoints }) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<Table.RowLink
										href={routes.app.team.monitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
									>
										{monitor.name}
									</Table.RowLink>
								</Table.Cell>
								<Table.StatusCell color={HEALTH_COLOR[health]}>
									{copy.statusLabels[health]}
								</Table.StatusCell>
								<Table.NumberCell
									value={monitor.last_response_time_ms}
									locale={locale}
									format={MILLISECONDS}
								/>
								<Table.Cell mix={[is("8rem")]}>
									<Sparkline
										values={sparklinePoints.map((point) => point.responseTimeMs)}
										label={copy.latencyTrend(monitor.name)}
										tone={SPARKLINE_TONE[health]}
									/>
								</Table.Cell>
								<Table.DateCell date={monitor.last_checked_at} now={now} locale={locale} local />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace DnsTable {
	export interface Copy extends EmptyCopy {
		tableLabel: string;
		columns: { name: string; domain: string; status: string; lastChecked: string };
		statusLabels: Record<string, string>;
		notChecked: string;
	}

	export interface Props {
		team: { slug: string };
		monitors: SelectDnsMonitor[];
		copy: Copy;
		locale: string;
		now: number;
	}
}

/**
 * A DNS monitor is a whole domain, so a row here names the domain and its last outcome
 * only: record counts are a second query this glance-only tab skips, owned instead by
 * the list page and the monitor's own page.
 */
function DnsTable(handle: Handle<DnsTable.Props>) {
	return () => {
		let { team, monitors, copy, locale, now } = handle.props;

		if (monitors.length === 0) {
			return (
				<FirstRun
					icon={<GlobeIcon size={24} strokeWidth={1.5} />}
					href={routes.app.team.dnsMonitors.new.href({ team: team.slug })}
					copy={copy}
				/>
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
							<Table.Column>{copy.columns.lastChecked}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{monitors.map((monitor) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<Table.RowLink
										href={routes.app.team.dnsMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
									>
										{monitor.name}
									</Table.RowLink>
								</Table.Cell>
								<Table.Cell>
									<code>{monitor.domain}</code>
								</Table.Cell>
								<Table.StatusCell color={DNS_STATUS_COLOR[monitor.last_status ?? ""] ?? "neutral"}>
									{monitor.last_status === null
										? copy.notChecked
										: (copy.statusLabels[monitor.last_status] ?? monitor.last_status)}
								</Table.StatusCell>
								<Table.DateCell date={monitor.last_checked_at} now={now} locale={locale} local />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

namespace TcpTable {
	export interface Copy extends EmptyCopy {
		tableLabel: string;
		columns: {
			name: string;
			endpoint: string;
			status: string;
			responseTime: string;
			lastChecked: string;
		};
		statusLabels: Record<string, string>;
	}

	export interface Props {
		team: { slug: string };
		monitors: SelectTcpMonitor[];
		copy: Copy;
		locale: string;
		now: number;
	}
}

function TcpTable(handle: Handle<TcpTable.Props>) {
	return () => {
		let { team, monitors, copy, locale, now } = handle.props;

		if (monitors.length === 0) {
			return (
				<FirstRun
					icon={<NetworkIcon size={24} strokeWidth={1.5} />}
					href={routes.app.team.tcpMonitors.new.href({ team: team.slug })}
					copy={copy}
				/>
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
							<Table.Column numeric>{copy.columns.responseTime}</Table.Column>
							<Table.Column>{copy.columns.lastChecked}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{monitors.map((monitor) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<Table.RowLink
										href={routes.app.team.tcpMonitors.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
									>
										{monitor.name}
									</Table.RowLink>
								</Table.Cell>
								<Table.Cell>
									<code>
										{monitor.host}:{monitor.port}
									</code>
								</Table.Cell>
								<Table.StatusCell color={TCP_STATUS_COLOR[monitor.last_status ?? ""] ?? "neutral"}>
									{copy.statusLabels[monitor.last_status ?? "pending"] ?? monitor.last_status}
								</Table.StatusCell>
								<Table.NumberCell
									value={monitor.last_response_time_ms}
									locale={locale}
									format={MILLISECONDS}
								/>
								<Table.DateCell date={monitor.last_checked_at} now={now} locale={locale} local />
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
	export interface Copy extends EmptyCopy {
		tableLabel: string;
		columns: { name: string; schedule: string; status: string; lastPing: string };
		statusLabels: Record<string, string>;
	}

	export interface Props {
		team: { slug: string };
		rows: CronJobRow[];
		copy: Copy;
		locale: string;
		now: number;
	}
}

function CronJobsTable(handle: Handle<CronJobsTable.Props>) {
	return () => {
		let { team, rows, copy, locale, now } = handle.props;

		if (rows.length === 0) {
			return (
				<FirstRun
					icon={<ClockIcon size={24} strokeWidth={1.5} />}
					href={routes.app.team.cronJobs.new.href({ team: team.slug })}
					copy={copy}
				/>
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
							<Table.Column>{copy.columns.lastPing}</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{rows.map(({ monitor, schedule }) => (
							<Table.Row key={monitor.id}>
								<Table.Cell>
									<Table.RowLink
										href={routes.app.team.cronJobs.show.href({
											team: team.slug,
											monitorId: monitor.id,
										})}
									>
										{monitor.name}
									</Table.RowLink>
								</Table.Cell>
								<Table.Cell>{schedule}</Table.Cell>
								<Table.StatusCell color={CRON_JOB_STATUS_COLOR[monitor.status] ?? "neutral"}>
									{copy.statusLabels[monitor.status] ?? monitor.status}
								</Table.StatusCell>
								<Table.DateCell date={monitor.last_ping_at} now={now} locale={locale} local />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		);
	};
}

/**
 * GET /app/:team/dashboard/panel/:type — one monitor-type table, fragment-only. `?refresh=`
 * carries the auto-refresh interval the dashboard was opened with, so the menu shows it.
 */
export default createAction(routes.app.team.dashboard.panel, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { type } = s.parse(s.object({ type: s.enum_(DASHBOARD_TABS) }), ctx.params);
		let headers = { "Cache-Control": CACHE_CONTROL };

		let tabLabels: Record<DashboardTab, string> = {
			http: ctx.intl.t("page.dashboard.tabs.http"),
			dns: ctx.intl.t("page.dashboard.tabs.dns"),
			tcp: ctx.intl.t("page.dashboard.tabs.tcp"),
			"cron-jobs": ctx.intl.t("page.dashboard.tabs.cronJobs"),
		};
		let seconds = new Intl.NumberFormat(ctx.locale, {
			style: "unit",
			unit: "second",
			unitDisplay: "narrow",
		});
		let minutes = new Intl.NumberFormat(ctx.locale, {
			style: "unit",
			unit: "minute",
			unitDisplay: "narrow",
		});
		let common = {
			team: ctx.team,
			tabLabels,
			tabsListLabel: ctx.intl.t("page.dashboard.panel.tabsLabel"),
			panelLabel: ctx.intl.t("page.dashboard.panel.tabPanelLabel", { tab: tabLabels[type] }),
			refresh: refreshInterval(ctx.url.searchParams.get("refresh")),
			locale: ctx.locale,
			now: Date.now(),
			autoRefresh: {
				trigger: ctx.intl.t("page.dashboard.panel.autoRefresh.trigger"),
				updated: ctx.intl.t("page.dashboard.panel.autoRefresh.updated"),
				options: REFRESH_INTERVALS.map((value) => {
					if (value === 0)
						return { value, label: ctx.intl.t("page.dashboard.panel.autoRefresh.off") };
					if (value < 60) return { value, label: seconds.format(value) };
					return { value, label: minutes.format(value / 60) };
				}),
			},
		};
		let lastChecked = ctx.intl.t("page.dashboard.panel.columns.lastChecked");
		let responseTime = ctx.intl.t("page.dashboard.panel.columns.responseTime");

		if (type === "dns") {
			let dnsMonitors = await ctx.models.dnsMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			return ctx.render(
				<DashboardPanel
					{...common}
					tab="dns"
					dnsMonitors={dnsMonitors}
					copy={{
						emptyTitle: ctx.intl.t("page.dnsMonitors.empty.title"),
						emptyDescription: ctx.intl.t("page.dnsMonitors.empty.description"),
						emptyCta: ctx.intl.t("page.dnsMonitors.empty.cta"),
						tableLabel: ctx.intl.t("page.dnsMonitors.table.label"),
						columns: {
							name: ctx.intl.t("page.dnsMonitors.table.columns.name"),
							domain: ctx.intl.t("page.dnsMonitors.table.columns.domain"),
							status: ctx.intl.t("page.dnsMonitors.table.columns.status"),
							lastChecked,
						},
						statusLabels: {
							ok: ctx.intl.t("page.dashboard.panel.dnsStatus.ok"),
							changed: ctx.intl.t("page.dashboard.panel.dnsStatus.changed"),
							error: ctx.intl.t("page.dashboard.panel.dnsStatus.error"),
						},
						notChecked: ctx.intl.t("page.dnsMonitors.table.notChecked"),
					}}
				/>,
				{ headers },
			);
		}

		if (type === "tcp") {
			let tcpMonitors = await ctx.models.tcpMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			return ctx.render(
				<DashboardPanel
					{...common}
					tab="tcp"
					tcpMonitors={tcpMonitors}
					copy={{
						emptyTitle: ctx.intl.t("page.tcpMonitors.empty.title"),
						emptyDescription: ctx.intl.t("page.tcpMonitors.empty.description"),
						emptyCta: ctx.intl.t("page.tcpMonitors.empty.cta"),
						tableLabel: ctx.intl.t("page.tcpMonitors.table.label"),
						columns: {
							name: ctx.intl.t("page.tcpMonitors.table.columns.name"),
							endpoint: ctx.intl.t("page.tcpMonitors.table.columns.endpoint"),
							status: ctx.intl.t("page.tcpMonitors.table.columns.status"),
							responseTime,
							lastChecked,
						},
						statusLabels: {
							up: ctx.intl.t("page.tcpMonitors.table.status.up"),
							down: ctx.intl.t("page.tcpMonitors.table.status.down"),
							timeout: ctx.intl.t("page.tcpMonitors.table.status.timeout"),
							pending: ctx.intl.t("page.tcpMonitors.table.status.pending"),
						},
					}}
				/>,
				{ headers },
			);
		}

		if (type === "cron-jobs") {
			let cronJobMonitors = await ctx.models.cronJobMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			let cronJobRows: CronJobRow[] = cronJobMonitors.map((monitor) => ({
				monitor,
				schedule: describeSchedule(monitor.cron_expression, {
					locale: ctx.locale,
					t: ctx.intl.t,
				}),
			}));
			return ctx.render(
				<DashboardPanel
					{...common}
					tab="cron-jobs"
					cronJobRows={cronJobRows}
					copy={{
						emptyTitle: ctx.intl.t("page.cronJobs.empty.title"),
						emptyDescription: ctx.intl.t("page.cronJobs.empty.description"),
						emptyCta: ctx.intl.t("page.cronJobs.empty.cta"),
						tableLabel: ctx.intl.t("page.cronJobs.table.label"),
						columns: {
							name: ctx.intl.t("page.cronJobs.table.columns.name"),
							schedule: ctx.intl.t("page.cronJobs.table.columns.schedule"),
							status: ctx.intl.t("page.cronJobs.table.columns.status"),
							lastPing: ctx.intl.t("page.dashboard.panel.columns.lastPing"),
						},
						statusLabels: {
							healthy: ctx.intl.t("page.cronJobs.table.status.healthy"),
							late: ctx.intl.t("page.cronJobs.table.status.late"),
							missed: ctx.intl.t("page.cronJobs.table.status.missed"),
							new: ctx.intl.t("page.cronJobs.table.status.new"),
						},
					}}
				/>,
				{ headers },
			);
		}

		let [monitors, summaries, sparklines] = await Promise.all([
			ctx.models.monitors.inTeam(ctx.team.id).orderBy("created_at", "desc").all(),
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
				{...common}
				tab="http"
				httpRows={httpRows}
				copy={{
					emptyTitle: ctx.intl.t("page.dashboard.empty.title"),
					emptyDescription: ctx.intl.t("page.dashboard.empty.description"),
					emptyCta: ctx.intl.t("page.dashboard.empty.cta"),
					tableLabel: ctx.intl.t("page.dashboard.table.label"),
					columns: {
						name: ctx.intl.t("page.dashboard.table.columns.name"),
						status: ctx.intl.t("page.dashboard.table.columns.status"),
						responseTime,
						latencyChart: ctx.intl.t("page.dashboard.table.columns.latencyChart"),
						lastChecked,
					},
					statusLabels: {
						up: ctx.intl.t("page.dashboard.table.status.up"),
						degraded: ctx.intl.t("page.dashboard.table.status.degraded"),
						down: ctx.intl.t("page.dashboard.table.status.down"),
						pending: ctx.intl.t("page.dashboard.table.status.unknown"),
					},
					latencyTrend: (name) => ctx.intl.t("page.dashboard.panel.latencyTrend", { name }),
				}}
			/>,
			{ headers },
		);
	},
});
