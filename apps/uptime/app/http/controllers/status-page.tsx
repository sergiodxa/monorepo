/**
 * Public status page controller — loads a page by slug (private pages 404,
 * since this route is their only access path) and renders every attached
 * monitor's current status and 90-day uptime bar into one page-level status,
 * cached per {@link withCachePolicy}. A DNS monitor's card always reports
 * whole-domain coverage in words, the fact a viewer of the page needs from it.
 * A flow's card carries its name and nothing else it was written from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { conditional, etag, policy, vary } from "@sdxc/http/cache";
import { notFound } from "@sdxc/http/response/html";
import {
	CircleCheckBigIcon,
	CircleMinusIcon,
	CircleXIcon,
	ClockIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { isFailure } from "@sdxc/result";
import { inject } from "@sdxc/service-container";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { dark } from "@sdxc/u/responsive";
import { m, maxIs, mbe, p } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { fontSize, textAlign, textDecoration, weight } from "@sdxc/u/typography";
import { Badge, Empty } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

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
	deriveFlowStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";
import { badgeVariant } from "~/resources/components/badge";
import DocumentLayout from "~/resources/layouts/document";
import UptimeBar from "~/resources/views/shared/uptime-bar";
import routes from "~/routes/web";

/**
 * How long any cache may reuse the rendered page, in milliseconds — matches
 * the KV TTL `getTeamHttpSummaries` reads through and the quantum
 * `renderedAt` rounds to, keeping the page current and its `ETag` stable.
 */
const CACHE_WINDOW_MS = 60_000;

/**
 * How long a stale copy may be served while one request refreshes it, in
 * milliseconds. Five minutes of cover turns an incident's traffic spike into
 * cache hits behind one origin request, serving slightly-old numbers meanwhile.
 */
const STALE_WHILE_REVALIDATE_MS = 300_000;

const BANNER_MIX: Record<ServiceStatus, ReturnType<typeof combine>> = {
	operational: combine([bg("success.tint"), border("success.border"), fg("success.emphasis")]),
	degraded: combine([bg("warning.tint"), border("warning.border"), fg("warning.emphasis")]),
	down: combine([bg("danger.tint"), border("danger.border"), fg("danger.emphasis")]),
	unknown: combine([bg("success.tint"), border("success.border"), fg("success.emphasis")]),
};

/**
 * Icon shown in the overall-status banner. `computeOverallStatus` never
 * returns `"unknown"`, but `ServiceStatus` still requires an entry here;
 * aliasing it to the operational icon keeps this map exhaustive.
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

/**
 * The label a service is published under: the team's public name for it when
 * set, the monitor's internal name otherwise. An empty string falls back to
 * that name too, keeping every row named even after a team clears the field.
 */
function publicName(displayName: string | null, fallback: string): string {
	return displayName?.trim() || fallback;
}

/**
 * GET /status/:slug — the public view of a status page. Viewing it apportions
 * cost to the team that owns the page (ADR-007 §5); its title and description
 * render as the team wrote them, carrying no translation.
 */
