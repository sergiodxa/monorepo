/**
 * Flow monitor detail page results fragment controller. GET
 * /app/:team/flows/:monitorId/cards/results — loads the monitor's recent runs once and renders
 * everything derived from them: the pass-rate, average-duration and total-runs cards, the flow's
 * own source with the line the last failure names marked, and the run table itself. No document
 * shell, so the detail page's results `Frame` can swap it in over its skeleton fallback.
 *
 * The stat cards live here rather than on the page because every one of them is a reduction over
 * the same rows; leaving them behind would mean the page paying for the query it was structured to
 * avoid. The source listing lives here for the same reason in reverse: marking a line needs the
 * failing line number, which is a property of the last run and not of the monitor row.
 *
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { formatDateTime, formatRelative } from "@pkg/dates";
import { notFound } from "@pkg/http/response/html";
import { inject } from "@pkg/service-container";
import { bg, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { flex, flexWrap, gap, grid, gridTemplate } from "@pkg/u/layout";
import { m, mbe, p } from "@pkg/u/size";
import { font, fontSize, weight, whiteSpace } from "@pkg/u/typography";
import { Badge, Empty, Table } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Fragment } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

/** `error` is neutral, not `down`: it means this app could not find out (ADR-027 §8). */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/** GET /app/:team/flows/:monitorId/cards/results — a flow's run-derived stats, source and runs. */
export default createAction(routes.app.team.flowMonitors.cards.results, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { monitorId } = s.parse(s.object({ monitorId: s.string() }), ctx.params);

		let monitor = await FlowMonitor.findByIdForTeam(db, ctx.team.id, monitorId);
		if (!monitor) return notFound("Not Found");

		let results = await FlowMonitor.listResults(db, monitor.id);
		let last = results[0];

		let totalRuns = results.length;
		/**
		 * `error` runs are excluded from both halves rather than counted as failures: a run that
		 * could not happen is not evidence about the flow, and folding it in would move a
		 * pass-rate somebody reads as "is my flow working" for a reason that is ours.
		 */
		let ran = results.filter((result) => result.status !== "error");
		let passed = ran.filter((result) => result.status === "up").length;
		let passRate = ran.length > 0 ? Math.round((passed / ran.length) * 100) : null;
		let timed = results.filter((result) => result.duration_ms !== null);
		let avgDuration =
			timed.length > 0
				? Math.round(
						timed.reduce((sum, result) => sum + (result.duration_ms ?? 0), 0) / timed.length,
					)
				: null;

		return ctx.render(
			<Fragment>
				<div mix={[flex(), flexWrap(), gap("16px"), mbe("24px")]}>
					<StatCard
						label={ctx.i18next.t("page.flowMonitorDetail.stats.passRate.label")}
						value={passRate === null ? "—" : `${passRate}%`}
					/>
					<StatCard
						label={ctx.i18next.t("page.flowMonitorDetail.stats.avgDuration.label")}
						value={avgDuration === null ? "—" : `${avgDuration}ms`}
					/>
					<StatCard
						label={ctx.i18next.t("page.flowMonitorDetail.stats.totalRuns.label")}
						value={totalRuns}
					/>
				</div>

				{last !== undefined && (last.failure_detail ?? last.error_message) !== null && (
					<section mix={[mbe("24px")]}>
						<h2>{ctx.i18next.t("page.flowMonitorDetail.failure.title")}</h2>
						{last.failed_test !== null && (
							<p mix={[m(0), mbe("8px"), fontSize("sm"), weight(600)]}>
								{ctx.i18next.t("page.flowMonitorDetail.failure.failedTest", {
									test: last.failed_test,
									line: last.failed_at_line ?? 0,
								})}
							</p>
						)}
						<pre
							mix={[
								m(0),
								p("12px"),
								rounded("md"),
								bg("neutral.tint"),
								font("mono"),
								fontSize("sm"),
								fg("danger"),
								whiteSpace("pre-wrap"),
							]}
						>
							{last.failure_detail ?? last.error_message}
						</pre>
					</section>
				)}

				<section mix={[mbe("24px")]}>
					<h2>{ctx.i18next.t("page.flowMonitorDetail.source.title")}</h2>
					<SourceListing source={monitor.source} failedAtLine={last?.failed_at_line ?? null} />
				</section>

				<section>
					<h2>{ctx.i18next.t("page.flowMonitorDetail.results.title")}</h2>
					{results.length === 0 ? (
						<Empty>
							<Empty.Description>
								{ctx.i18next.t("page.flowMonitorDetail.results.empty")}
							</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={ctx.i18next.t("page.flowMonitorDetail.results.label")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>
											{ctx.i18next.t("page.flowMonitorDetail.results.columns.time")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.flowMonitorDetail.results.columns.status")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.flowMonitorDetail.results.columns.tests")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.flowMonitorDetail.results.columns.requests")}
										</Table.Column>
										<Table.Column>
											{ctx.i18next.t("page.flowMonitorDetail.results.columns.duration")}
										</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{results.map((result) => (
										<Table.Row key={result.id}>
											<Table.Cell>
												<time
													datetime={new Date(result.checked_at).toISOString()}
													title={formatDateTime(new Date(result.checked_at), {
														locale: ctx.locale,
														timeZone: "UTC",
													})}
												>
													{formatRelative(new Date(result.checked_at), { locale: ctx.locale })}
												</time>
											</Table.Cell>
											<Table.Cell>
												<Badge {...badgeVariant(STATUS_BADGE_TONE[result.status] ?? "neutral")}>
													{ctx.i18next.t(`page.flowMonitors.table.status.${result.status}`)}
												</Badge>
											</Table.Cell>
											<Table.Cell>
												{result.tests_passed}/{result.tests_total}
											</Table.Cell>
											<Table.Cell>{result.requests_made}</Table.Cell>
											<Table.Cell>
												{result.duration_ms === null ? "—" : `${result.duration_ms}ms`}
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

namespace SourceListing {
	export interface Props {
		/** The spec text, as the customer wrote it. */
		source: string;
		/** The 1-based line the last failure happened on, when there was one. */
		failedAtLine: number | null;
	}
}

/**
 * The flow's source, one row per line with its number in a gutter, and the failing line marked.
 *
 * This is the one thing a flow's detail page does that no other monitor type's needs: a flow's
 * failure is reported *by line*, and "expected 200, observed 500 on line 9" is only useful beside a
 * line 9 you can find.
 *
 * A two-column grid rather than a `<pre>` with the numbers baked into the text, because a number
 * that is part of the text gets selected and copied along with it — pasting a flow back into the
 * editor would carry a column of digits with it. The marked line is toned and also carries a `›` in
 * the gutter, since colour alone is not a signal everybody receives.
 */
function SourceListing(handle: Handle<SourceListing.Props>) {
	return () => {
		let { source, failedAtLine } = handle.props;
		let lines = source.split("\n");
		let gutterWidth = String(lines.length).length;

		return (
			<div
				mix={[
					grid(),
					gridTemplate({ columns: "auto 1fr" }),
					gap("0 12px"),
					p("12px"),
					rounded("md"),
					bg("neutral.tint"),
					font("mono"),
					fontSize("sm"),
				]}
			>
				{lines.map((line, index) => {
					let number = index + 1;
					let failed = number === failedAtLine;

					return (
						<Fragment key={number}>
							<span
								aria-hidden="true"
								mix={[fg(failed ? "danger" : "neutral.muted"), whiteSpace("pre")]}
							>
								{failed ? "›" : " "}
								{String(number).padStart(gutterWidth, " ")}
							</span>
							<span mix={[whiteSpace("pre-wrap"), ...(failed ? [fg("danger"), weight(600)] : [])]}>
								{line === "" ? " " : line}
							</span>
						</Fragment>
					);
				})}
			</div>
		);
	};
}
