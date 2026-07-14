/**
 * HTTP monitors list controller. Lists the team's monitors, each paired with its
 * single most recent Analytics Engine result (see `getLatestHttpResult` in
 * `app/services/analytics.ts`), fetched one query per monitor in parallel via
 * `Promise.all` — the same "one query per monitor, run in parallel" pattern this app
 * already uses elsewhere for per-row Analytics Engine data. From that latest result, a
 * per-monitor status (up/degraded/down/unknown) is derived via `calculateMonitorStatus`.
 * Requires `requireUser` + `requireTeam`.
 *
 * The row actions menu is `~/resources/components/monitor-row-actions.tsx`, a client
 * island built on CSS anchor positioning rather than a hand-rolled `commandfor`/
 * `[popover]` pair: a plain `position: absolute` popover panel can't anchor to its own
 * row once promoted to the top layer (its containing block becomes the viewport, not
 * any DOM ancestor, so every row's panel would resolve to the same spot), but anchor
 * positioning computes the panel's position per-instance in the browser's own layout
 * engine, so N independently-positioned triggers (one per table row) each get a
 * correctly-placed panel with zero JS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MonitorIcon, PlusIcon } from "@pkg/lucide-remix";
import { isFailure } from "@pkg/result";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { MonitorStatus } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Monitor from "~/app/data/monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { calculateMonitorStatus, getLatestHttpResult } from "~/app/services/analytics";
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import MonitorRowActions from "~/resources/components/monitor-row-actions";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

interface MonitorRow {
	monitor: SelectMonitor;
	status: MonitorStatus;
	responseTimeMs: number | null;
	lastCheckedAt: string | null;
}

const STATUS_BADGE_TONE: Record<MonitorStatus, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
	unknown: "neutral",
};

/** GET /app/:team/http — the team's HTTP monitors list. */
export default createAction(routes.app.team.monitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await Monitor.listByTeam(db, ctx.team.id);

		let latestResults = await Promise.all(
			monitors.map((monitor) => getLatestHttpResult(ctx.team.id, monitor.id)),
		);

		let rows: MonitorRow[] = monitors.map((monitor, index) => {
			let latestResult = latestResults[index]!;
			let latest = isFailure(latestResult) ? null : latestResult.data;

			return {
				monitor,
				status: calculateMonitorStatus(latest, monitor.expected_status, monitor.degraded_after_ms),
				responseTimeMs: latest?.responseTimeMs ?? null,
				lastCheckedAt: latest?.timestamp ?? null,
			};
		});

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · HTTP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.httpMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.httpMonitors.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{rows.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<MonitorIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.httpMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.httpMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.monitors.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.httpMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<div mix={[css({ overflowX: "auto" })]}>
								<table
									mix={[
										css({
											width: "100%",
											borderCollapse: "collapse",
											fontSize: "0.875rem",
											"& th, & td": {
												textAlign: "left",
												padding: "12px 16px",
												borderBottom: `1px solid ${neutral[200]}`,
											},
											"@media (prefers-color-scheme: dark)": {
												"& th, & td": { borderColor: neutral[800] },
											},
										}),
									]}
								>
									<thead>
										<tr>
											<th>{ctx.i18next.t("page.httpMonitors.table.columns.name")}</th>
											<th>{ctx.i18next.t("page.httpMonitors.table.columns.url")}</th>
											<th>{ctx.i18next.t("page.httpMonitors.table.columns.status")}</th>
											<th>{ctx.i18next.t("page.httpMonitors.table.columns.responseTime")}</th>
											<th>{ctx.i18next.t("page.httpMonitors.table.columns.lastChecked")}</th>
											<th mix={[css({ textAlign: "right" })]}>
												<span
													mix={[
														css({
															position: "absolute",
															width: 1,
															height: 1,
															padding: 0,
															margin: -1,
															overflow: "hidden",
															clip: "rect(0, 0, 0, 0)",
															whiteSpace: "nowrap",
															border: 0,
														}),
													]}
												>
													{ctx.i18next.t("page.httpMonitors.table.columns.actions")}
												</span>
											</th>
										</tr>
									</thead>
									<tbody>
										{rows.map(({ monitor, status, responseTimeMs, lastCheckedAt }) => {
											let deleteDialogId = `delete-monitor-${monitor.id}`;

											return (
												<tr key={monitor.id}>
													<td>
														<a
															href={routes.app.team.monitors.show.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
															mix={[
																css({
																	fontWeight: 600,
																	color: primary[600],
																	textDecoration: "none",
																	"&:hover": { textDecoration: "underline" },
																	"@media (prefers-color-scheme: dark)": { color: primary[400] },
																}),
															]}
														>
															{monitor.name}
														</a>
														{monitor.enabled_at === null && (
															<Badge tone="neutral">
																{ctx.i18next.t("page.httpMonitors.table.disabled")}
															</Badge>
														)}
													</td>
													<td>
														<code>{monitor.url}</code>
													</td>
													<td>
														<Badge tone={STATUS_BADGE_TONE[status]}>
															{ctx.i18next.t(`page.httpMonitors.table.status.${status}`)}
														</Badge>
													</td>
													<td>
														{responseTimeMs !== null ? (
															<span>{responseTimeMs}ms</span>
														) : (
															<span
																mix={[
																	css({
																		color: neutral[500],
																		"@media (prefers-color-scheme: dark)": { color: neutral[400] },
																	}),
																]}
															>
																-
															</span>
														)}
													</td>
													<td>
														{lastCheckedAt !== null ? (
															new Date(lastCheckedAt).toLocaleString()
														) : (
															<span
																mix={[
																	css({
																		color: neutral[500],
																		"@media (prefers-color-scheme: dark)": { color: neutral[400] },
																	}),
																]}
															>
																{ctx.i18next.t("page.httpMonitors.table.neverChecked")}
															</span>
														)}
													</td>
													<td>
														<MonitorRowActions
															monitorName={monitor.name}
															viewHref={routes.app.team.monitors.show.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
															editHref={routes.app.team.monitors.edit.href({
																team: ctx.team.slug,
																monitorId: monitor.id,
															})}
															deleteDialogId={deleteDialogId}
														/>

														<dialog
															id={deleteDialogId}
															mix={[
																css({
																	padding: 24,
																	borderRadius: 8,
																	border: `1px solid ${neutral[300]}`,
																	maxWidth: 400,
																	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
																	"@media (prefers-color-scheme: dark)": {
																		borderColor: neutral[700],
																		background: neutral[900],
																		color: neutral[50],
																	},
																}),
															]}
														>
															<h3>
																{ctx.i18next.t("page.httpMonitors.table.confirmation.delete", {
																	name: monitor.name,
																})}
															</h3>
															<p
																mix={[
																	css({
																		fontSize: "0.8125rem",
																		color: neutral[500],
																		"@media (prefers-color-scheme: dark)": { color: neutral[400] },
																	}),
																]}
															>
																This also deletes its content checks and check-result history. This
																can't be undone.
															</p>
															<form
																method="post"
																action={routes.actions.monitor.http.delete.href({
																	team: ctx.team.slug,
																})}
															>
																<input type="hidden" name="_method" value="DELETE" />
																<input type="hidden" name="monitor_id" value={monitor.id} />
																<div
																	mix={[
																		css({ display: "flex", gap: 8, justifyContent: "flex-end" }),
																	]}
																>
																	<Button
																		type="button"
																		variant="outline"
																		commandfor={deleteDialogId}
																		command="close"
																	>
																		{ctx.i18next.t("page.editMonitor.form.cancel")}
																	</Button>
																	<Button type="submit" color="danger">
																		{ctx.i18next.t("page.httpMonitors.table.actions.delete")}
																	</Button>
																</div>
															</form>
														</dialog>
													</td>
												</tr>
											);
										})}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
