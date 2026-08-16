/**
 * TCP monitor detail page results fragment controller. GET
 * /app/:team/tcp/:monitorId/cards/results — loads the monitor's recent check results
 * once and renders both what is derived from them (uptime rate, average response time,
 * total checks) and the results table itself, with no document shell, so the detail
 * page's results `Frame` can swap it in over its skeleton fallback.
 *
 * The stat cards live here rather than on the page because every one of them is a
 * reduction over the same result rows: leaving them behind would mean the page paying
 * for the query it was restructured to avoid. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { flex, flexWrap, gap } from "@pkg/u/layout";
import { mbe } from "@pkg/u/size";
import { Badge, Empty, Table } from "@pkg/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Fragment } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import TcpMonitor from "~/app/data/tcp-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
};

/** GET /app/:team/tcp/:monitorId/cards/results — the monitor's result-derived stats and result table, fragment-only. */
export default createAction(routes.app.team.tcpMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await TcpMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await TcpMonitor.listResults(db, monitor.id);

		let totalChecks = results.length;
		let upChecks = results.filter((result) => result.status === "up").length;
		let uptimePercent = totalChecks > 0 ? Math.round((upChecks / totalChecks) * 100) : null;
		let timedResults = results.filter((result) => result.response_time_ms !== null);
		let avgResponseTime =
			timedResults.length > 0
				? Math.round(
						timedResults.reduce((sum, result) => sum + (result.response_time_ms ?? 0), 0) /
							timedResults.length,
					)
				: null;

		return ctx.render(
			<Fragment>
				<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
					<StatCard
						label={ctx.i18next.t("page.tcpMonitorDetail.stats.uptime.label")}
						value={uptimePercent === null ? "—" : `${uptimePercent}%`}
					/>
					<StatCard
						label={ctx.i18next.t("page.tcpMonitorDetail.stats.avgResponseTime.label")}
						value={avgResponseTime === null ? "—" : `${avgResponseTime}ms`}
					/>
					<StatCard
						label={ctx.i18next.t("page.tcpMonitorDetail.stats.totalChecks.label")}
						value={totalChecks}
					/>
				</div>

				<section>
					<h2>{ctx.i18next.t("page.tcpMonitorDetail.results.title")}</h2>
					{results.length === 0 ? (
						<Empty>
							<Empty.Description>
								{ctx.i18next.t("page.tcpMonitorDetail.results.empty")}
							</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={ctx.i18next.t("page.tcpMonitorDetail.results.label")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{ctx.i18next.t("page.tcpMonitorDetail.results.columns.time")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.tcpMonitorDetail.results.columns.status")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.tcpMonitorDetail.results.columns.responseTime")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.tcpMonitorDetail.results.columns.error")}
										</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{results.map((result) => (
										<Table.Row key={result.id}>
											<Table.Cell>{new Date(result.checked_at).toLocaleString()}</Table.Cell>
											<Table.Cell>
												<Badge {...badgeVariant(STATUS_BADGE_TONE[result.status] ?? "neutral")}>
													{ctx.i18next.t(`page.tcpMonitors.table.status.${result.status}`)}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}
											</Table.Cell>
											<Table.Cell>{result.error_message ?? "—"}</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</section>
			</Fragment>,
		);
	}),
});
