/**
 * API keys list controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Reads the one-time `newApiKey` session flash so a key just
 * created on this render (redirected from the create action) can be shown once.
 *
 * Renders the API keys list; shows a one-time reveal card for the newly created key
 * above the table when it's present.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { KeyIcon, PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";
import { css } from "remix/ui";

import ApiKey from "~/app/data/api-key";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import CopyButton from "~/resources/components/copy-button";
import Empty from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import routes from "~/routes/web";

interface NewApiKey {
	name: string;
	key: string;
}

/** GET /app/:team/api-keys — the team's API keys list. */
export default createAction(routes.app.team.apiKeys.index, {
	middleware: [requireUser, requireTeam, requireRole("admin")],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let apiKeys = await ApiKey.listByTeam(db, ctx.team.id);
		let newApiKey = ctx.get(Session)?.get("newApiKey") as NewApiKey | undefined;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · API keys`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.apiKeys.header.title")}
					actions={
						apiKeys.length < 10 && (
							<LinkButton href={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}>
								<PlusIcon size={16} strokeWidth={1.5} />
								{ctx.i18next.t("page.apiKeys.header.action.create")}
							</LinkButton>
						)
					}
				>
					<div>
						{newApiKey && (
							<div
								mix={[
									css({
										display: "flex",
										flexDirection: "column",
										alignItems: "center",
										textAlign: "center",
										gap: 12,
										padding: "64px 32px",
										border: `1px dashed ${neutral[300]}`,
										borderRadius: 12,
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[700] },
									}),
								]}
							>
								<p>{ctx.i18next.t("page.apiKeys.newKey.title", { name: newApiKey.name })}</p>
								<p>{ctx.i18next.t("page.apiKeys.newKey.description")}</p>
								<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
									<code>{newApiKey.key}</code>
									<CopyButton value={newApiKey.key} label="Copy key" />
								</div>
							</div>
						)}

						{apiKeys.length === 0 ? (
							<Empty>
								<Empty.Icon>
									<KeyIcon size={24} strokeWidth={1.5} />
								</Empty.Icon>
								<Empty.Title>{ctx.i18next.t("page.apiKeys.empty.title")}</Empty.Title>
								<Empty.Description>
									{ctx.i18next.t("page.apiKeys.empty.description")}
								</Empty.Description>
								<Empty.Action>
									<LinkButton href={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}>
										<PlusIcon size={20} strokeWidth={1.5} />
										{ctx.i18next.t("page.apiKeys.empty.cta")}
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
											<th>{ctx.i18next.t("page.apiKeys.table.columns.name")}</th>
											<th>{ctx.i18next.t("page.apiKeys.table.columns.prefix")}</th>
											<th>{ctx.i18next.t("page.apiKeys.table.columns.scopes")}</th>
											<th>{ctx.i18next.t("page.apiKeys.table.columns.lastUsed")}</th>
											<th>{ctx.i18next.t("page.apiKeys.table.columns.expires")}</th>
											<th></th>
										</tr>
									</thead>
									<tbody>
										{apiKeys.map((apiKey) => {
											let isExpired = apiKey.expires_at !== null && apiKey.expires_at < Date.now();

											return (
												<tr key={apiKey.id}>
													<td>{apiKey.name}</td>
													<td>
														<code>{apiKey.key_prefix}...</code>
													</td>
													<td>
														{apiKey.scopes.map((scope) => (
															<Badge key={scope} tone="neutral">
																{scope}
															</Badge>
														))}
													</td>
													<td>
														{apiKey.last_used_at
															? new Date(apiKey.last_used_at).toLocaleString()
															: ctx.i18next.t("page.apiKeys.table.lastUsed.never")}
													</td>
													<td>
														{apiKey.expires_at ? (
															<Badge tone={isExpired ? "down" : "neutral"}>
																{new Date(apiKey.expires_at).toLocaleDateString()}
															</Badge>
														) : (
															ctx.i18next.t("page.apiKeys.table.expires.never")
														)}
													</td>
													<td>
														<form
															method="post"
															action={routes.teamAdminActions.apiKey.delete.href({
																team: ctx.team.slug,
															})}
														>
															<input type="hidden" name="_method" value="DELETE" />
															<input type="hidden" name="api_key_id" value={apiKey.id} />
															<Button type="submit" color="danger">
																{ctx.i18next.t("page.apiKeys.table.actions.delete")}
															</Button>
														</form>
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
