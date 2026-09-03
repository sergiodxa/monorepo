/**
 * Status pages list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FileTextIcon, PlusIcon } from "@pkg/icons";
import { inject } from "@pkg/service-container";
import { fg } from "@pkg/u/color";
import { hover } from "@pkg/u/state";
import { textDecoration } from "@pkg/u/typography";
import { Badge, Empty, LinkButton, Table } from "@pkg/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import StatusPage from "~/app/data/status-page";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { badgeVariant } from "~/resources/components/badge";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** GET /app/:team/status-pages — the team's status pages list. */
export default createAction(routes.app.team.statusPages.index, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let pages = await StatusPage.listByTeam(db, ctx.team.id);
		let attachedCounts = await Promise.all(
			pages.map(async (page) => {
				let ids = await StatusPage.getAttachedIds(db, page.id);
				return (
					ids.monitorIds.length +
					ids.dnsMonitorIds.length +
					ids.tcpMonitorIds.length +
					ids.flowMonitorIds.length +
					ids.cronJobIds.length
				);
			}),
		);
		let countsByPageId = new Map(pages.map((page, index) => [page.id, attachedCounts[index] ?? 0]));

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Status pages`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.statusPages.header.title")}
					breadcrumbs={[
						{
							label: ctx.i18next.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href({ team: ctx.team.slug }),
						},
					]}
					actions={
						<LinkButton href={routes.app.team.statusPages.new.href({ team: ctx.team.slug })}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.statusPages.header.action.create")}
						</LinkButton>
					}
				>
					<div>
						{pages.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<FileTextIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.statusPages.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.statusPages.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.statusPages.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.statusPages.empty.cta")}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : (
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.statusPages.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.statusPages.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.statusPages.table.columns.slug")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.statusPages.table.columns.services")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.statusPages.table.columns.visibility")}
											</Table.Column>
											<Table.Column></Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{pages.map((page) => (
											<Table.Row key={page.id}>
												<Table.Cell>{page.name}</Table.Cell>
												<Table.Cell>
													<a
														href={routes.statusPage.href({ slug: page.slug })}
														target="_blank"
														rel="noreferrer"
														mix={[
															fg("brand"),
															textDecoration("none"),
															hover(textDecoration("underline")),
														]}
													>
														/status/{page.slug}
													</a>
												</Table.Cell>
												<Table.Cell>{countsByPageId.get(page.id) ?? 0}</Table.Cell>
												<Table.Cell>
													<Badge {...badgeVariant(page.is_public ? "up" : "neutral")}>
														{page.is_public
															? ctx.i18next.t("page.statusPages.table.visibility.public")
															: ctx.i18next.t("page.statusPages.table.visibility.private")}
													</Badge>
												</Table.Cell>
												<Table.Cell>
													<a
														href={routes.app.team.statusPages.edit.href({
															team: ctx.team.slug,
															statusPageId: page.id,
														})}
														mix={[
															fg("brand"),
															textDecoration("none"),
															hover(textDecoration("underline")),
														]}
													>
														{ctx.i18next.t("page.statusPages.table.actions.edit")}
													</a>
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
