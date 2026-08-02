/**
 * Public status page controller. Loads a page by slug — private pages 404, since
 * this route is the page's only access path and private pages have no public route
 * at all. Resolves every attached HTTP/DNS/TCP/cron-job monitor's current status and
 * 90-day uptime bar, and combines them into one page-level status.
 *
 * The response carries a cache policy (see {@link withCachePolicy}), because this is
 * the one page whose traffic spikes exactly when the origin is least able to absorb
 * it: an incident is when everybody reloads a status page at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { conditional, etag, policy, vary } from "@pkg/http/cache";
import { notFound } from "@pkg/http/response/html";
import {
	CircleCheckBigIcon,
	CircleMinusIcon,
	CircleXIcon,
	ClockIcon,
	TriangleAlertIcon,
} from "@pkg/lucide-remix";
import { Badge, Empty } from "@pkg/r3-ui";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { bg, border, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { combine, raw } from "@pkg/u/general";
import { hstack, vstack } from "@pkg/u/layout";
import { dark } from "@pkg/u/responsive";
import { m, maxIs, mbe, p } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textAlign, textDecoration, weight } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { ServiceStatus } from "~/app/services/status-page";
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { SEO } from "~/app/lib/seo";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import { apportionCostByTeam } from "~/app/services/cost";
import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";
import { badgeVariant } from "~/resources/components/badge";
import DocumentLayout from "~/resources/layouts/document";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

/**
 * How long any cache may reuse the rendered page, in milliseconds.
 *
 * Sixty seconds is not a preference: `getTeamHttpSummaries` reads through a KV cache
 * with exactly this TTL, so the page cannot be made staler than the data source it
 * renders. It is also the quantum the page's own "last updated" line is rounded to,
 * which is what keeps the `ETag` stable for as long as the policy claims the bytes
 * are.
 */
const CACHE_WINDOW_MS = 60_000;

/**
 * How long a stale copy may be served while one request refreshes it, in
 * milliseconds. Five minutes of cover is what turns an incident's traffic spike into
 * cache hits with a single origin request behind them, and degrades a slow origin to
 * slightly-old numbers rather than to no page at all.
 */
const STALE_WHILE_REVALIDATE_MS = 300_000;

const BANNER_MIX: Record<ServiceStatus, ReturnType<typeof combine>> = {
	operational: combine([bg("success.tint"), border("success.border"), fg("success.emphasis")]),
	degraded: combine([bg("warning.tint"), border("warning.border"), fg("warning.emphasis")]),
	down: combine([bg("danger.tint"), border("danger.border"), fg("danger.emphasis")]),
	unknown: combine([bg("success.tint"), border("success.border"), fg("success.emphasis")]),
};

/**
 * Icon shown in the overall-status banner. `computeOverallStatus` never actually
 * returns `"unknown"`, but this mirrors {@link BANNER_MIX} and the handler's own
 * `bannerLabel` lookup (built from `ctx.i18next.t("statusPage.banner.*")`) by
 * aliasing it to the operational icon rather than surfacing a separate "unknown"
 * banner state.
 */
const BANNER_ICON: Record<ServiceStatus, typeof CircleCheckBigIcon> = {
	operational: CircleCheckBigIcon,
	degraded: TriangleAlertIcon,
	down: CircleXIcon,
	unknown: CircleCheckBigIcon,
};

const BADGE_TONE: Record<ServiceStatus, BadgeTone> = {
	operational: "up",
	degraded: "degraded",
	down: "down",
	unknown: "neutral",
};

/** Status icon shown left of each card's name, and (operational/degraded/down only) in the overall-status banner. */
const STATUS_ICON: Record<ServiceStatus, typeof CircleCheckBigIcon> = {
	operational: CircleCheckBigIcon,
	degraded: TriangleAlertIcon,
	down: CircleXIcon,
	unknown: CircleMinusIcon,
};

