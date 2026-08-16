/**
 * Cron-job monitor detail page controller. Requires `requireUser` + `requireTeam`;
 * 404s when the monitor doesn't belong to the current team.
 *
 * The page is ordered by what a reader needs first. Status is the one fact that
 * decides whether anything else on the page matters, so it rides in the shell's
 * header row rather than as one card among many — `AppShell` types `heading` as a
 * plain string, so the badge goes at the start of `actions`, which is the same
 * fixed-height header row the monitor's name sits in.
 *
 * Timezone and grace period are settings chosen once on the edit page, not health
 * readings, so they collapse into the schedule card's secondary line instead of
 * competing with the four metrics that do change: last ping, next expected, on-time
 * rate and total pings.
 *
 * Every instant reads as a relative distance ("in 4 hours", "2 minutes ago") with the
 * absolute timestamp on `title`, because the question a monitoring page answers is
 * "how long ago", not "on what date". `@pkg/dates` renders both, in the viewer's
 * locale and in the job's own timezone — the zone the schedule is written against, so
 * a timestamp and the cron expression above it describe the same clock.
 *
 * `cron-jobs:ping` is enforced, and a request missing the header fails silently as a
 * 401 that later surfaces as a false "missed" alert. The ping section therefore
 * carries only runnable, authenticated snippets and a route to creating a scoped key.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { formatDateTime, formatDuration, formatRelative } from "@pkg/dates";
import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import { PencilIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexWrap, gap, items, justify } from "@pkg/u/layout";
import { overflowX } from "@pkg/u/overflow";
import { m, mbe, p } from "@pkg/u/size";
import { fontSize, leading, weight } from "@pkg/u/typography";
import { Badge, Empty, Link, LinkButton, Table } from "@pkg/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Fragment } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { describeSchedule } from "~/app/lib/cron-text";
import { badgeVariant } from "~/resources/components/badge";
import CopyButton from "~/resources/components/copy-button";
import StatCard from "~/resources/components/stat-card";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

/** GET /app/:team/cron-jobs/:monitorId — a cron-job monitor's detail page. */
export default createAction(routes.app.team.cronJobs.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await CronJobMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let pings = await CronJobMonitor.listPings(db, monitor.id);
		let pingUrl = new URL(
			routes.api.cronJobPing.href({ cronJobId: monitor.id }),
			ctx.request.url,
		).toString();
		let dailyStats = await MonitorDailyStats.listRecentDays(db, monitor.id, "cron");

		let totalPings = pings.length;
		let onTimeCount = pings.filter((ping) => ping.was_on_time).length;
		let onTimeRate = totalPings > 0 ? Math.round((onTimeCount / totalPings) * 100) : null;

		let authHeader = `-H "Authorization: Bearer $UPTIME_API_KEY"`;
		let curlSnippet = `curl -X POST ${pingUrl} ${authHeader}`;
		let crontabSnippet = `0 * * * * your-job.sh && curl -fsS -X POST ${pingUrl} ${authHeader}`;

		// The bar's copy is the same copy a viewer reads on a public status page, so it
		// reuses those keys rather than growing a second set that could drift from them.
		let uptimeBarLabels = {
			daysAgo: ctx.i18next.t("statusPage.uptimeBar.daysAgo"),
			today: ctx.i18next.t("statusPage.uptimeBar.today"),
			legend: {
				full: ctx.i18next.t("statusPage.uptimeBar.legend.full"),
				partial: ctx.i18next.t("statusPage.uptimeBar.legend.partial"),
				down: ctx.i18next.t("statusPage.uptimeBar.legend.down"),
				noData: ctx.i18next.t("statusPage.uptimeBar.legend.noData"),
			},
		};

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.cronJobDetail.header.breadcrumb.cronJobs"),
							href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<Fragment>
							<Badge {...badgeVariant(STATUS_BADGE_TONE[monitor.status] ?? "neutral")}>
								{ctx.i18next.t(`page.cronJobs.table.status.${monitor.status}`)}
							</Badge>
							<LinkButton
								href={routes.app.team.cronJobs.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.cronJobDetail.header.action.edit")}
							</LinkButton>
						</Fragment>
					}
				>
					<div>
						{monitor.description && (
							<p mix={[m("0"), mbe("24px"), fontSize("0.9375rem"), fg("neutral.muted")]}>
								{monitor.description}
							</p>
						)}

						<div
							mix={[
								mbe("16px"),
								p("16px"),
								rounded("8px"),
								border({ color: "neutral.border", width: "1px" }),
							]}
						>
							<div mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{ctx.i18next.t("page.cronJobDetail.info.schedule")}
							</div>
							<div mix={[fontSize("1.5rem"), weight(700), leading("2rem")]}>
								{describeSchedule(monitor.cron_expression, {
									locale: ctx.locale,
									t: ctx.i18next.t,
								})}
							</div>
							<div mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{monitor.timezone}
								{" · "}
								{ctx.i18next.t("page.cronJobDetail.info.gracePeriodValue", {
									duration: formatDuration(monitor.grace_period_seconds * 1000, {
										locale: ctx.locale,
									}),
								})}
							</div>
							<code mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{monitor.cron_expression}
							</code>
						</div>

						<div mix={[flex(), flexWrap(), gap("16px"), mbe("32px")]}>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.lastPing.label")}
								value={
									monitor.last_ping_at === null ? (
										ctx.i18next.t("page.cronJobDetail.stats.lastPing.never")
									) : (
										<Timestamp
											value={monitor.last_ping_at}
											locale={ctx.locale}
											timeZone={monitor.timezone}
										/>
									)
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.nextExpected.label")}
								value={
									monitor.next_expected_at === null ? (
										"—"
									) : (
										<Timestamp
											value={monitor.next_expected_at}
											locale={ctx.locale}
											timeZone={monitor.timezone}
										/>
									)
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.onTimeRate.label")}
								value={onTimeRate === null ? "—" : `${onTimeRate}%`}
							/>
							<StatCard
								label={ctx.i18next.t("page.cronJobDetail.stats.totalPings.label")}
								value={totalPings}
							/>
						</div>

						<Section title={ctx.i18next.t("page.cronJobDetail.ping.title")}>
							<p mix={[m("0"), mbe("16px"), fontSize("0.8125rem"), fg("neutral.muted")]}>
								{ctx.i18next.t("page.cronJobDetail.ping.description")}
							</p>
							{/* CopyButton is a `clientEntry` island: its render function runs
							server-side too (for the initial HTML), where `intl(handle)` has no
							module-scoped `setIntl()` fallback to read (that's only ever
							registered client-side in bootstrap/browser.ts) — it needs an
							`IntlProvider` ancestor for `intl(handle)` to resolve at all. */}
							<IntlProvider i18n={ctx.i18next}>
								<Snippet
									label={ctx.i18next.t("page.cronJobDetail.ping.snippet.curl")}
									copyLabel={ctx.i18next.t("page.cronJobDetail.ping.snippet.copyCurl")}
									code={curlSnippet}
								/>
								<Snippet
									label={ctx.i18next.t("page.cronJobDetail.ping.snippet.crontab")}
									copyLabel={ctx.i18next.t("page.cronJobDetail.ping.snippet.copyCrontab")}
									code={crontabSnippet}
								/>
							</IntlProvider>
							<p mix={[m("0"), fontSize("0.8125rem"), fg("neutral.muted")]}>
								{ctx.i18next.t("page.cronJobDetail.ping.apiKey.text")}{" "}
								<Link href={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}>
									{ctx.i18next.t("page.cronJobDetail.ping.apiKey.cta")}
								</Link>
							</p>
						</Section>

						<Section title={ctx.i18next.t("page.cronJobDetail.uptimeHistory")}>
							{/* 90 bars at a 2px floor plus their gaps need ~358px, more than this
							column offers on a phone, so the bar gets its own scroll box rather than
							pushing the whole content area sideways. */}
							<div mix={[overflowX("auto")]}>
								<UptimeBar
									days={dailyStats}
									labels={uptimeBarLabels}
									formatUptime={(percentage) =>
										ctx.i18next.t("statusPage.uptimeBar.tooltip.uptime", { percentage })
									}
								/>
							</div>
						</Section>

						<Section title={ctx.i18next.t("page.cronJobDetail.pings.title")}>
							{pings.length === 0 ? (
								<Empty>
									<Empty.Description>
										{ctx.i18next.t("page.cronJobDetail.pings.empty")}
									</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={ctx.i18next.t("page.cronJobDetail.pings.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.i18next.t("page.cronJobDetail.pings.columns.time")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.cronJobDetail.pings.columns.status")}
												</Table.Column>
												<Table.Column>
													{ctx.i18next.t("page.cronJobDetail.pings.columns.sourceIp")}
												</Table.Column>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{pings.map((ping) => (
												<Table.Row key={ping.id}>
													<Table.Cell>
														<Timestamp
															value={ping.created_at}
															locale={ctx.locale}
															timeZone={monitor.timezone}
														/>
													</Table.Cell>
													<Table.Cell>
														<Badge {...badgeVariant(ping.was_on_time ? "up" : "degraded")}>
															{ping.was_on_time
																? ctx.i18next.t("page.cronJobDetail.pings.status.onTime")
																: ctx.i18next.t("page.cronJobDetail.pings.status.late")}
														</Badge>
													</Table.Cell>
													<Table.Cell>{ping.source_ip ?? "—"}</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</Section>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});

namespace Section {
	export interface Props {
		title: string;
		children: RemixNode;
	}
}

/** Renders one titled block below the stat cards, at the same heading weight and rhythm every section on this page shares. */
function Section(handle: Handle<Section.Props>) {
	return () => (
		<section mix={[mbe("32px")]}>
			<h2 mix={[m("0"), mbe("12px"), fontSize("1.125rem"), weight(700)]}>{handle.props.title}</h2>
			{handle.props.children}
		</section>
	);
}

namespace Snippet {
	export interface Props {
		label: string;
		copyLabel: string;
		code: string;
	}
}

/** Renders one runnable shell snippet as a scrollable code block with its own copy button, taking the copied value from the same string it displays. */
function Snippet(handle: Handle<Snippet.Props>) {
	return () => {
		let { label, copyLabel, code } = handle.props;

		return (
			<div mix={[mbe("16px")]}>
				<div mix={[flex(), items("center"), justify("between"), gap("12px"), mbe("8px")]}>
					<span mix={[fontSize("0.8125rem"), weight(600), fg("neutral.emphasis")]}>{label}</span>
					<CopyButton value={code} label={copyLabel} />
				</div>
				<pre
					mix={[
						m("0"),
						p("12px"),
						rounded("8px"),
						bg("neutral.tint"),
						border({ color: "neutral.border", width: "1px" }),
						fontSize("0.8125rem"),
						overflowX("auto"),
					]}
				>
					<code>{code}</code>
				</pre>
			</div>
		);
	};
}

namespace Timestamp {
	export interface Props {
		value: number;
		locale: string;
		timeZone: string;
	}
}

/** Renders an instant as its distance from now, with the absolute date and time in the job's own zone available on hover. */
function Timestamp(handle: Handle<Timestamp.Props>) {
	return () => {
		let { value, locale, timeZone } = handle.props;
		let date = new Date(value);

		return (
			<span title={formatDateTime(date, { locale, timeZone })}>
				{formatRelative(date, { locale })}
			</span>
		);
	};
}
