/**
 * Status pages list controller. Requires `requireUser` + `requireTeam`. Each row opens the
 * page's settings, links its public address, and says how many services it reports on and
 * who can see it, so a page left private or empty stands out before it is shared.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ExternalLinkIcon, FileTextIcon, PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hover } from "@sdxc/u/state";
import { font, textDecoration } from "@sdxc/u/typography";
import { LinkButton } from "@sdxc/ui";
import { Empty, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** The flash the create, update and delete actions leave for the list they redirect to. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/** GET /app/:team/status-pages — the team's status pages list. */
export default createAction(routes.app.team.statusPages.index, {
	middleware: [requireUser, requireTeam, appShellData()],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let pages = await ctx.models.statusPages
			.inTeam(ctx.team.id)
			.orderBy("created_at", "desc")
			.all();
		let attachedCounts = await Promise.all(
			pages.map(async (page) => {
				let ids = await ctx.models.statusPages.getAttachedIds(page.id);
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
		let toast = ctx.get(Session)?.get("toast") as Toast | undefined;
		let team = { team: ctx.team.slug };
		let newHref = routes.app.team.statusPages.new.href(team);

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${ctx.intl.t("page.statusPages.header.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					toast={toast}
					heading={ctx.intl.t("page.statusPages.header.title")}
					breadcrumbs={[
						{
							label: ctx.intl.t("app.layout.sidebar.navigation.items.dashboard"),
							href: routes.app.team.dashboard.index.href(team),
						},
					]}
					primaryAction={
						<LinkButton href={newHref}>
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.intl.t("page.statusPages.header.action.create")}
						</LinkButton>
					}
				>
					{pages.length === 0 ? (
						<Empty kind="first-run" icon={<FileTextIcon size={24} strokeWidth={1.5} />}>
							<Empty.Title>{ctx.intl.t("page.statusPages.empty.title")}</Empty.Title>
							<Empty.Description>
								{ctx.intl.t("page.statusPages.empty.description")}
							</Empty.Description>
							<Empty.Action>
								<LinkButton href={newHref}>
									<PlusIcon size={16} strokeWidth={1.5} />
									{ctx.intl.t("page.statusPages.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={ctx.intl.t("page.statusPages.table.label")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{ctx.intl.t("page.statusPages.table.columns.name")}</Table.Column>
										<Table.Column>{ctx.intl.t("page.statusPages.table.columns.slug")}</Table.Column>
										<Table.Column numeric>
											{ctx.intl.t("page.statusPages.table.columns.services")}
										</Table.Column>
										<Table.Column>
											{ctx.intl.t("page.statusPages.table.columns.visibility")}
										</Table.Column>
										<Table.ActionsColumn
											label={ctx.intl.t("page.statusPages.table.columns.actions")}
										/>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{pages.map((page) => {
										let editHref = routes.app.team.statusPages.edit.href({
											...team,
											statusPageId: page.id,
										});
										let publicHref = routes.statusPage.href({ slug: page.slug });

										return (
											<Table.Row key={page.id}>
												<Table.Cell>
													<Table.RowLink href={editHref}>{page.name}</Table.RowLink>
												</Table.Cell>
												<Table.Cell>
													<a
														href={publicHref}
														target="_blank"
														rel="noreferrer"
														mix={[
															font("mono"),
															fg("neutral.muted"),
															textDecoration("none"),
															hover(textDecoration("underline")),
														]}
													>
														/status/{page.slug}
													</a>
												</Table.Cell>
												<Table.NumberCell
													value={countsByPageId.get(page.id) ?? 0}
													locale={ctx.locale}
												/>
												<Table.StatusCell color={page.is_public ? "success" : "neutral"}>
													{page.is_public
														? ctx.intl.t("page.statusPages.table.visibility.public")
														: ctx.intl.t("page.statusPages.table.visibility.private")}
												</Table.StatusCell>
												<Table.Actions>
													<LinkButton
														href={publicHref}
														target="_blank"
														rel="noreferrer"
														size="sm"
														variant="ghost"
														color="neutral"
													>
														<ExternalLinkIcon size={14} strokeWidth={1.5} />
														{ctx.intl.t("page.statusPages.table.actions.view")}
													</LinkButton>
													<LinkButton href={editHref} size="sm" variant="ghost" color="neutral">
														{ctx.intl.t("page.statusPages.table.actions.edit")}
													</LinkButton>
												</Table.Actions>
											</Table.Row>
										);
									})}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</AppShell>
			</DocumentLayout>,
		);
	},
});
