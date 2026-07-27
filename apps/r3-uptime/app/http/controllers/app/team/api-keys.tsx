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

import { IntlProvider } from "@pkg/i18n/ui";
import { KeyIcon, PlusIcon } from "@pkg/lucide-remix";
import { Empty, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { border } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { hstack, vstack } from "@pkg/u/layout";
import { pb, pi } from "@pkg/u/size";
import { textAlign } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import ApiKey from "~/app/data/api-key";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import CopyButton from "~/resources/components/copy-button";
import LinkButton from "~/resources/components/link-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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
									vstack({ gap: "12px", align: "center" }),
									textAlign("center"),
									pb("64px"),
									pi("32px"),
									border({ width: 1, style: "dashed", color: "neutral" }),
									rounded("12px"),
								]}
							>
								<p>{ctx.i18next.t("page.apiKeys.newKey.title", { name: newApiKey.name })}</p>
								<p>{ctx.i18next.t("page.apiKeys.newKey.description")}</p>
								<div mix={[hstack({ gap: "12px", align: "center" })]}>
									<code>{newApiKey.key}</code>
									{/* CopyButton is a `clientEntry` island: its render function runs
									server-side too (for the initial HTML), where `intl(handle)` has no
									module-scoped `setIntl()` fallback to read (that's only ever
									registered client-side in bootstrap/browser.ts) — it needs an
									`IntlProvider` ancestor for `intl(handle)` to resolve at all. */}
									<IntlProvider i18n={ctx.i18next}>
										<CopyButton
											value={newApiKey.key}
											label={ctx.i18next.t("page.apiKeys.newKey.copyLabel")}
										/>
									</IntlProvider>
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
							<Table.Container>
								<Table aria-label={ctx.i18next.t("page.apiKeys.table.label")}>
									<Table.Header>
										<Table.Row>
											<Table.Column>
												{ctx.i18next.t("page.apiKeys.table.columns.name")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.apiKeys.table.columns.prefix")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.apiKeys.table.columns.scopes")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.apiKeys.table.columns.lastUsed")}
											</Table.Column>
											<Table.Column>
												{ctx.i18next.t("page.apiKeys.table.columns.expires")}
											</Table.Column>
											<Table.Column></Table.Column>
										</Table.Row>
									</Table.Header>
									<Table.Body>
										{apiKeys.map((apiKey) => {
											let isExpired = apiKey.expires_at !== null && apiKey.expires_at < Date.now();

											return (
												<Table.Row key={apiKey.id}>
													<Table.Cell>{apiKey.name}</Table.Cell>
													<Table.Cell>
														<code>{apiKey.key_prefix}...</code>
													</Table.Cell>
													<Table.Cell>
														{apiKey.scopes.map((scope) => (
															<Badge key={scope} tone="neutral">
																{scope}
															</Badge>
														))}
													</Table.Cell>
													<Table.Cell>
														{apiKey.last_used_at
															? new Date(apiKey.last_used_at).toLocaleString()
															: ctx.i18next.t("page.apiKeys.table.lastUsed.never")}
													</Table.Cell>
													<Table.Cell>
														{apiKey.expires_at ? (
															<Badge tone={isExpired ? "down" : "neutral"}>
																{new Date(apiKey.expires_at).toLocaleDateString()}
															</Badge>
														) : (
															ctx.i18next.t("page.apiKeys.table.expires.never")
														)}
													</Table.Cell>
													<Table.Cell>
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
