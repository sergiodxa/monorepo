/**
 * HTTP monitor detail page controller. Shows the monitor's configuration, SSL status,
 * a recent-latency sparkline from Analytics Engine, a calendar-year uptime heatmap
 * from `monitor_daily_stats`, and run/edit actions. Requires `requireUser` +
 * `requireTeam`; 404s when the monitor doesn't belong to the current team.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import {
	LockIcon,
	PencilIcon,
	RefreshCwIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShieldXIcon,
} from "@pkg/lucide-remix";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css, Fragment } from "remix/ui";

import type { SslStatus } from "~/app/services/ssl-info";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getMonitorSparkline } from "~/app/services/analytics";
import { calculateSslStatus } from "~/app/services/ssl-info";
import Badge from "~/resources/components/badge";
import LinkButton from "~/resources/components/link-button";
import RunMonitorButton from "~/resources/components/run-monitor-button";
import StatCard from "~/resources/components/stat-card";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import Sparkline from "~/resources/views/monitors/sparkline";
import Heatmap from "~/resources/views/shared/heatmap";
import routes from "~/routes/web";

/** GET /app/:team/monitors/:monitorId — a monitor's detail page. */
export default createAction(routes.app.team.monitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let sparklineResult = await getMonitorSparkline(ctx.team.id, monitor.id);
		let sparkline = isFailure(sparklineResult) ? [] : sparklineResult.data;
		let dailyStats = await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={monitor.name}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
						{
							label: ctx.i18next.t("page.httpMonitors.header.title"),
							href: routes.app.team.monitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<Fragment>
							<RunMonitorButton
								action={routes.actions.monitor.http.play.href({ team: ctx.team.slug })}
								monitorId={monitor.id}
							/>
							<LinkButton
								href={routes.app.team.monitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.monitor.header.action.edit")}
							</LinkButton>
							<LinkButton href={ctx.url.pathname}>
								<RefreshCwIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.monitor.header.action.refresh")}
							</LinkButton>
						</Fragment>
					}
				>
					<div>
						<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 })]}>
							<StatCard label="URL" value={<code>{monitor.url}</code>} />
							<StatCard label="Method" value={monitor.method} />
							<StatCard label="Check interval" value={`${monitor.interval_seconds}s`} />
						</div>

						<h2>Recent response time</h2>
						<Sparkline points={sparkline} />

						<h2>Uptime history</h2>
						<Heatmap days={dailyStats} />

						<SslCard team={ctx.team} monitor={monitor} i18next={ctx.i18next} />
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});

const SSL_TONE: Record<SslStatus, BadgeTone> = {
	valid: "up",
	expiring: "degraded",
	expired: "down",
	unknown: "neutral",
};

const SSL_ICON: Record<SslStatus, typeof ShieldCheckIcon> = {
	valid: ShieldCheckIcon,
	expiring: ShieldAlertIcon,
	expired: ShieldXIcon,
	unknown: LockIcon,
};

namespace SslCard {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		i18next: ReturnType<typeof getContext>["i18next"];
	}
}

