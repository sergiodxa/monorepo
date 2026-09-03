/**
 * DNS monitor detail page check-history fragment controller. GET
 * /app/:team/dns/:monitorId/cards/check-history — renders the monitor's result log with
 * no document shell, so the detail page's history `Frame` loads independently of the
 * results summary `Frame`. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { fontSize } from "@sdxc/u/typography";
import { Badge, Empty, Table } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { SelectDnsMonitorResult } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
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
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await DnsMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await DnsMonitor.listResults(db, monitor.id);

		return ctx.render(
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
											<div mix={[vstack({ gap: 1 })]}>
												{result.error_message ? (
													<code>{result.error_message}</code>
												) : (
													findings(result) !== 0 && (
														<span>
															{ctx.i18next.t("page.dnsMonitorDetail.results.findings", {
																changed: result.records_changed,
																missing: result.records_missing,
																new: result.records_new,
															})}
														</span>
													)
												)}
												{result.queries_failed > 0 && (
													<span mix={[fg("neutral.muted"), fontSize("sm")]}>
														{ctx.i18next.t("page.dnsMonitorDetail.results.queriesFailed", {
															count: result.queries_failed,
														})}
													</span>
												)}
												{result.error_message === null &&
													findings(result) === 0 &&
													result.queries_failed === 0 &&
													ctx.i18next.t("page.dnsMonitorDetail.results.noFindings")}
											</div>
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
			</section>,
		);
	}),
});
