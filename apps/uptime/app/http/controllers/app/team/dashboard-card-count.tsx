/**
 * Dashboard per-monitor-type count stat-card fragment controller. Loads only
 * the one monitor table named by `:resource` and renders its `StatCard`
 * directly, with no document shell, so each of the dashboard's count
 * `Frame`s can swap in independently over its own skeleton fallback.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap, items } from "@pkg/u/layout";
import { mbs } from "@pkg/u/size";
import { Badge } from "@pkg/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import FlowMonitor from "~/app/data/flow-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

const RESOURCES = ["http", "dns", "tcp", "flow", "cron-jobs"] as const;

namespace Breakdown {
	export interface Props {
		/**
		 * Every state the card tracks, in the order they read, each with the count that
		 * decides whether it is drawn at all and the already-translated text naming it.
		 */
		states: Array<{ count: number; tone: BadgeTone; label: string }>;
	}
}

/**
 * A count card's per-state breakdown: one badge per state, reading "<count>
 * <state>", shown only for states with a nonzero count so a card never states a fact
 * about nothing like "0 error". A `<span>`, since it renders inside `StatCard`'s value span, which admits only phrasing content.
 */
function Breakdown(handle: Handle<Breakdown.Props>) {
	return () => (
		<span mix={[flex(), flexWrap(), items("center"), gap("6px"), mbs("0.25rem")]}>
			{handle.props.states
				.filter((state) => state.count > 0)
				.map((state) => (
					<Badge key={state.label} {...badgeVariant(state.tone)}>
						{state.label}
					</Badge>
				))}
		</span>
	);
}

/**
 * GET /app/:team/dashboard/cards/count/:resource — one monitor-type count stat card,
 * fragment-only. HTTP's up/down state lives per-check in Analytics Engine, so its
 * breakdown pairs a summaries query with `Monitor.listByTeam` for the total.
 */
