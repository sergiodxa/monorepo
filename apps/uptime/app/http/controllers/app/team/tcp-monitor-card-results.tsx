/**
 * TCP monitor detail page results fragment controller. GET
 * /app/:team/tcp/:monitorId/cards/results — loads the monitor's recent check results
 * once and renders both what is derived from them (uptime rate, average response time,
 * total checks) and the check log itself, so the page never queries the results twice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import { notFound } from "@sdxc/http/response/html";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize, overflowWrap, weight } from "@sdxc/u/typography";
import { Empty, StatCard, Table } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/** The dot color each check outcome is drawn in. */
const STATUS_COLOR: Record<string, SemanticColor> = {
	up: "success",
	timeout: "warning",
	down: "danger",
};

/** Formats a millisecond figure with its unit in the reader's locale. */
const MILLISECONDS: Intl.NumberFormatOptions = {
	style: "unit",
	unit: "millisecond",
	unitDisplay: "short",
};

/**
 * GET /app/:team/tcp/:monitorId/cards/results — the monitor's result-derived stats and
 * result table, fragment-only. A figure with no checks behind it reads as a dash, never as
 * a zero that would claim the port was down or instant.
 */
export default createAction(routes.app.team.tcpMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await ctx.models.tcpMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		let results = await ctx.models.tcpMonitorResults.recent(monitor.id);

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
		let numbers = new Intl.NumberFormat(ctx.locale, MILLISECONDS);
		let now = Date.now();

		return ctx.render(
			<div mix={[vstack({ gap: 6 })]}>
				<StatCard.Group aria-label={ctx.intl.t("page.tcpMonitorDetail.results.title")}>
					<StatCard>
						<StatCard.Label>
							{ctx.intl.t("page.tcpMonitorDetail.stats.uptime.label")}
						</StatCard.Label>
						<StatCard.Value>{uptimePercent === null ? "—" : `${uptimePercent}%`}</StatCard.Value>
					</StatCard>
					<StatCard>
						<StatCard.Label>
							{ctx.intl.t("page.tcpMonitorDetail.stats.avgResponseTime.label")}
						</StatCard.Label>
						<StatCard.Value>
							{avgResponseTime === null ? "—" : numbers.format(avgResponseTime)}
						</StatCard.Value>
					</StatCard>
					<StatCard>
						<StatCard.Label>
							{ctx.intl.t("page.tcpMonitorDetail.stats.totalChecks.label")}
						</StatCard.Label>
						<StatCard.Value>{totalChecks}</StatCard.Value>
					</StatCard>
				</StatCard.Group>

				<section mix={[vstack({ gap: 3 })]}>
					<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
						{ctx.intl.t("page.tcpMonitorDetail.results.title")}
					</h2>
					{results.length === 0 ? (
						<Empty size="compact">
							<Empty.Description>
								{ctx.intl.t("page.tcpMonitorDetail.results.empty")}
							</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={ctx.intl.t("page.tcpMonitorDetail.results.label")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{ctx.intl.t("page.tcpMonitorDetail.results.columns.time")}
										</Table.Column>
										<Table.Column>
											{ctx.intl.t("page.tcpMonitorDetail.results.columns.status")}
										</Table.Column>
										<Table.Column numeric>
											{ctx.intl.t("page.tcpMonitorDetail.results.columns.responseTime")}
										</Table.Column>
										<Table.Column>
											{ctx.intl.t("page.tcpMonitorDetail.results.columns.error")}
										</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{results.map((result) => (
										<Table.Row key={result.id}>
											<Table.DateCell
												date={result.checked_at}
												now={now}
												locale={ctx.locale}
												local
											/>
											<Table.StatusCell color={STATUS_COLOR[result.status] ?? "neutral"}>
												{ctx.intl.t(`page.tcpMonitors.table.status.${result.status}`)}
											</Table.StatusCell>
											<Table.NumberCell
												value={result.response_time_ms}
												locale={ctx.locale}
												format={MILLISECONDS}
											/>
											<Table.Cell>
												{result.error_message === null ? (
													"—"
												) : (
													<code mix={[fontSize("sm"), overflowWrap("anywhere")]}>
														{result.error_message}
													</code>
												)}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</section>
			</div>,
		);
	},
});
