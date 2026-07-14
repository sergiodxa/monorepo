/**
 * Status pages list controller. Requires `requireUser` + `requireTeam`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FileTextIcon, PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import StatusPage from "~/app/data/status-page";
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
											<th>{ctx.i18next.t("page.statusPages.table.columns.name")}</th>
											<th>{ctx.i18next.t("page.statusPages.table.columns.slug")}</th>
											<th>Services</th>
											<th>{ctx.i18next.t("page.statusPages.table.columns.visibility")}</th>
											<th></th>
										</tr>
									</thead>
									<tbody>
										{pages.map((page) => (
											<tr key={page.id}>
												<td>{page.name}</td>
												<td>
													<a
														href={routes.statusPage.href({ slug: page.slug })}
														target="_blank"
														rel="noreferrer"
														mix={[
															css({
																color: primary[600],
																textDecoration: "none",
																"&:hover": { textDecoration: "underline" },
																"@media (prefers-color-scheme: dark)": { color: primary[400] },
															}),
														]}
													>
														/status/{page.slug}
													</a>
												</td>
												<td>{countsByPageId.get(page.id) ?? 0}</td>
												<td>
													<Badge tone={page.is_public ? "up" : "neutral"}>
														{page.is_public
															? ctx.i18next.t("page.statusPages.table.visibility.public")
															: ctx.i18next.t("page.statusPages.table.visibility.private")}
													</Badge>
												</td>
												<td>
													<a
														href={routes.app.team.statusPages.edit.href({
															team: ctx.team.slug,
															statusPageId: page.id,
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
														{ctx.i18next.t("page.statusPages.table.actions.edit")}
													</a>
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
