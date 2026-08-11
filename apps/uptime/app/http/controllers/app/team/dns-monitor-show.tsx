/**
 * DNS monitor detail page controller. Requires `requireUser` + `requireTeam`; 404s
 * when the monitor doesn't belong to the current team.
 *
 * The controller reads the monitor row and nothing else, so the shell reaches the
 * browser on one query. The cards it does render — domain, record type, status,
 * expected/current value — are all fields of that row, so they cost nothing extra.
 * The two things that cost a query each, the 90-day uptime bar and the result history
 * (with the success-rate/response-time/total-checks cards derived from it), load into
 * their own named `Frame`s over a skeleton fallback, so neither delays the page nor
 * the other. The bar sits above the table for the same reason it does everywhere: the
 * summary is read first, the rows only when it prompts a question.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { PencilIcon, PlayIcon, RefreshCwIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap, items } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { mbe } from "@pkg/u/size";
import { Badge, Button, LinkButton } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Frame } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

/** GET /app/:team/dns/:monitorId — a DNS monitor's detail page. */
export default createAction(routes.app.team.dnsMonitors.show, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);
		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${monitor.name}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.dnsMonitorDetail.header.title", { name: monitor.name })}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dnsMonitors"),
							href: routes.app.team.dnsMonitors.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<div mix={[flex(), items("center"), gap("12px")]}>
							<form
								method="post"
								action={routes.actions.monitor.dns.check.href({ team: ctx.team.slug })}
								mix={[m("0")]}
							>
								<input type="hidden" name="monitor_id" value={monitor.id} />
								<Button type="submit">
									<PlayIcon size={16} strokeWidth={1.5} />
									{ctx.i18next.t("page.dnsMonitorDetail.header.action.check")}
								</Button>
							</form>
							<LinkButton
								href={routes.app.team.dnsMonitors.show.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<RefreshCwIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.refresh")}
							</LinkButton>
							<LinkButton
								href={routes.app.team.dnsMonitors.edit.href({
									team: ctx.team.slug,
									monitorId: monitor.id,
								})}
							>
								<PencilIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.dnsMonitorDetail.header.action.edit")}
							</LinkButton>
						</div>
					}
				>
					<div>
						<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.domain")}
								value={<code>{monitor.domain}</code>}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.status")}
								value={
									<Badge
										{...badgeVariant(STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral")}
									>
										{monitor.last_status ?? ctx.i18next.t("page.dnsMonitorDetail.notChecked")}
									</Badge>
								}
							/>
							<StatCard
								label={ctx.i18next.t("page.dnsMonitorDetail.info.zoneFileImported")}
								value={
									monitor.zone_file_imported_at === null
										? ctx.i18next.t("page.dnsMonitorDetail.info.zoneFileNeverImported")
										: new Date(monitor.zone_file_imported_at).toLocaleString()
								}
							/>
						</div>

						<Frame
							name="dns-monitor-card-uptime-history"
							src={routes.app.team.dnsMonitors.cards.uptimeHistory.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={<StatCardSkeleton count={1} />}
						/>

						<Frame
							name="dns-monitor-card-results"
							src={routes.app.team.dnsMonitors.cards.results.href({
								team: ctx.team.slug,
								monitorId: monitor.id,
							})}
							fallback={<StatCardSkeleton count={3} />}
						/>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
