/**
 * Cron-job monitor detail page. Requires `requireUser` and `requireTeam`, and 404s
 * when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { formatDuration, lastNDays } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { IntlProvider } from "@sdxc/i18n/ui";
import { PencilIcon, TrashIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, gap, items, justify, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { m, mbe, p } from "@sdxc/u/size";
import { font, fontSize, weight } from "@sdxc/u/typography";
import {
	AlertDialog,
	Badge,
	Button,
	Link,
	LinkButton,
	Menu,
	PropertyList,
	RelativeTime,
} from "@sdxc/ui";
import { Empty, StatCard, StatusStrip, Table } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectMonitorDailyStats } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { UPTIME_WINDOW_DAYS } from "~/app/models/monitor-daily-stats";
import abilities from "~/app/policies/abilities";
import { describeSchedule } from "~/app/services/cron-text";
import { withPrefix } from "~/app/services/prefixed-translate";
import { badgeVariant } from "~/resources/components/badge";
import CopyButton from "~/resources/components/copy-button";
import RowMenu from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

/** A recorded day's status as the strip draws it; an unknown value reads as no data. */
const DAY_STATUS: Record<string, StatusStrip.Status> = {
	up: "up",
	degraded: "degraded",
	down: "down",
};

/** Stable id for the delete confirmation, which the overflow menu's Delete opens. */
const DELETE_DIALOG_ID = "delete-cron-job";

/**
 * The last {@link UPTIME_WINDOW_DAYS} UTC days as strip periods, oldest first. Days are keyed
 * by the UTC day `monitor_daily_stats.date` uses, and a day with no row reads as no data, not
 * as an outage.
 */
function historyPeriods(
	days: SelectMonitorDailyStats[],
	locale: string,
	formatUptime: (percentage: string) => string,
	noData: string,
): StatusStrip.Period[] {
	let byDate = new Map(days.map((day) => [day.date, day]));
	let format = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });

	return lastNDays(UPTIME_WINDOW_DAYS, { timeZone: "UTC" }).map(({ key }): StatusStrip.Period => {
		let day = byDate.get(key);
		let label = format.format(new Date(`${key}T00:00:00Z`));
		if (!day || day.total_checks === 0) return { status: "no-data", label, value: noData };
		return {
			status: DAY_STATUS[day.status] ?? "no-data",
			label,
			value: formatUptime(uptimePercentage(day.successful_checks, day.total_checks)),
		};
	});
}

/** A share of successful checks as the status page words it: whole at 100, two decimals below. */
function uptimePercentage(successful: number, total: number): string {
	let percentage = (successful / total) * 100;
	return percentage.toFixed(percentage === 100 ? 0 : 2);
}

/**
 * GET /app/:team/cron-jobs/:monitorId — a cron-job monitor's detail page. Ping snippets sit
 * inside an `IntlProvider` so `CopyButton`'s island resolves `intl(handle)` server-side; every
 * instant reads relative to now, with the job's own zone and UTC in its title.
 */