export default createAction(routes.app.team.dashboard.cards.count, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { resource } = s.parse(s.object({ resource: s.enum_(RESOURCES) }), ctx.params);

		if (resource === "dns") {
			let dnsMonitors = await DnsMonitor.listByTeam(db, ctx.team.id);
			let dnsCounts = {
				total: dnsMonitors.length,
				ok: dnsMonitors.filter((monitor) => monitor.last_status === "ok").length,
				changed: dnsMonitors.filter((monitor) => monitor.last_status === "changed").length,
				error: dnsMonitors.filter((monitor) => monitor.last_status === "error").length,
			};

			return ctx.render(
				<StatCard
					label={ctx.i18next.t("page.dashboard.stats.dnsMonitors.label")}
					create={{
						href: routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.i18next.t("page.dashboard.stats.dnsMonitors.create"),
					}}
					value={
						<>
							{dnsCounts.total}
							<Breakdown
								states={[
									{
										count: dnsCounts.ok,
										tone: "up",
										label: ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.ok", {
											ok: dnsCounts.ok,
										}),
									},
									{
										count: dnsCounts.changed,
										tone: "degraded",
										label: ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.changed", {
											changed: dnsCounts.changed,
										}),
									},
									{
										count: dnsCounts.error,
										tone: "down",
										label: ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.error", {
											error: dnsCounts.error,
										}),
									},
								]}
							/>
						</>
					}
				/>,
			);
		}

		if (resource === "tcp") {
			let tcpMonitors = await TcpMonitor.listByTeam(db, ctx.team.id);
			let tcpCounts = {
				total: tcpMonitors.length,
				up: tcpMonitors.filter((monitor) => monitor.last_status === "up").length,
				down: tcpMonitors.filter(
					(monitor) => monitor.last_status === "down" || monitor.last_status === "timeout",
				).length,
			};

			return ctx.render(
				<StatCard
					label={ctx.i18next.t("page.dashboard.stats.tcpMonitors.label")}
					create={{
						href: routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.i18next.t("page.dashboard.stats.tcpMonitors.create"),
					}}
					value={
						<>
							{tcpCounts.total}
							<Breakdown
								states={[
									{
										count: tcpCounts.up,
										tone: "up",
										label: ctx.i18next.t("page.dashboard.stats.tcpMonitors.breakdown.up", {
											up: tcpCounts.up,
										}),
									},
									{
										count: tcpCounts.down,
										tone: "down",
										label: ctx.i18next.t("page.dashboard.stats.tcpMonitors.breakdown.down", {
											down: tcpCounts.down,
										}),
									},
								]}
							/>
						</>
					}
				/>,
			);
		}

		if (resource === "flow") {
			let flowMonitors = await FlowMonitor.listByTeam(db, ctx.team.id);
			let flowCounts = {
				total: flowMonitors.length,
				up: flowMonitors.filter((monitor) => monitor.last_status === "up").length,
				down: flowMonitors.filter((monitor) => monitor.last_status === "down").length,
				/**
				 * Tracked as its own degraded-toned pill, since a flow that could not run
				 * signals this app's own visibility gap (ADR-027 §8); keeping it separate
				 * keeps the outage count faithful to the customer's actual flow failures.
				 */
				error: flowMonitors.filter((monitor) => monitor.last_status === "error").length,
			};

			return ctx.render(
				<StatCard
					label={ctx.i18next.t("page.dashboard.stats.flowMonitors.label")}
					create={{
						href: routes.app.team.flowMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.i18next.t("page.dashboard.stats.flowMonitors.create"),
					}}
					value={
						<>
							{flowCounts.total}
							<Breakdown
								states={[
									{
										count: flowCounts.up,
										tone: "up",
										label: ctx.i18next.t("page.dashboard.stats.flowMonitors.breakdown.up", {
											up: flowCounts.up,
										}),
									},
									{
										count: flowCounts.down,
										tone: "down",
										label: ctx.i18next.t("page.dashboard.stats.flowMonitors.breakdown.down", {
											down: flowCounts.down,
										}),
									},
									{
										count: flowCounts.error,
										tone: "degraded",
										label: ctx.i18next.t("page.dashboard.stats.flowMonitors.breakdown.error", {
											error: flowCounts.error,
										}),
									},
								]}
							/>
						</>
					}
				/>,
			);
		}

		if (resource === "cron-jobs") {
			let cronJobMonitors = await CronJobMonitor.listByTeam(db, ctx.team.id);
			let cronCounts = {
				total: cronJobMonitors.length,
				healthy: cronJobMonitors.filter((monitor) => monitor.status === "healthy").length,
				late: cronJobMonitors.filter((monitor) => monitor.status === "late").length,
				missed: cronJobMonitors.filter((monitor) => monitor.status === "missed").length,
			};

			return ctx.render(
				<StatCard
					label={ctx.i18next.t("page.dashboard.stats.cronJobs.label")}
					create={{
						href: routes.app.team.cronJobs.new.href({ team: ctx.team.slug }),
						label: ctx.i18next.t("page.dashboard.stats.cronJobs.create"),
					}}
					value={
						<>
							{cronCounts.total}
							<Breakdown
								states={[
									{
										count: cronCounts.healthy,
										tone: "up",
										label: ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.healthy", {
											healthy: cronCounts.healthy,
										}),
									},
									{
										count: cronCounts.late,
										tone: "degraded",
										label: ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.late", {
											late: cronCounts.late,
										}),
									},
									{
										count: cronCounts.missed,
										tone: "down",
										label: ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.missed", {
											missed: cronCounts.missed,
										}),
									},
								]}
							/>
						</>
					}
				/>,
			);
		}

		let [monitors, summaries] = await Promise.all([
			Monitor.listByTeam(db, ctx.team.id),
			getTeamHttpSummaries(ctx.team.id),
		]);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let httpCounts = {
			total: monitors.length,
			up: summaryList.filter((summary) => summary.health === "up").length,
			down: summaryList.filter((summary) => summary.health === "down").length,
		};

		return ctx.render(
			<StatCard
				label={ctx.i18next.t("page.dashboard.stats.httpMonitors.label")}
				create={{
					href: routes.app.team.monitors.new.href({ team: ctx.team.slug }),
					label: ctx.i18next.t("page.dashboard.stats.httpMonitors.create"),
				}}
				value={
					<>
						{httpCounts.total}
						<Breakdown
							states={[
								{
									count: httpCounts.up,
									tone: "up",
									label: ctx.i18next.t("page.dashboard.stats.httpMonitors.breakdown.up", {
										up: httpCounts.up,
									}),
								},
								{
									count: httpCounts.down,
									tone: "down",
									label: ctx.i18next.t("page.dashboard.stats.httpMonitors.breakdown.down", {
										down: httpCounts.down,
									}),
								},
							]}
						/>
					</>
				}
			/>,
		);
	}),
});
