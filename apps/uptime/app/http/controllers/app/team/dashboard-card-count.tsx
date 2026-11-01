/**
 * Dashboard per-monitor-type count stat-card fragment controller. Loads only the
 * one monitor table named by `:resource` and renders its `StatCard` directly, with
 * no document shell, so each of the dashboard's count `Frame`s swaps in on its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PlusIcon } from "@sdxc/icons";
import { isFailure } from "@sdxc/result";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flex, flexWrap, gap, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { StatusDot } from "@sdxc/ui";
import { StatCard } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import routes from "~/routes/web";

const RESOURCES = ["http", "dns", "tcp", "flow", "cron-jobs"] as const;

/** The role a state reads in: healthy, needs a look, or broken. */
type Tone = "success" | "warning" | "danger";

namespace CountCard {
	export interface Props {
		label: string;
		total: number;
		/** Where this type's creation form lives, with the link's accessible name. */
		create: { href: string; label: string };
		/**
		 * Every state the card tracks, in the order they read, each with the count that
		 * decides whether it is drawn at all and the already-translated text naming it.
		 */
		states: Array<{ count: number; tone: Tone; label: string }>;
	}
}

/**
 * One monitor type's count: the total, a create link on the label's line, and a footer of
 * status dots reading "<count> <state>" for each state with a nonzero count, so a card never
 * states a fact about nothing like "0 error".
 */
function CountCard(handle: Handle<CountCard.Props>) {
	return () => {
		let { label, total, create, states } = handle.props;
		let shown = states.filter((state) => state.count > 0);

		return (
			<StatCard>
				<StatCard.Label mix={[flex(), items("center"), justify("between"), gap("8px")]}>
					<span>{label}</span>
					<a
						href={create.href}
						aria-label={create.label}
						title={create.label}
						mix={[
							inlineFlex(),
							items("center"),
							justify("center"),
							is("28px"),
							bs("28px"),
							shrink(),
							rounded(),
							fg("neutral.muted"),
							hover([bg("neutral.bg-tint-hover"), fg("neutral.emphasis")]),
						]}
					>
						<PlusIcon size={16} strokeWidth={1.5} />
					</a>
				</StatCard.Label>
				<StatCard.Value>{total}</StatCard.Value>
				{shown.length > 0 && (
					<StatCard.Footer mix={[flex(), flexWrap(), items("center"), gap("4px", "12px")]}>
						{shown.map((state) => (
							<StatusDot key={state.label} color={state.tone}>
								{state.label}
							</StatusDot>
						))}
					</StatCard.Footer>
				)}
			</StatCard>
		);
	};
}

/**
 * GET /app/:team/dashboard/cards/count/:resource — one monitor-type count stat card,
 * fragment-only. HTTP's up/down state lives per-check in Analytics Engine, so its
 * breakdown pairs a summaries query with the team's monitor list for the total.
 */