/** Colors a status icon to match its {@link BadgeTone}; combine with the icon's `mix` prop. */
const ICON_COLOR_MIX: Record<BadgeTone, ReturnType<typeof fg>> = {
	up: fg("success"),
	degraded: fg("warning"),
	down: fg("danger"),
	neutral: fg("neutral"),
};

namespace CardStatusIcon {
	export interface Props {
		status: ServiceStatus;
	}
}

/** Colored status icon shown to the left of a card's name, next to its {@link Badge} pill. */
function CardStatusIcon(handle: Handle<CardStatusIcon.Props>) {
	return () => {
		let Icon = STATUS_ICON[handle.props.status];
		return <Icon size={16} mix={[ICON_COLOR_MIX[BADGE_TONE[handle.props.status]]]} />;
	};
}

/** GET /status/:slug — the public view of a status page. */
export default createAction(
	routes.statusPage,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

		let page = await StatusPage.findBySlugPublic(db, slug);
		if (!page) return notFound("Not Found");

		// A public status-page view is cost the team owning the page caused (ADR-007 §5).
		apportionCostByTeam([page.team_id]);

		let attachments = await StatusPage.listAttachments(db, page.id);

		let [allMonitors, allDnsMonitors, allTcpMonitors, allCronJobs, httpSummaries] =
			await Promise.all([
				Monitor.listByTeam(db, page.team_id),
				DnsMonitor.listByTeam(db, page.team_id),
				TcpMonitor.listByTeam(db, page.team_id),
				CronJobMonitor.listByTeam(db, page.team_id),
				getTeamHttpSummaries(page.team_id),
			]);

		let healthByMonitorId = new Map(
			isFailure(httpSummaries)
				? []
				: httpSummaries.data.map((summary) => [summary.monitorId, summary.health]),
		);
		let monitorsById = new Map(allMonitors.map((monitor) => [monitor.id, monitor]));
		let dnsMonitorsById = new Map(allDnsMonitors.map((monitor) => [monitor.id, monitor]));
		let tcpMonitorsById = new Map(allTcpMonitors.map((monitor) => [monitor.id, monitor]));
		let cronJobsById = new Map(allCronJobs.map((monitor) => [monitor.id, monitor]));

		let httpServices = await Promise.all(
			attachments.monitors
				.map((row) => monitorsById.get(row.monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "http" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveHttpStatus(healthByMonitorId.get(monitor.id) ?? "pending"),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "http"),
				})),
		);

		let dnsServices = await Promise.all(
			attachments.dnsMonitors
				.map((row) => dnsMonitorsById.get(row.dns_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "dns" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveDnsStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "dns"),
				})),
		);

		let tcpServices = await Promise.all(
			attachments.tcpMonitors
				.map((row) => tcpMonitorsById.get(row.tcp_monitor_id))
				.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
				.map(async (monitor) => ({
					kind: "tcp" as const,
					id: monitor.id,
					name: monitor.name,
					status: deriveTcpStatus(monitor.last_status),
					days: await MonitorDailyStats.listForCurrentYear(db, monitor.id, "tcp"),
				})),
		);

		let cronServices = attachments.cronJobs
			.map((row) => cronJobsById.get(row.cron_job_monitor_id))
			.filter((monitor): monitor is NonNullable<typeof monitor> => monitor != null)
			.map((monitor) => ({
				kind: "cron" as const,
				id: monitor.id,
				name: monitor.name,
				cronExpression: monitor.cron_expression,
				lastPingAt: monitor.last_ping_at,
				status: deriveCronStatus(monitor.status),
			}));

		let overallStatus = computeOverallStatus([
			...httpServices.map((service) => service.status),
			...dnsServices.map((service) => service.status),
			...tcpServices.map((service) => service.status),
			...cronServices.map((service) => service.status),
		]);

		let heatmapServices = [...httpServices, ...dnsServices, ...tcpServices];
		let isEmpty = heatmapServices.length === 0 && cronServices.length === 0;
		let BannerIcon = BANNER_ICON[overallStatus];

		let bannerLabel: Record<ServiceStatus, string> = {
			operational: ctx.i18next.t("statusPage.banner.operational"),
			degraded: ctx.i18next.t("statusPage.banner.degraded"),
			down: ctx.i18next.t("statusPage.banner.down"),
			unknown: ctx.i18next.t("statusPage.banner.operational"),
		};
		let statusLabel: Record<ServiceStatus, string> = {
			operational: ctx.i18next.t("statusPage.status.operational"),
			degraded: ctx.i18next.t("statusPage.status.degraded"),
			down: ctx.i18next.t("statusPage.status.down"),
			unknown: ctx.i18next.t("statusPage.status.unknown"),
		};
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
		let formatUptime = (percentage: string) =>
			ctx.i18next.t("statusPage.uptimeBar.tooltip.uptime", { percentage });

		/**
		 * The moment the page reports as its own, rounded down to the start of the
		 * current {@link CACHE_WINDOW_MS}. Rounding is what makes the page honest and
		 * cacheable at once: a viewer reading a cached copy is told the time the numbers
		 * are from rather than the time their request arrived, and because the bytes then
		 * stop changing every millisecond, a repeat viewer's `ETag` still matches.
		 */
		let renderedAt = new Date(Math.floor(Date.now() / CACHE_WINDOW_MS) * CACHE_WINDOW_MS);

		let response = await ctx.render(
			<DocumentLayout
				title={page.title}
				locale={ctx.locale}
				seo={{
					// The page owner's own description when they wrote one, falling back to
					// its title. Both are team-authored content, never app copy, so there's
					// nothing here to translate — and no locale key to reach for either.
					description: page.description ?? page.title,
					canonical: SEO.canonical(ctx.url),
				}}
			>
				<main mix={[maxIs("640px"), m(0, "auto"), p("40px", "20px")]}>
					<div mix={[vstack({ align: "center", gap: "4px" }), textAlign("center"), mbe("32px")]}>
						{page.logo_url && (
							<img src={page.logo_url} alt={page.name} width={64} height={64} mix={[mbe("12px")]} />
						)}
						<h1 mix={[m(0, 0, "4px", 0), fontSize("1.875rem"), weight(700)]}>{page.title}</h1>
						{page.description && (
							<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>{page.description}</p>
						)}
					</div>

					{page.show_overall_status && (
						<div
							mix={[
								hstack({ align: "center", justify: "center", gap: "10px" }),
								p("14px", "18px"),
								rounded("8px"),
								border({ color: "transparent", width: 1 }),
								weight(600),
								mbe("24px"),
								BANNER_MIX[overallStatus],
							]}
						>
							<BannerIcon size={22} />
							<span>{bannerLabel[overallStatus]}</span>
						</div>
					)}

					{isEmpty ? (
						<Empty>
							<Empty.Description>{ctx.i18next.t("statusPage.empty.description")}</Empty.Description>
						</Empty>
					) : (
						<>
							{heatmapServices.map((service) => (
								<div
									key={`${service.kind}-${service.id}`}
									mix={[
										vstack({ gap: "8px" }),
										p("16px"),
										rounded("8px"),
										border({ color: "neutral.border", width: 1 }),
										raw({ background: "#ffffff" }),
										mbe("12px"),
										dark(bg("neutral.tint")),
									]}
								>
									<div mix={[hstack({ align: "center", gap: "12px" })]}>
										<CardStatusIcon status={service.status} />
										<strong>{service.name}</strong>
										<Badge {...badgeVariant(BADGE_TONE[service.status])}>
											{statusLabel[service.status]}
										</Badge>
									</div>
									<UptimeBar
										days={service.days}
										labels={uptimeBarLabels}
										formatUptime={formatUptime}
									/>
								</div>
							))}

							{cronServices.length > 0 && (
								<>
									{heatmapServices.length > 0 && (
										<h2>{ctx.i18next.t("statusPage.cronJobs.title")}</h2>
									)}
									{cronServices.map((service) => (
										<div
											key={service.id}
											mix={[
												vstack({ gap: "8px" }),
												p("16px"),
												rounded("8px"),
												border({ color: "neutral.border", width: 1 }),
												raw({ background: "#ffffff" }),
												mbe("12px"),
												dark(bg("neutral.tint")),
											]}
										>
											<div mix={[hstack({ align: "center", gap: "12px" })]}>
												<CardStatusIcon status={service.status} />
												<strong>{service.name}</strong>
												<Badge {...badgeVariant(BADGE_TONE[service.status])}>
													{statusLabel[service.status]}
												</Badge>
											</div>
											<p
												mix={[
													hstack({ align: "center", gap: "4px" }),
													fontSize("0.8125rem"),
													fg("neutral.muted"),
												]}
											>
												<ClockIcon size={12} />
												<span>
													{ctx.i18next.t("statusPage.cronJobs.schedule")}:{" "}
													<code>{service.cronExpression}</code>
												</span>
											</p>
											<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
												{ctx.i18next.t("statusPage.cronJobs.lastPing")}:{" "}
												{service.lastPingAt
													? new Date(service.lastPingAt).toLocaleString()
													: ctx.i18next.t("statusPage.cronJobs.never")}
											</p>
										</div>
									))}
								</>
							)}
						</>
					)}

					<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
						{ctx.i18next.t("statusPage.footer.lastUpdated", { date: renderedAt.toLocaleString() })}{" "}
						·{" "}
						<a
							href={routes.home.href()}
							mix={[fg("brand"), textDecoration("none"), hover(textDecoration("underline"))]}
						>
							{ctx.i18next.t("statusPage.footer.poweredBy")}
						</a>
					</p>
				</main>
			</DocumentLayout>,
		);

		return await withCachePolicy(ctx.request, response);
	}),
);