export default createAction(routes.app.team.cronJobs.show, {
	middleware: [requireUser, requireTeam, appShellData(), teamAccess],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await ctx.models.cronJobMonitors.inTeam(ctx.team.id).find(monitorId);
		if (!monitor) return notFound("Not Found");

		await ctx.access.load(abilities.cronJobs.delete);
		let canDelete = ctx.access.can(abilities.cronJobs.delete);

		let t = withPrefix(ctx.intl.t, "page.cronJobDetail");
		let pings = await ctx.models.cronJobPings.recent(monitor.id);
		let pingUrl = new URL(
			routes.api.cronJobPing.href({ cronJobId: monitor.id }),
			ctx.request.url,
		).toString();
		let dailyStats = await ctx.models.monitorDailyStats.listRecentDays(monitor.id, "cron");

		let totalPings = pings.length;
		let onTimeCount = pings.filter((ping) => ping.was_on_time).length;
		let onTimeRate = totalPings > 0 ? Math.round((onTimeCount / totalPings) * 100) : null;

		let authHeader = `-H "Authorization: Bearer $UPTIME_API_KEY"`;
		let curlSnippet = `curl -X POST ${pingUrl} ${authHeader}`;
		let crontabSnippet = `0 * * * * your-job.sh && curl -fsS -X POST ${pingUrl} ${authHeader}`;

		/**
		 * Reuses the public status page's uptime wording instead of a second set, so the strip
		 * reads the same here as on a published status page.
		 */
		let formatUptime = (percentage: string) =>
			ctx.intl.t("statusPage.uptimeBar.tooltip.uptime", { percentage });
		let periods = historyPeriods(
			dailyStats,
			ctx.locale,
			formatUptime,
			ctx.intl.t("statusPage.uptimeBar.legend.noData"),
		);
		let windowChecks = dailyStats.reduce(
			(totals, day) => ({
				total: totals.total + day.total_checks,
				successful: totals.successful + day.successful_checks,
			}),
			{ total: 0, successful: 0 },
		);

		let editHref = routes.app.team.cronJobs.edit.href({
			team: ctx.team.slug,
			monitorId: monitor.id,
		});

		return ctx.render(
			<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: t("header.breadcrumb.cronJobs"),
							href: routes.app.team.cronJobs.index.href({ team: ctx.team.slug }),
						},
					]}
					description={monitor.description ?? undefined}
					status={
						<Badge {...badgeVariant(STATUS_BADGE_TONE[monitor.status] ?? "neutral")}>
							{ctx.intl.t(`page.cronJobs.table.status.${monitor.status}`)}
						</Badge>
					}
					overflow={
						canDelete ? (
							<RowMenu id="cron-job-overflow" label={t("header.action.more")}>
								<Menu.Item danger commandfor={DELETE_DIALOG_ID} command="show-modal">
									<TrashIcon size={16} strokeWidth={1.5} />
									{t("header.action.delete")}
								</Menu.Item>
							</RowMenu>
						) : undefined
					}
					primaryAction={
						<LinkButton href={editHref}>
							<PencilIcon size={16} strokeWidth={1.5} />
							{t("header.action.edit")}
						</LinkButton>
					}
				>
					<div mix={[vstack({ gap: 8, align: "stretch" })]}>
						<StatCard.Group columns={4}>
							<StatCard>
								<StatCard.Label>{t("stats.lastPing.label")}</StatCard.Label>
								<StatCard.Value>
									{monitor.last_ping_at === null ? (
										t("stats.lastPing.never")
									) : (
										<RelativeTime
											date={monitor.last_ping_at}
											locale={ctx.locale}
											timeZone={monitor.timezone}
										/>
									)}
								</StatCard.Value>
							</StatCard>
							<StatCard>
								<StatCard.Label>{t("stats.nextExpected.label")}</StatCard.Label>
								<StatCard.Value>
									{monitor.next_expected_at === null ? (
										"—"
									) : (
										<RelativeTime
											date={monitor.next_expected_at}
											locale={ctx.locale}
											timeZone={monitor.timezone}
										/>
									)}
								</StatCard.Value>
							</StatCard>
							<StatCard>
								<StatCard.Label>{t("stats.onTimeRate.label")}</StatCard.Label>
								<StatCard.Value>{onTimeRate === null ? "—" : `${onTimeRate}%`}</StatCard.Value>
							</StatCard>
							<StatCard>
								<StatCard.Label>{t("stats.totalPings.label")}</StatCard.Label>
								<StatCard.Value>{totalPings}</StatCard.Value>
							</StatCard>
						</StatCard.Group>

						<Section title={t("info.title")}>
							<PropertyList>
								<PropertyList.Item label={t("info.schedule")}>
									<span mix={[vstack({ gap: 0.5 })]}>
										<span>
											{describeSchedule(monitor.cron_expression, {
												locale: ctx.locale,
												t: ctx.intl.t,
											})}
										</span>
										<span mix={[fontSize("sm"), fg("neutral.muted")]}>
											{monitor.timezone}
											{" · "}
											{t("info.gracePeriodValue", {
												duration: formatDuration(monitor.grace_period_seconds * 1000, {
													locale: ctx.locale,
												}),
											})}
										</span>
									</span>
								</PropertyList.Item>
								<PropertyList.Item label={t("info.expression")}>
									<code mix={[font("mono"), fontSize("sm")]}>{monitor.cron_expression}</code>
								</PropertyList.Item>
								<PropertyList.Item label={t("info.alertOnLate")}>
									{monitor.alert_on_late ? t("info.on") : t("info.off")}
								</PropertyList.Item>
								<PropertyList.Item label={t("info.monitoring")}>
									{monitor.enabled_at === null ? t("info.paused") : t("info.active")}
								</PropertyList.Item>
							</PropertyList>
						</Section>

						<Section title={t("ping.title")}>
							<p mix={[m("0"), mbe("16px"), fontSize("0.8125rem"), fg("neutral.muted")]}>
								{t("ping.description")}
							</p>
							<IntlProvider intl={ctx.intl}>
								<Snippet
									label={t("ping.snippet.curl")}
									copyLabel={t("ping.snippet.copyCurl")}
									code={curlSnippet}
								/>
								<Snippet
									label={t("ping.snippet.crontab")}
									copyLabel={t("ping.snippet.copyCrontab")}
									code={crontabSnippet}
								/>
							</IntlProvider>
							<p mix={[m("0"), fontSize("0.8125rem"), fg("neutral.muted")]}>
								{t("ping.apiKey.text")}{" "}
								<Link href={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}>
									{t("ping.apiKey.cta")}
								</Link>
							</p>
						</Section>

						<Section title={t("uptimeHistory")}>
							<StatusStrip
								periods={periods}
								label={t("history.label")}
								start={ctx.intl.t("statusPage.uptimeBar.daysAgo")}
								end={ctx.intl.t("statusPage.uptimeBar.today")}
								summary={
									windowChecks.total === 0
										? undefined
										: formatUptime(uptimePercentage(windowChecks.successful, windowChecks.total))
								}
							/>
						</Section>

						<Section title={t("pings.title")}>
							{pings.length === 0 ? (
								<Empty size="compact">
									<Empty.Description>{t("pings.empty")}</Empty.Description>
								</Empty>
							) : (
								<Table.Container>
									<Table aria-label={t("pings.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>{t("pings.columns.time")}</Table.Column>
												<Table.Column>{t("pings.columns.status")}</Table.Column>
												<Table.Column>{t("pings.columns.sourceIp")}</Table.Column>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{pings.map((ping) => (
												<Table.Row key={ping.id}>
													<Table.DateCell
														date={ping.created_at}
														locale={ctx.locale}
														timeZone={monitor.timezone}
													/>
													<Table.StatusCell color={ping.was_on_time ? "success" : "warning"}>
														{ping.was_on_time ? t("pings.status.onTime") : t("pings.status.late")}
													</Table.StatusCell>
													<Table.Cell>
														<span mix={[font("mono")]}>{ping.source_ip ?? "—"}</span>
													</Table.Cell>
												</Table.Row>
											))}
										</Table.Body>
									</Table>
								</Table.Container>
							)}
						</Section>
					</div>

					{canDelete ? (
						<AlertDialog
							id={DELETE_DIALOG_ID}
							aria-labelledby={`${DELETE_DIALOG_ID}-title`}
							aria-describedby={`${DELETE_DIALOG_ID}-description`}
						>
							<AlertDialog.Header>
								<AlertDialog.Title id={`${DELETE_DIALOG_ID}-title`}>
									{ctx.intl.t("page.editCronJob.danger.delete.confirmTitle")}
								</AlertDialog.Title>
								<AlertDialog.Description id={`${DELETE_DIALOG_ID}-description`}>
									{ctx.intl.t("page.editCronJob.danger.delete.confirmDescription")}
								</AlertDialog.Description>
							</AlertDialog.Header>
							<form
								method="post"
								action={routes.actions.cronJob.delete.href({ team: ctx.team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<AlertDialog.Footer>
									<AlertDialog.Cancel commandfor={DELETE_DIALOG_ID}>
										{ctx.intl.t("page.editCronJob.form.cancel")}
									</AlertDialog.Cancel>
									<Button type="submit" color="danger">
										{ctx.intl.t("page.editCronJob.danger.delete.confirm")}
									</Button>
								</AlertDialog.Footer>
							</form>
						</AlertDialog>
					) : null}
				</AppShell>
			</DocumentLayout>,
		);
	},
});

namespace Section {
	export interface Props {
		title: string;
		children: RemixNode;
	}
}

/** Renders one titled block below the stat cards, at the same heading weight every section on this page shares. */
function Section(handle: Handle<Section.Props>) {
	return () => (
		<section>
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
