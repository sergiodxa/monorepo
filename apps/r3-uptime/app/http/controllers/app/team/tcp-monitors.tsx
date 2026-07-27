/**
 * TCP monitors list controller. Renders every TCP monitor for the team with its
 * last-known status, or an empty state when there are none yet. Requires
 * `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NetworkIcon, PlusIcon } from "@pkg/lucide-remix";
import { Badge, Empty, LinkButton, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { BadgeTone } from "~/resources/components/badge";

import TcpMonitor from "~/app/data/tcp-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	up: "up",
	timeout: "degraded",
	down: "down",
};

/** GET /app/:team/tcp — the team's TCP monitors list. */
export default createAction(routes.app.team.tcpMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await TcpMonitor.listByTeam(db, ctx.team.id);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · TCP monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.tcpMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.tcpMonitors.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<NetworkIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.tcpMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.tcpMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.tcpMonitors.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.tcpMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.tcpMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.tcpMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.tcpMonitors.table.columns.endpoint")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.tcpMonitors.table.columns.status")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.tcpMonitors.table.columns.responseTime")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => (
											<Table.Row key={monitor.id}>
												<Table.Cell>
													<a
														href={routes.app.team.tcpMonitors.show.href({
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
															{ctx.i18next.t("page.tcpMonitors.table.status.disabled")}
														</Badge>
													)}
												</Table.Cell>
												<Table.Cell>
													<code>
														{monitor.host}:{monitor.port}
													</code>
												</Table.Cell>
												<Table.Cell>
													<Badge
														{...badgeVariant(
															STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral",
														)}
													>
														{ctx.i18next.t(
															`page.tcpMonitors.table.status.${monitor.last_status ?? "pending"}`,
														)}
													</Badge>
												</Table.Cell>
												<Table.Cell>
													{monitor.last_response_time_ms === null
														? "—"
														: `${monitor.last_response_time_ms}ms`}
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
