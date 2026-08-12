/**
 * Flow monitors list controller. Renders every flow monitor for the team with its last-known
 * status and what its last run concluded, or an empty state when there are none yet. Requires
 * `requireUser` + `requireTeam`.
 *
 * The status column carries the failure rather than only its colour, because a flow's failure is
 * legible in a way an HTTP monitor's is not: "the sign-in form authenticates" failing on line 9
 * is the incident, and hiding it behind a click would waste the one thing this monitor type
 * knows that the others do not (ADR-027 §8). There is no detail page for the same reason —
 * a third place to render two facts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PlusIcon, WorkflowIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { vstack } from "@pkg/u/layout";
import { m } from "@pkg/u/size";
import { hover } from "@pkg/u/state";
import { fontSize, textDecoration } from "@pkg/u/typography";
import { Badge, Empty, LinkButton, Table } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import FlowMonitor from "~/app/data/flow-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * `error` is neutral and not `down`: it means this app could not find out — an unparseable spec,
 * a host no verified domain covers — and colouring it as an outage would put our own
 * misconfiguration in a customer's incident history (ADR-027 §8).
 */
const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	down: "down",
	error: "neutral",
};

/** GET /app/:team/flows — the team's flow monitors list. */
export default createAction(routes.app.team.flowMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await FlowMonitor.listByTeam(db, ctx.team.id);
		let newHref = routes.app.team.flowMonitors.new.href({ team: ctx.team.slug });

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Flow monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.flowMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={newHref}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.flowMonitors.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<WorkflowIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.flowMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.flowMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={newHref}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.flowMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.flowMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.interval")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.flowMonitors.table.columns.lastChecked")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => (
											<Table.Row key={monitor.id}>
												<Table.Cell>
													<a
														href={routes.app.team.flowMonitors.edit.href({
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
													{!monitor.is_enabled && (
														<Badge {...badgeVariant("neutral")}>
															{ctx.i18next.t("page.flowMonitors.table.status.disabled")}
														</Badge>
													)}
												</Table.Cell>
												<Table.Cell>
													{ctx.i18next.t(
														`page.createFlowMonitor.form.fields.interval.options.${monitor.interval_seconds}`,
													)}
												</Table.Cell>
												<Table.Cell>
													<div mix={[vstack({ gap: 4 })]}>
														<Badge
															{...badgeVariant(
																STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral",
															)}
														>
															{ctx.i18next.t(
																`page.flowMonitors.table.status.${monitor.last_status ?? "pending"}`,
															)}
														</Badge>
													</div>
												</Table.Cell>
												<Table.Cell>
													{monitor.last_checked_at === null ? (
														"—"
													) : (
														<time
															datetime={new Date(monitor.last_checked_at).toISOString()}
															mix={[fontSize("sm")]}
														>
															{new Date(monitor.last_checked_at).toISOString()}
														</time>
													)}
												</Table.Cell>
											</Table.Row>
										))}
									</Table.Body>
								</Table>
							</Table.Container>
						)}
					</div>
					{monitors.length > 0 && (
						<p mix={[m(0), fontSize("sm"), fg("muted")]}>
							{ctx.i18next.t("page.flowMonitors.footnote")}
						</p>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
