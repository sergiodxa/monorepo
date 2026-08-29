/**
 * DNS monitors list controller. Renders every DNS monitor for the team with its
 * last-known status and how much of its domain it watches, or an empty state when there
 * are none yet. Requires `requireUser` + `requireTeam`.
 *
 * A monitor's records column reports how many of its domain's records it watches — the
 * only number on this page that says how much work a row stands for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GlobeIcon, PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { Badge, Empty, LinkButton, Table } from "@pkg/ui";
import { Database, getTableName } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { BadgeTone } from "~/resources/components/badge";

import DnsMonitor from "~/app/data/dns-monitor";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { dnsMonitorRecords } from "~/database/schema";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

/** How many records a monitor tracks, and how many of those a deviation would alert on. */
interface RecordCounts {
	total: number;
	watched: number;
}

/**
 * Counts every listed monitor's records in one statement, keyed by monitor.
 *
 * A single `GROUP BY` counts every monitor's records in one round trip; the `IN`
 * list stays within the per-team cap, keeping the query under the bound-parameter limit.
 *
 * @returns Counts for the monitors that have records. A monitor with none is absent, and
 * the caller reads that as the zero it is.
 */
async function countRecords(
	db: Database,
	monitorIds: string[],
): Promise<Map<string, RecordCounts>> {
	if (monitorIds.length === 0) return new Map();

	let result = await db.exec(
		`SELECT dns_monitor_id, COUNT(*) AS total, SUM(is_enabled) AS watched
		   FROM ${getTableName(dnsMonitorRecords)}
		  WHERE dns_monitor_id IN (${monitorIds.map(() => "?").join(", ")})
		  GROUP BY dns_monitor_id`,
		monitorIds,
	);

	let rows = (result.rows ?? []) as unknown as {
		dns_monitor_id: string;
		total: number;
		watched: number;
	}[];

	return new Map(
		rows.map((row) => [row.dns_monitor_id, { total: row.total, watched: row.watched }]),
	);
}

/**
 * GET /app/:team/dns — the team's DNS monitors list.
 *
 * A monitor with no records shows "None yet": discovery might still be pending, and a
 * settled "0 of 0" would misreport it as already checked and empty.
 */
export default createAction(routes.app.team.dnsMonitors.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let monitors = await DnsMonitor.listByTeam(db, ctx.team.id);
		let counts = await countRecords(
			db,
			monitors.map((monitor) => monitor.id),
		);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · DNS monitors`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.dnsMonitors.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.dnsMonitors.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{monitors.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<GlobeIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.dnsMonitors.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.dnsMonitors.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.dnsMonitors.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.dnsMonitors.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.dnsMonitors.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.dnsMonitors.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.dnsMonitors.table.columns.domain")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.dnsMonitors.table.columns.records")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.dnsMonitors.table.columns.status")}
											</Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{monitors.map((monitor) => {
											let count = counts.get(monitor.id);

											return (
												<Table.Row key={monitor.id}>
													<Table.Cell>
														<a
															href={routes.app.team.dnsMonitors.show.href({
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
																{ctx.i18next.t("page.dnsMonitors.table.disabled")}
															</Badge>
														)}
													</Table.Cell>
													<Table.Cell>
														<code>{monitor.domain}</code>
													</Table.Cell>
													<Table.Cell>
														{count === undefined
															? ctx.i18next.t("page.dnsMonitors.table.noRecords")
															: ctx.i18next.t("page.dnsMonitors.table.records", {
																	enabled: count.watched,
																	total: count.total,
																})}
													</Table.Cell>
													<Table.Cell>
														<Badge
															{...badgeVariant(
																STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral",
															)}
														>
															{monitor.last_status ??
																ctx.i18next.t("page.dnsMonitors.table.notChecked")}
														</Badge>
													</Table.Cell>
												</Table.Row>
											);
										})}
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
