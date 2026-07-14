/**
 * Cron-job monitors list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ClockIcon, PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

/** GET /app/:team/cron-jobs — the team's cron-job monitors list. */
export default createAction(routes.app.team.cronJobs.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await CronJobMonitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · ${ctx.i18next.t("page.cronJobs.header.title")}`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.cronJobs.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.cronJobs.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.cronJobs.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<ClockIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.cronJobs.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.cronJobs.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.cronJobs.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.cronJobs.empty.cta")}
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
											<th>{ctx.i18next.t("page.cronJobs.table.columns.name")}</th>
											<th>{ctx.i18next.t("page.cronJobs.table.columns.schedule")}</th>
											<th>{ctx.i18next.t("page.cronJobs.table.columns.status")}</th>
										</tr>
									</thead>
									<tbody>
										{monitors.map((monitor) => (
											<tr key={monitor.id}>
												<td>
													<a
														href={routes.app.team.cronJobs.show.href({
															team: ctx.team.slug,
															monitorId: monitor.id,
														})}
														mix={[
															css({
																color: primary[600],
																textDecoration: "none",
																"&:hover": { textDecoration: "underline" },
																"@media (prefers-color-scheme: dark)": { color: primary[400] },
															}),
														]}
													>
														{monitor.name}
													</a>
													{monitor.enabled_at === null && <Badge tone="neutral">Disabled</Badge>}
												</td>
												<td>{CronJobMonitor.describeCronExpression(monitor.cron_expression)}</td>
												<td>
													<Badge tone={STATUS_BADGE_TONE[monitor.status] ?? "neutral"}>
														{ctx.i18next.t(`page.cronJobs.table.status.${monitor.status}`)}
													</Badge>
												</td>
											</tr>
										))}
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
