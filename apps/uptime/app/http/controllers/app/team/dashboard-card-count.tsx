/**
 * Dashboard per-monitor-type count stat-card fragment controller. GET
 * /app/:team/dashboard/cards/count/:resource — loads only the one monitor table
 * named by `:resource` (http, dns, tcp, or cron-jobs) and renders its `StatCard`
 * directly, with no document shell, so each of the dashboard's four count `Frame`s
 * (one per resource, all pointed at this same parameterized route) can swap in
 * independently over its own skeleton fallback. Requires `requireUser` + `requireTeam`.
 *
 * Every one of the four counts something a visitor can create, so every card carries the
 * link to that type's own form — which is the dashboard's only route to one now that the
 * header holds the quick check where a single "create monitor" button used to be.
 *
 * Each card's status breakdown is one line per state, and every line is its own
 * translation key rather than one interpolated sentence: a single string would have to
 * be cut apart on a separator to be stacked, and which separator a language uses — or
 * whether it uses one at all — is exactly the sort of thing a translation is free to
 * change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { flex, flexCol } from "@pkg/u/layout";
import { minBs } from "@pkg/u/size";
import { text } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import Monitor from "~/app/data/monitor";
import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { getTeamHttpSummaries } from "~/app/services/analytics";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";
import routes from "~/routes/web";

const RESOURCES = ["http", "dns", "tcp", "cron-jobs"] as const;

/**
 * How many breakdown lines every count card holds room for, whatever it has to say.
 * The four cards break down into either two states (http, tcp) or three (dns, cron
 * jobs), and they sit side by side in one wrapping row, so the taller shape sets
 * the row's height: a two-state card that only reserved its own two lines would be
 * shorter than its neighbours. The skeleton the dashboard shows while each card streams
 * in reads this same number, so the fallback and the card it becomes are the same
 * height and nothing moves when they swap.
 */
export const COUNT_CARD_BREAKDOWN_LINES = 3;

namespace Breakdown {
	export interface Props {
		/** One already-translated line per state, rendered in order. */
		lines: string[];
	}
}

/**
 * A count card's per-state breakdown: one muted line per state, stacked, in a box that
 * reserves {@link COUNT_CARD_BREAKDOWN_LINES} lines' worth of height even when there are
 * fewer lines to fill it — the leftover stays empty rather than being padded with a
 * state the card does not actually track.
 *
 * The reserved height is written in the subtitle's own line box (`1lh` under `text("sm")`,
 * the step `Subtitle` renders at) plus each line's 0.25rem top margin, so it follows the
 * type scale instead of freezing today's pixels. The box is a flex column because margins
 * do not collapse through a flex container: the first line's top margin keeps separating
 * the stack from the figure above it, exactly as a lone `Subtitle` did.
 *
 * A `<span>` rather than a `<div>`, because this renders inside `StatCard`'s value span,
 * which only admits phrasing content; the flex display makes it a block box regardless.
 */
function Breakdown(handle: Handle<Breakdown.Props>) {
	return () => (
		<span
			mix={[
				flex(),
				flexCol(),
				text("sm"),
				minBs(`calc(${COUNT_CARD_BREAKDOWN_LINES} * (1lh + 0.25rem))`),
			]}
		>
			{handle.props.lines.map((line, index) => (
				<Subtitle key={index}>{line}</Subtitle>
			))}
		</span>
	);
}

/** GET /app/:team/dashboard/cards/count/:resource — one monitor-type count stat card, fragment-only. */
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
								lines={[
									ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.ok", {
										ok: dnsCounts.ok,
									}),
									ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.changed", {
										changed: dnsCounts.changed,
									}),
									ctx.i18next.t("page.dashboard.stats.dnsMonitors.breakdown.error", {
										error: dnsCounts.error,
									}),
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
								lines={[
									ctx.i18next.t("page.dashboard.stats.tcpMonitors.breakdown.up", {
										up: tcpCounts.up,
									}),
									ctx.i18next.t("page.dashboard.stats.tcpMonitors.breakdown.down", {
										down: tcpCounts.down,
									}),
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
								lines={[
									ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.healthy", {
										healthy: cronCounts.healthy,
									}),
									ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.late", {
										late: cronCounts.late,
									}),
									ctx.i18next.t("page.dashboard.stats.cronJobs.breakdown.missed", {
										missed: cronCounts.missed,
									}),
								]}
							/>
						</>
					}
				/>,
			);
		}

		// HTTP up/down state is only recorded per-check in Analytics Engine, not as a
		// column on the `monitors` row (unlike DNS/TCP/cron jobs' `last_status`/`status`),
		// so this card's breakdown comes from a summaries query rather than
		// `Monitor.listByTeam` alone.
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
							lines={[
								ctx.i18next.t("page.dashboard.stats.httpMonitors.breakdown.up", {
									up: httpCounts.up,
								}),
								ctx.i18next.t("page.dashboard.stats.httpMonitors.breakdown.down", {
									down: httpCounts.down,
								}),
							]}
						/>
					</>
				}
			/>,
		);
	}),
});