export default createAction(
	routes.statusPage,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

		let page = await StatusPage.findBySlugPublic(db, slug);
		if (!page) return notFound("Not Found");

		apportionCostByTeam([page.team_id]);

		let attachments = await StatusPage.listAttachments(db, page.id);

		let [allMonitors, allDnsMonitors, allTcpMonitors, allFlowMonitors, allCronJobs, httpSummaries] =
			await Promise.all([
				Monitor.listByTeam(db, page.team_id),
				DnsMonitor.listByTeam(db, page.team_id),
				TcpMonitor.listByTeam(db, page.team_id),
				/**
				 * Projected to `id`/`name`/`last_status` in the query itself: a flow's spec source
				 * holds the credentials it signs in with, and this page renders to the world.
				 */
				StatusPage.listPublicFlowMonitors(db, page.team_id),
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
		let flowMonitorsById = new Map(allFlowMonitors.map((monitor) => [monitor.id, monitor]));
		let cronJobsById = new Map(allCronJobs.map((monitor) => [monitor.id, monitor]));

		let [httpServices, dnsServices, tcpServices, flowServices] = await Promise.all([
			Promise.all(
				attachments.monitors
					.flatMap((row) => {
						let monitor = monitorsById.get(row.monitor_id);
						return monitor ? [{ displayName: row.display_name, monitor }] : [];
					})
					.map(async ({ displayName, monitor }) => ({
						kind: "http" as const,
						id: monitor.id,
						name: publicName(displayName, monitor.name),
						status: deriveHttpStatus(healthByMonitorId.get(monitor.id) ?? "pending"),
						days: await MonitorDailyStats.listRecentDays(db, monitor.id, "http"),
					})),
			),
			Promise.all(
				attachments.dnsMonitors
					.flatMap((row) => {
						let monitor = dnsMonitorsById.get(row.dns_monitor_id);
						return monitor ? [{ displayName: row.display_name, monitor }] : [];
					})
					.map(async ({ displayName, monitor }) => ({
						kind: "dns" as const,
						id: monitor.id,
						name: publicName(displayName, monitor.name),
						status: deriveDnsStatus(monitor.last_status),
						days: await MonitorDailyStats.listRecentDays(db, monitor.id, "dns"),
					})),
			),
			Promise.all(
				attachments.tcpMonitors
					.flatMap((row) => {
						let monitor = tcpMonitorsById.get(row.tcp_monitor_id);
						return monitor ? [{ displayName: row.display_name, monitor }] : [];
					})
					.map(async ({ displayName, monitor }) => ({
						kind: "tcp" as const,
						id: monitor.id,
						name: publicName(displayName, monitor.name),
						status: deriveTcpStatus(monitor.last_status),
						days: await MonitorDailyStats.listRecentDays(db, monitor.id, "tcp"),
					})),
			),
			Promise.all(
				attachments.flowMonitors
					.flatMap((row) => {
						let monitor = flowMonitorsById.get(row.flow_monitor_id);
						return monitor ? [{ displayName: row.display_name, monitor }] : [];
					})
					.map(async ({ displayName, monitor }) => ({
						kind: "flow" as const,
						id: monitor.id,
						name: publicName(displayName, monitor.name),
						status: deriveFlowStatus(monitor.last_status),
						days: await MonitorDailyStats.listRecentDays(db, monitor.id, "flow"),
					})),
			),
		]);

		let cronServices = attachments.cronJobs
			.flatMap((row) => {
				let monitor = cronJobsById.get(row.cron_job_monitor_id);
				return monitor ? [{ displayName: row.display_name, monitor }] : [];
			})
			.map(({ displayName, monitor }) => ({
				kind: "cron" as const,
				id: monitor.id,
				name: publicName(displayName, monitor.name),
				cronExpression: monitor.cron_expression,
				lastPingAt: monitor.last_ping_at,
				status: deriveCronStatus(monitor.status),
			}));

		let overallStatus = computeOverallStatus([
			...httpServices.map((service) => service.status),
			...dnsServices.map((service) => service.status),
			...tcpServices.map((service) => service.status),
			...flowServices.map((service) => service.status),
			...cronServices.map((service) => service.status),
		]);

		let barServices = [...httpServices, ...dnsServices, ...tcpServices, ...flowServices];
		let isEmpty = barServices.length === 0 && cronServices.length === 0;
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
		 * current {@link CACHE_WINDOW_MS}. Rounding ties the reported time to the
		 * data's freshness window, keeping a repeat viewer's `ETag` stable within it.
		 */
		let renderedAt = new Date(Math.floor(Date.now() / CACHE_WINDOW_MS) * CACHE_WINDOW_MS);

		let response = await ctx.render(
			<DocumentLayout
				title={page.title}
				locale={ctx.locale}
				seo={{
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
							{barServices.map((service) => (
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
									{service.kind === "dns" && (
										<p mix={[fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("statusPage.dns.coverage")}
										</p>
									)}
									<UptimeBar
										days={service.days}
										labels={uptimeBarLabels}
										formatUptime={formatUptime}
									/>
								</div>
							))}

							{cronServices.length > 0 && (
								<>
									{barServices.length > 0 && <h2>{ctx.i18next.t("statusPage.cronJobs.title")}</h2>}
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
 * Gives a rendered page its HTTP cache policy and answers a still-current
 * client copy with a `304`. `Vary` includes `Cookie` since the markup is
 * translated per viewer, with a weak `ETag` matching each fresh render.
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

	let tag = await etag(body, { weak: true });
	if (!isFailure(tag)) headers.set("ETag", tag.data);

	return await conditional(request, new Response(body, { status: response.status, headers }));
}
