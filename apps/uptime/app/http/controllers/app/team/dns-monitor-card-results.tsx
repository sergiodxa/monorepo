/**
 * DNS monitor detail page results fragment controller. GET
 * /app/:team/dns/:monitorId/cards/results — loads the monitor's recent check results
 * once and renders both what is derived from them (success rate, average response
 * time, total checks) and the results table itself, with no document shell, so the
 * detail page's results `Frame` can swap it in over its skeleton fallback.
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
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Fragment } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

/** GET /app/:team/dns/:monitorId/cards/results — the monitor's result-derived stats and result table, fragment-only. */
export default createAction(routes.app.team.dnsMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await DnsMonitor.listResults(db, monitor.id);

		let totalChecks = results.length;
		let okChecks = results.filter((result) => result.status === "ok").length;
		let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;
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
						label={ctx.i18next.t("page.dnsMonitorDetail.stats.successRate.label")}
						value={successRate === null ? "—" : `${successRate}%`}
					/>
					<StatCard
						label={ctx.i18next.t("page.dnsMonitorDetail.stats.avgResponseTime.label")}
						value={avgResponseTime === null ? "—" : `${avgResponseTime}ms`}
					/>
					<StatCard
						label={ctx.i18next.t("page.dnsMonitorDetail.stats.totalChecks.label")}
						value={totalChecks}
					/>
				</div>

				<section>
					<h2>{ctx.i18next.t("page.dnsMonitorDetail.results.title")}</h2>
					{results.length === 0 ? (
						<Empty>
							<Empty.Description>
								{ctx.i18next.t("page.dnsMonitorDetail.results.empty")}
							</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={ctx.i18next.t("page.dnsMonitorDetail.results.title")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.checkedAt")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.status")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.findings")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.dnsMonitorDetail.results.table.columns.responseTime")}
										</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{results.map((result) => (
										<Table.Row key={result.id}>
											<Table.Cell>{new Date(result.checked_at).toLocaleString()}</Table.Cell>
											<Table.Cell>
												<Badge {...badgeVariant(STATUS_BADGE_TONE[result.status] ?? "neutral")}>
													{result.status}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{result.error_message ? (
													<code>{result.error_message}</code>
												) : result.records_changed + result.records_missing + result.records_new ===
												  0 ? (
													ctx.i18next.t("page.dnsMonitorDetail.results.noFindings")
												) : (
													ctx.i18next.t("page.dnsMonitorDetail.results.findings", {
														changed: result.records_changed,
														missing: result.records_missing,
														new: result.records_new,
													})
												)}
											</Table.Cell>
											<Table.Cell>
												{result.response_time_ms === null ? "—" : `${result.response_time_ms}ms`}
											</Table.Cell>
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
