/**
 * Flow monitor detail page results fragment controller. GET
 * /app/:team/flows/:monitorId/cards/results — loads the monitor's recent runs once and
 * renders the stat cards, marked source, and run table as a bare fragment the results
 * `Frame` swaps in over its skeleton.
 *
 * The stat cards and source marking live here because both reduce over the same run
 * rows: computing them on the page would query the runs twice, and marking a line needs
 * the last run's failing line number, a property the run's row alone carries.
 *
 * Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { formatDateTime, formatRelative } from "@sdxc/dates";
import { notFound } from "@sdxc/http/response/html";
import { inject } from "@sdxc/service-container";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { flex, flexWrap, gap, grid, gridTemplate, sticky } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { m, mbe, p, pb, pie, pis } from "@sdxc/u/size";
import { font, fontSize, nowrap, overflowWrap, weight, whiteSpace } from "@sdxc/u/typography";
import { Badge, Empty, Table } from "@sdxc/ui";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";
import { Fragment } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import StatCard from "~/resources/components/stat-card";
import routes from "~/routes/web";

/** `error` is `neutral` because this app could not find out (ADR-027 §8). */
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
		 * `error` runs stay outside both halves: they mark a run that failed to execute, and
		 * folding them in would move a pass-rate meant to answer "is my flow working" for a
		 * reason that is ours to own.
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
								overflowWrap("anywhere"),
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
													mix={[nowrap()]}
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
 * Renders `source` as a numbered-line grid with `failedAtLine` marked, so a run's failing
 * line is easy to find. Numbers live in their own sticky gutter column, so copying a line
 * copies only the code, and long lines scroll, keeping each gutter number aligned with its line.
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
					pb("12px"),
					rounded("md"),
					bg("neutral.tint"),
					font("mono"),
					fontSize("sm"),
					overflow("auto"),
				]}
			>
				{lines.map((line, index) => {
					let number = index + 1;
					let failed = number === failedAtLine;

					return (
						<Fragment key={number}>
							<span
								aria-hidden="true"
								mix={[
									sticky(),
									raw({ insetInlineStart: 0 }),
									bg("neutral.tint"),
									pis("12px"),
									pie("12px"),
									fg(failed ? "danger" : "neutral.muted"),
									whiteSpace("pre"),
								]}
							>
								{failed ? "›" : " "}
								{String(number).padStart(gutterWidth, " ")}
							</span>
							<span
								mix={[
									whiteSpace("pre"),
									pie("12px"),
									...(failed ? [fg("danger"), weight(600)] : []),
								]}
							>
								{line === "" ? " " : line}
							</span>
						</Fragment>
					);
				})}
			</div>
		);
	};
}