/**
 * Gives a rendered page its HTTP cache policy and answers a still-current client copy
 * with a `304`.
 *
 * This is what turns "one origin hit per view" into "one origin hit per minute per
 * page, plus `304`s", which is the shape a status page should have. The two savings
 * are separate: `Cache-Control` decides whether a request reaches the Worker at all,
 * while the `ETag` decides whether a body crosses the network to a viewer who is
 * revalidating a copy they already hold.
 *
 * `Vary` is not optional at `public` visibility. The markup is translated per viewer
 * from the `language` cookie and then `Accept-Language`, so a shared cache told to
 * ignore both could hand one viewer another viewer's language. Varying on `Cookie`
 * does cost hit rate for anyone carrying one, which for this route is only the
 * signed-in owner: an anonymous viewer sends no cookie and shares the one hot entry.
 *
 * The body is buffered rather than streamed because an entity tag is a digest of the
 * bytes, and there is nothing to hash until they all exist. Nothing here streams
 * usefully in any case — every query the page renders from is awaited before the
 * first element is produced.
 *
 * @param request - The incoming request, carrying the viewer's validators.
 * @param response - The rendered page.
 * @returns The page with its policy and validator, or a `304` carrying no body.
 */
async function withCachePolicy(request: Request, response: Response): Promise<Response> {
	let body = await response.text();

	let headers = new Headers(response.headers);
	headers.set(
		"Cache-Control",
		policy({
			visibility: "public",
			maxAge: CACHE_WINDOW_MS,
			staleWhileRevalidate: STALE_WHILE_REVALIDATE_MS,
		}).toString(),
	);
	vary(headers, ["Accept-Language", "Cookie"]);

	// Weak, because the page is re-rendered per request rather than served from a
	// stored artifact: it identifies a semantically equivalent render, which is
	// exactly what `renderedAt`'s rounding to the cache window makes it.
	let tag = await etag(body, { weak: true });
	if (!isFailure(tag)) headers.set("ETag", tag.data);

	return await conditional(request, new Response(body, { status: response.status, headers }));
}
