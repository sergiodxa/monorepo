/**
 * Cron-job monitors list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ClockIcon, PlusIcon } from "@pkg/lucide-remix";
import { Badge, Empty, LinkButton, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { describeSchedule } from "~/app/lib/cron-text";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.cronJobs.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.cronJobs.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.cronJobs.table.columns.schedule")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.cronJobs.table.columns.status")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => (
											<Table.Row key={monitor.id}>
												<Table.Cell>
													<a
														href={routes.app.team.cronJobs.show.href({
															team: ctx.team.slug,
															monitorId: monitor.id,
														})}
														mix={[
															fg("brand"),
															textDecoration("none"),
															hover(textDecoration("underline")),
														]}
													>
														{monitor.name}
													</a>
													{monitor.enabled_at === null && (
														<Badge {...badgeVariant("neutral")}>
															{ctx.i18next.t("page.cronJobs.table.disabled")}
														</Badge>
													)}
												</Table.Cell>
												<Table.Cell>
													{describeSchedule(monitor.cron_expression, {
														locale: ctx.locale,
														t: ctx.i18next.t,
													})}
												</Table.Cell>
												<Table.Cell>
													<Badge {...badgeVariant(STATUS_BADGE_TONE[monitor.status] ?? "neutral")}>
														{ctx.i18next.t(`page.cronJobs.table.status.${monitor.status}`)}
													</Badge>
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table>
							</Table.Container>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
