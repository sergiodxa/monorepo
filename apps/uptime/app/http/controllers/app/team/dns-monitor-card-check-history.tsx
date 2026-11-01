/**
 * DNS monitor detail page check-history fragment controller. GET
 * /app/:team/dns/:monitorId/cards/check-history — renders the monitor's result log with
 * no document shell, so the detail page's history `Frame` loads independently of the
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SemanticColor } from "@sdxc/ui/utils";

import { notFound } from "@sdxc/http/response/html";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { fontSize, overflowWrap, weight } from "@sdxc/u/typography";
import { Empty, Table } from "@sdxc/ui/app";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { SelectDnsMonitorResult } from "~/database/schema";

import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import routes from "~/routes/web";

/** The dot color each sweep outcome is drawn in. */
const STATUS_COLOR: Record<string, SemanticColor> = {
	ok: "success",
	changed: "warning",
	error: "danger",
};

/**
 * Sums the record-level outcomes a check found something to say about. A record with a
 * failed query was never evaluated, so it carries no finding and stays out of this
 * total.
 */
function findings(result: SelectDnsMonitorResult): number {
	return result.records_changed + result.records_missing + result.records_new;
}

/**
 * GET /app/:team/dns/:monitorId/cards/check-history — the monitor's result log,
 * fragment-only. Failed queries are surfaced separately from findings, and each row
 * reports that check's own resolver latency, scoped to explain that single row.
 */
export default createAction(routes.app.team.dnsMonitors.cards.checkHistory, {
	middleware: [requireUser, requireTeam],
	handler: async (ctx) => {
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await ctx.models.dnsMonitors.inTeam(ctx.team.id).where({ id: monitorId }).first();
		if (!monitor) return notFound("Not Found");

		let results = await ctx.models.dnsMonitorResults.recent(monitor.id);

		let now = Date.now();

		return ctx.render(
			<section mix={[vstack({ gap: 3 })]}>
				<h2 mix={[m(0), fontSize("md"), weight("semibold")]}>
					{ctx.intl.t("page.dnsMonitorDetail.results.title")}
				</h2>
				{results.length === 0 ? (
					<Empty size="compact">
						<Empty.Description>
							{ctx.intl.t("page.dnsMonitorDetail.results.empty")}
						</Empty.Description>
					</Empty>
				) : (
					<Table.Container>
						<Table aria-label={ctx.intl.t("page.dnsMonitorDetail.results.title")}>
							<Table.Header>
								<Table.Row>
									<Table.Column>
										{ctx.intl.t("page.dnsMonitorDetail.results.table.columns.checkedAt")}
									</Table.Column>
									<Table.Column>
										{ctx.intl.t("page.dnsMonitorDetail.results.table.columns.status")}
									</Table.Column>
									<Table.Column>
										{ctx.intl.t("page.dnsMonitorDetail.results.table.columns.findings")}
									</Table.Column>
									<Table.Column numeric>
										{ctx.intl.t("page.dnsMonitorDetail.results.table.columns.responseTime")}
									</Table.Column>
								</Table.Row>
							</Table.Header>
							<Table.Body>
								{results.map((result) => (
									<Table.Row key={result.id}>
										<Table.DateCell date={result.checked_at} now={now} locale={ctx.locale} local />
										<Table.StatusCell color={STATUS_COLOR[result.status] ?? "neutral"}>
											{ctx.intl.t(`page.dnsMonitorDetail.records.state.${result.status}`)}
										</Table.StatusCell>
										<Table.Cell>
											<div mix={[vstack({ gap: 1 })]}>
												{result.error_message ? (
													<code mix={[fontSize("sm"), overflowWrap("anywhere")]}>
														{result.error_message}
													</code>
												) : (
													findings(result) !== 0 && (
														<span>
															{ctx.intl.t("page.dnsMonitorDetail.results.findings", {
																changed: result.records_changed,
																missing: result.records_missing,
																new: result.records_new,
															})}
														</span>
													)
												)}
												{result.queries_failed > 0 && (
													<span mix={[fg("neutral.muted"), fontSize("sm")]}>
														{ctx.intl.t("page.dnsMonitorDetail.results.queriesFailed", {
															count: result.queries_failed,
														})}
													</span>
												)}
												{result.error_message === null &&
													findings(result) === 0 &&
													result.queries_failed === 0 &&
													ctx.intl.t("page.dnsMonitorDetail.results.noFindings")}
											</div>
										</Table.Cell>
										<Table.NumberCell
											value={result.response_time_ms}
											locale={ctx.locale}
											format={{ style: "unit", unit: "millisecond", unitDisplay: "short" }}
										/>
									</Table.Row>
								))}
							</Table.Body>
						</Table>
					</Table.Container>
				)}
			</section>,
		);
	},
});
