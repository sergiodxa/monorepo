/**
 * HTTP monitor detail page controller. Shows the monitor's usage/performance stat
 * cards, SSL status, and a calendar-year uptime heatmap from `monitor_daily_stats`,
 * plus run/edit actions. Requires `requireUser` + `requireTeam`; 404s when the
 * monitor doesn't belong to the current team. The usage/slowest-result/uptime stat
 * cards and the heatmap all load via named `Frame`s pointed at their own fragment
 * routes (`monitor-card-usage.tsx`, `-slowest-result.tsx`, `-uptime.tsx`,
 * `-heatmap.tsx`), so this controller no longer blocks on any of it (notably Polar's
 * API, the slowest of those fetches) before it can render the page shell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { notFound } from "@pkg/http/response/html";
import { IntlProvider } from "@pkg/i18n/ui";
import {
	LockIcon,
	PencilIcon,
	RefreshCwIcon,
	ShieldAlertIcon,
	ShieldCheckIcon,
	ShieldXIcon,
} from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { flex, flexWrap, gap, grid, items, justify } from "@pkg/u/layout";
import { m, mbe, mbs, p } from "@pkg/u/size";
import { fontSize, weight } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Fragment, Frame } from "remix/ui";

import type { SslStatus } from "~/app/services/ssl-info";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { calculateSslStatus } from "~/app/services/ssl-info";
import Badge from "~/resources/components/badge";
import LinkButton from "~/resources/components/link-button";
import RunMonitorButton from "~/resources/components/run-monitor-button";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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
							{/*
							 * RunMonitorButton is a `clientEntry` island: its render function runs
							 * both server-side (for the no-JS baseline markup) and client-side
							 * (after hydration). Client-side, `intl(handle)` falls back to the
							 * module-scoped default `bootstrap/browser.ts` registers via `setIntl()` —
							 * but that default is never set server-side (it's guarded browser-only,
							 * since a module-scoped instance would leak across concurrent requests in
							 * a Workers isolate), so the SSR pass needs this request-scoped
							 * `IntlProvider` ancestor for `intl(handle)` to resolve at all.
							 */}
							<IntlProvider i18n={ctx.i18next}>
								<RunMonitorButton
									action={routes.actions.monitor.http.play.href({ team: ctx.team.slug })}
									monitorId={monitor.id}
								/>
							</IntlProvider>
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
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<Frame
								name="monitor-card-usage"
								src={routes.app.team.monitors.cards.usage.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={<StatCardSkeleton count={1} />}
							/>
							<Frame
								name="monitor-card-slowest-result"
								src={routes.app.team.monitors.cards.slowestResult.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={<StatCardSkeleton count={1} />}
							/>
							<Frame
								name="monitor-card-uptime"
								src={routes.app.team.monitors.cards.uptime.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={<StatCardSkeleton count={1} />}
							/>
						</div>

						<SslCard team={ctx.team} monitor={monitor} i18next={ctx.i18next} />

						<div mix={[mbs("24px")]}>
							<Frame
								name="monitor-card-heatmap"
								src={routes.app.team.monitors.cards.heatmap.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
								fallback={<StatCardSkeleton count={1} />}
							/>
						</div>
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
				<div mix={[p("24px"), rounded("8px"), border({ color: "neutral.border", width: "1px" })]}>
					<div mix={[flex(), items("center"), justify("between"), mbe("16px")]}>
						<div mix={[flex(), items("center"), gap("8px")]}>
							<LockIcon size={20} strokeWidth={1.5} mix={[fg("neutral.muted")]} />
							<h3 mix={[m("0"), fontSize("1.125rem"), weight(700)]}>
								{i18next.t("page.monitor.ssl.title")}
							</h3>
						</div>
						<Badge tone="neutral">{i18next.t("page.monitor.ssl.status.unknown")}</Badge>
					</div>
					<div mix={[flex(), items("center"), justify("between")]}>
						<p mix={[m("0"), fg("neutral.muted")]}>{i18next.t("page.monitor.ssl.notConfigured")}</p>
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
			<div mix={[p("24px"), rounded("8px"), border({ color: "neutral.border", width: "1px" })]}>
				<div mix={[flex(), items("center"), justify("between"), mbe("16px")]}>
					<div mix={[flex(), items("center"), gap("8px")]}>
						<Icon size={20} strokeWidth={1.5} mix={[fg("neutral.muted")]} />
						<h3 mix={[m("0"), fontSize("1.125rem"), weight(700)]}>
							{i18next.t("page.monitor.ssl.title")}
						</h3>
					</div>
					<Badge tone={SSL_TONE[status] ?? "neutral"}>
						{i18next.t(`page.monitor.ssl.status.${status}`)}
					</Badge>
				</div>
				<div
					mix={[
						grid(),
						gap("16px"),
						items("end"),
						raw({ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }),
					]}
				>
					<div>
						<p mix={[fontSize("0.8125rem"), mbe("4px"), fg("neutral.muted")]}>
							{i18next.t("page.monitor.ssl.expiresAt")}
						</p>
						<p mix={[fontSize("1.125rem"), weight(600)]}>
							{monitor.ssl_expires_at === null
								? "—"
								: new Date(monitor.ssl_expires_at).toLocaleDateString()}
						</p>
						{daysUntilExpiry !== null && (
							<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
								{i18next.t("page.monitor.ssl.expiresIn", { days: daysUntilExpiry })}
							</p>
						)}
					</div>
					<div>
						<p mix={[fontSize("0.8125rem"), mbe("4px"), fg("neutral.muted")]}>
							{i18next.t("page.monitor.ssl.issuer")}
						</p>
						<p mix={[fontSize("1.125rem"), weight(600)]}>{monitor.ssl_issuer ?? "—"}</p>
					</div>
					<div>
						<p mix={[fontSize("0.8125rem"), mbe("4px"), fg("neutral.muted")]}>
							{i18next.t("page.monitor.ssl.lastChecked")}
						</p>
						<p mix={[fontSize("1.125rem"), weight(600)]}>
							{monitor.ssl_last_checked_at === null
								? "—"
								: new Date(monitor.ssl_last_checked_at).toLocaleString()}
						</p>
					</div>
					<div mix={[flex(), justify("end")]}>
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
