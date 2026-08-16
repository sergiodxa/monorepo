/**
 * DNS monitor detail page check-history fragment controller. GET
 * /app/:team/dns/:monitorId/cards/check-history — renders one row per check of the whole
 * domain, with no document shell, so the detail page's history `Frame` can swap it in at
 * the very bottom of the page without the shell waiting on the result query.
 *
 * It re-reads the same rows the results fragment reduces into its stat cards. That is a
 * deliberate duplicate: each `Frame` is fetched and rendered on its own, so a shared read
 * would have to be a cache spanning two independent sub-requests, and the summary and the
 * log sit in different places on the page precisely because one is scanned and the other
 * is not. Requires `requireUser` + `requireTeam`.
 *
 * A result carries counters rather than a resolved value, so the findings cell reads them
 * as two separate claims: what moved, and how much of the sweep never answered — a check
 * that lost queries is not a check that found nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { fontSize } from "@pkg/u/typography";
import { Badge, Empty, Table } from "@pkg/ui";
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
 * How many records a check found something to say about. Deliberately excludes
 * `queries_failed`, which is not a finding about a record but the count of records the
 * check has nothing to say about at all.
 */
function findings(result: SelectDnsMonitorResult): number {
	return result.records_changed + result.records_missing + result.records_new;
}

/** GET /app/:team/dns/:monitorId/cards/check-history — the monitor's result log, fragment-only. */
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
												{/*
												 * A query that did not answer is never diffed, so a sweep that lost
												 * some of its queries knows less than a whole one did. Saying so is
												 * the difference between "nothing moved" and "we did not find out
												 * about part of your zone", and only the second is true here.
												 */}
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
										{/*
										 * Per-check resolution time is our resolver's latency rather than a
										 * property of the domain, so it is reported here on the individual check
										 * — where it helps explain one odd row — and never averaged into a
										 * headline figure that would read as a fact about the visitor's DNS.
										 */}
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