/** Renders the SSL certificate card: a "not configured" prompt, or the certificate's expiry/issuer details, matching {@link calculateSslStatus}'s classification. */
function SslCard(handle: Handle<SslCard.Props>) {
	return () => {
		let { team, monitor, i18next } = handle.props;
		let editHref = routes.app.team.monitors.edit.href({ team: team.slug, monitorId: monitor.id });

		if (!monitor.ssl_monitoring_enabled) {
			return (
				<div
					mix={[
						css({
							padding: 24,
							borderRadius: 8,
							border: `1px solid ${neutral[200]}`,
							"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
						}),
					]}
				>
					<div
						mix={[
							css({
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								marginBottom: 16,
							}),
						]}
					>
						<div mix={[css({ display: "flex", alignItems: "center", gap: 8 })]}>
							<LockIcon
								size={20}
								strokeWidth={1.5}
								mix={[
									css({
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							/>
							<h3 mix={[css({ margin: 0, fontSize: "1.125rem", fontWeight: 700 })]}>
								{i18next.t("page.monitor.ssl.title")}
							</h3>
						</div>
						<Badge tone="neutral">{i18next.t("page.monitor.ssl.status.unknown")}</Badge>
					</div>
					<div
						mix={[css({ display: "flex", alignItems: "center", justifyContent: "space-between" })]}
					>
						<p
							mix={[
								css({
									margin: 0,
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{i18next.t("page.monitor.ssl.notConfigured")}
						</p>
						<LinkButton href={editHref} color="primary" size="sm">
							<LockIcon size={16} strokeWidth={1.5} />
							{i18next.t("page.monitor.ssl.configure")}
						</LinkButton>
					</div>
				</div>
			);
		}

		let { status, daysUntilExpiry } = calculateSslStatus(
			monitor.ssl_expires_at,
			monitor.ssl_expiry_warning_days,
		);
		let Icon = SSL_ICON[status] ?? LockIcon;

		return (
			<div
				mix={[
					css({
						padding: 24,
						borderRadius: 8,
						border: `1px solid ${neutral[200]}`,
						"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
					}),
				]}
			>
				<div
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: 16,
						}),
					]}
				>
					<div mix={[css({ display: "flex", alignItems: "center", gap: 8 })]}>
						<Icon
							size={20}
							strokeWidth={1.5}
							mix={[
								css({
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						/>
						<h3 mix={[css({ margin: 0, fontSize: "1.125rem", fontWeight: 700 })]}>
							{i18next.t("page.monitor.ssl.title")}
						</h3>
					</div>
					<Badge tone={SSL_TONE[status] ?? "neutral"}>
						{i18next.t(`page.monitor.ssl.status.${status}`)}
					</Badge>
				</div>
				<div
					mix={[
						css({
							display: "grid",
							gap: 16,
							gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
							alignItems: "end",
						}),
					]}
				>
					<div>
						<p
							mix={[
								css({ fontSize: "0.8125rem", marginBottom: 4 }),
								css({
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{i18next.t("page.monitor.ssl.expiresAt")}
						</p>
						<p mix={[css({ fontSize: "1.125rem", fontWeight: 600 })]}>
							{monitor.ssl_expires_at === null
								? "—"
								: new Date(monitor.ssl_expires_at).toLocaleDateString()}
						</p>
						{daysUntilExpiry !== null && (
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": { color: neutral[400] },
									}),
								]}
							>
								{i18next.t("page.monitor.ssl.expiresIn", { days: daysUntilExpiry })}
							</p>
						)}
					</div>
					<div>
						<p
							mix={[
								css({ fontSize: "0.8125rem", marginBottom: 4 }),
								css({
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{i18next.t("page.monitor.ssl.issuer")}
						</p>
						<p mix={[css({ fontSize: "1.125rem", fontWeight: 600 })]}>
							{monitor.ssl_issuer ?? "—"}
						</p>
					</div>
					<div>
						<p
							mix={[
								css({ fontSize: "0.8125rem", marginBottom: 4 }),
								css({
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": { color: neutral[400] },
								}),
							]}
						>
							{i18next.t("page.monitor.ssl.lastChecked")}
						</p>
						<p mix={[css({ fontSize: "1.125rem", fontWeight: 600 })]}>
							{monitor.ssl_last_checked_at === null
								? "—"
								: new Date(monitor.ssl_last_checked_at).toLocaleString()}
						</p>
					</div>
					<div mix={[css({ display: "flex", justifyContent: "flex-end" })]}>
						<LinkButton href={editHref} color="neutral" size="sm">
							<PencilIcon size={16} strokeWidth={1.5} />
							{i18next.t("page.monitor.ssl.configure")}
						</LinkButton>
					</div>
				</div>
			</div>
		);
	};
}