export default createAction(routes.app.team.dashboard.cards.count, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { resource } = s.parse(s.object({ resource: s.enum_(RESOURCES) }), ctx.params);

		if (resource === "dns") {
			let dnsMonitors = await ctx.models.dnsMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			let dnsCounts = {
				total: dnsMonitors.length,
				ok: dnsMonitors.filter((monitor) => monitor.last_status === "ok").length,
				changed: dnsMonitors.filter((monitor) => monitor.last_status === "changed").length,
				error: dnsMonitors.filter((monitor) => monitor.last_status === "error").length,
			};

			return ctx.render(
				<CountCard
					label={ctx.intl.t("page.dashboard.stats.dnsMonitors.label")}
					total={dnsCounts.total}
					create={{
						href: routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.intl.t("page.dashboard.stats.dnsMonitors.create"),
					}}
					states={[
						{
							count: dnsCounts.ok,
							tone: "success",
							label: ctx.intl.t("page.dashboard.stats.dnsMonitors.breakdown.ok", {
								ok: dnsCounts.ok,
							}),
						},
						{
							count: dnsCounts.changed,
							tone: "warning",
							label: ctx.intl.t("page.dashboard.stats.dnsMonitors.breakdown.changed", {
								changed: dnsCounts.changed,
							}),
						},
						{
							count: dnsCounts.error,
							tone: "danger",
							label: ctx.intl.t("page.dashboard.stats.dnsMonitors.breakdown.error", {
								error: dnsCounts.error,
							}),
						},
					]}
				/>,
			);
		}

		if (resource === "tcp") {
			let tcpMonitors = await ctx.models.tcpMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			let tcpCounts = {
				total: tcpMonitors.length,
				up: tcpMonitors.filter((monitor) => monitor.last_status === "up").length,
				down: tcpMonitors.filter(
					(monitor) => monitor.last_status === "down" || monitor.last_status === "timeout",
				).length,
			};

			return ctx.render(
				<CountCard
					label={ctx.intl.t("page.dashboard.stats.tcpMonitors.label")}
					total={tcpCounts.total}
					create={{
						href: routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.intl.t("page.dashboard.stats.tcpMonitors.create"),
					}}
					states={[
						{
							count: tcpCounts.up,
							tone: "success",
							label: ctx.intl.t("page.dashboard.stats.tcpMonitors.breakdown.up", {
								up: tcpCounts.up,
							}),
						},
						{
							count: tcpCounts.down,
							tone: "danger",
							label: ctx.intl.t("page.dashboard.stats.tcpMonitors.breakdown.down", {
								down: tcpCounts.down,
							}),
						},
					]}
				/>,
			);
		}

		if (resource === "flow") {
			let flowMonitors = await ctx.models.flowMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			let flowCounts = {
				total: flowMonitors.length,
				up: flowMonitors.filter((monitor) => monitor.last_status === "up").length,
				down: flowMonitors.filter((monitor) => monitor.last_status === "down").length,
				/**
				 * Tracked as its own warning-toned dot, since a flow that could not run
				 * signals this app's own visibility gap; keeping it separate
				 * keeps the outage count faithful to the customer's actual flow failures.
				 */
				error: flowMonitors.filter((monitor) => monitor.last_status === "error").length,
			};

			return ctx.render(
				<CountCard
					label={ctx.intl.t("page.dashboard.stats.flowMonitors.label")}
					total={flowCounts.total}
					create={{
						href: routes.app.team.flowMonitors.new.href({ team: ctx.team.slug }),
						label: ctx.intl.t("page.dashboard.stats.flowMonitors.create"),
					}}
					states={[
						{
							count: flowCounts.up,
							tone: "success",
							label: ctx.intl.t("page.dashboard.stats.flowMonitors.breakdown.up", {
								up: flowCounts.up,
							}),
						},
						{
							count: flowCounts.down,
							tone: "danger",
							label: ctx.intl.t("page.dashboard.stats.flowMonitors.breakdown.down", {
								down: flowCounts.down,
							}),
						},
						{
							count: flowCounts.error,
							tone: "warning",
							label: ctx.intl.t("page.dashboard.stats.flowMonitors.breakdown.error", {
								error: flowCounts.error,
							}),
						},
					]}
				/>,
			);
		}

		if (resource === "cron-jobs") {
			let cronJobMonitors = await ctx.models.cronJobMonitors
				.inTeam(ctx.team.id)
				.orderBy("created_at", "desc")
				.all();
			let cronCounts = {
				total: cronJobMonitors.length,
				healthy: cronJobMonitors.filter((monitor) => monitor.status === "healthy").length,
				late: cronJobMonitors.filter((monitor) => monitor.status === "late").length,
				missed: cronJobMonitors.filter((monitor) => monitor.status === "missed").length,
			};

			return ctx.render(
				<CountCard
					label={ctx.intl.t("page.dashboard.stats.cronJobs.label")}
					total={cronCounts.total}
					create={{
						href: routes.app.team.cronJobs.new.href({ team: ctx.team.slug }),
						label: ctx.intl.t("page.dashboard.stats.cronJobs.create"),
					}}
					states={[
						{
							count: cronCounts.healthy,
							tone: "success",
							label: ctx.intl.t("page.dashboard.stats.cronJobs.breakdown.healthy", {
								healthy: cronCounts.healthy,
							}),
						},
						{
							count: cronCounts.late,
							tone: "warning",
							label: ctx.intl.t("page.dashboard.stats.cronJobs.breakdown.late", {
								late: cronCounts.late,
							}),
						},
						{
							count: cronCounts.missed,
							tone: "danger",
							label: ctx.intl.t("page.dashboard.stats.cronJobs.breakdown.missed", {
								missed: cronCounts.missed,
							}),
						},
					]}
				/>,
			);
		}

		let [monitors, summaries] = await Promise.all([
			ctx.models.monitors.inTeam(ctx.team.id).orderBy("created_at", "desc").all(),
			getTeamHttpSummaries(ctx.team.id),
		]);
		let summaryList = isFailure(summaries) ? [] : summaries.data;
		let httpCounts = {
			total: monitors.length,
			up: summaryList.filter((summary) => summary.health === "up").length,
			down: summaryList.filter((summary) => summary.health === "down").length,
		};

		return ctx.render(
			<CountCard
				label={ctx.intl.t("page.dashboard.stats.httpMonitors.label")}
				total={httpCounts.total}
				create={{
					href: routes.app.team.monitors.new.href({ team: ctx.team.slug }),
					label: ctx.intl.t("page.dashboard.stats.httpMonitors.create"),
				}}
				states={[
					{
						count: httpCounts.up,
						tone: "success",
						label: ctx.intl.t("page.dashboard.stats.httpMonitors.breakdown.up", {
							up: httpCounts.up,
						}),
					},
					{
						count: httpCounts.down,
						tone: "danger",
						label: ctx.intl.t("page.dashboard.stats.httpMonitors.breakdown.down", {
							down: httpCounts.down,
						}),
					},
				]}
			/>,
		);
	},
});
