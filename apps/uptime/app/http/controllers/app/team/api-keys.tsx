/**
 * API keys list controller. Requires `requireUser` + `requireTeam` +
 * `requireAbility(abilities.apiKeys.read)`. Reads the one-time `newApiKey` session flash so a key just
 * created on this render (redirected from the create action) can be shown once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { IntlProvider } from "@sdxc/i18n/ui";
import { PlusIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { mbe } from "@sdxc/u/size";
import { font, wordBreak } from "@sdxc/u/typography";
import { Alert, Badge, Button, Confirm, LinkButton } from "@sdxc/ui";
import { Empty, Table } from "@sdxc/ui/app";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import { teamAccess } from "~/app/http/middleware/access";
import appShellData from "~/app/http/middleware/app-shell-data";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import abilities from "~/app/policies/abilities";
import CopyButton from "~/resources/components/copy-button";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

interface NewApiKey {
	name: string;
	key: string;
}

/** The flash an API key action left for this page, shown as one toast. */
interface Toast {
	intent: "success" | "error";
	message: string;
}

/**
 * GET /app/:team/api-keys — the team's API keys list. CopyButton sits inside
 * an IntlProvider because its clientEntry island also renders server-side,
 * where intl(handle) needs an IntlProvider ancestor to resolve. Creating a key is offered
 * only while the team is under its key limit.
 */
export default createAction(routes.app.team.apiKeys.index, {
	middleware: [
		requireUser,
		requireTeam,
		appShellData(),
		teamAccess,
		requireAbility(abilities.apiKeys.read),
	],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let apiKeys = await ctx.models.apiKeys.inTeam(ctx.team.id).orderBy("created_at", "desc").all();
		let session = ctx.get(Session);
		let newApiKey = session?.get("newApiKey") as NewApiKey | undefined;
		let toast = session?.get("toast") as Toast | undefined;

		let t = ctx.intl.t;
		let now = Date.now();
		let newKeyHref = routes.app.team.apiKeys.new.href({ team: ctx.team.slug });
		let canCreate = apiKeys.length < MAX_API_KEYS_PER_TEAM;

		return ctx.render(
			<DocumentLayout
				assets={ctx.assets}
				title={ctx.intl.t("app.titles.apiKeys", { team: ctx.team.name })}
			>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={t("page.apiKeys.header.title")}
					toast={toast}
					primaryAction={
						canCreate && apiKeys.length > 0 ? (
							<LinkButton href={newKeyHref}>
								<PlusIcon size={16} strokeWidth={1.5} />
								{t("page.apiKeys.header.action.create")}
							</LinkButton>
						) : undefined
					}
				>
					{newApiKey && (
						<Alert color="success" mix={[mbe(6)]}>
							<Alert.Content>
								<Alert.Title>
									{t("page.apiKeys.newKey.title", { name: newApiKey.name })}
								</Alert.Title>
								<Alert.Description>{t("page.apiKeys.newKey.description")}</Alert.Description>
								<div mix={[hstack({ gap: 3, align: "center" })]}>
									<code mix={[font("mono"), wordBreak("break-all")]}>{newApiKey.key}</code>
									<IntlProvider intl={ctx.intl}>
										<CopyButton value={newApiKey.key} label={t("page.apiKeys.newKey.copyLabel")} />
									</IntlProvider>
								</div>
							</Alert.Content>
						</Alert>
					)}

					{apiKeys.length === 0 ? (
						<Empty kind="first-run">
							<Empty.Title>{t("page.apiKeys.empty.title")}</Empty.Title>
							<Empty.Description>{t("page.apiKeys.empty.description")}</Empty.Description>
							<Empty.Action>
								<LinkButton href={newKeyHref}>
									<PlusIcon size={16} strokeWidth={1.5} />
									{t("page.apiKeys.empty.cta")}
								</LinkButton>
							</Empty.Action>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={t("page.apiKeys.table.label")}>
								<Table.Header>
									<Table.Row>
										<Table.Column>{t("page.apiKeys.table.columns.name")}</Table.Column>
										<Table.Column>{t("page.apiKeys.table.columns.prefix")}</Table.Column>
										<Table.Column>{t("page.apiKeys.table.columns.scopes")}</Table.Column>
										<Table.Column>{t("page.apiKeys.list.created")}</Table.Column>
										<Table.Column>{t("page.apiKeys.table.columns.lastUsed")}</Table.Column>
										<Table.Column>{t("page.apiKeys.table.columns.expires")}</Table.Column>
										<Table.ActionsColumn label={t("page.apiKeys.table.columns.actions")} />
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{apiKeys.map((apiKey) => {
										let isExpired = apiKey.expires_at !== null && apiKey.expires_at < now;
										let deleteDialogId = `delete-api-key-${apiKey.id}`;

										return (
											<Table.Row key={apiKey.id}>
												<Table.Cell mix={[fg("neutral.emphasis")]}>{apiKey.name}</Table.Cell>
												<Table.IdCell value={apiKey.key_prefix} />
												<Table.Cell>
													<div mix={[hstack({ gap: 1 }), flexWrap()]}>
														{apiKey.scopes.map((scope) => (
															<Badge key={scope} color="neutral" variant="outline">
																{scope}
															</Badge>
														))}
													</div>
												</Table.Cell>
												<Table.DateCell
													date={apiKey.created_at}
													now={now}
													locale={ctx.locale}
													local
												/>
												{apiKey.last_used_at ? (
													<Table.DateCell
														date={apiKey.last_used_at}
														now={now}
														locale={ctx.locale}
														local
													/>
												) : (
													<Table.Cell mix={[fg("neutral.muted")]}>
														{t("page.apiKeys.table.lastUsed.never")}
													</Table.Cell>
												)}
												{apiKey.expires_at ? (
													<Table.DateCell
														date={apiKey.expires_at}
														now={now}
														locale={ctx.locale}
														local
														mix={isExpired ? [fg("danger")] : undefined}
													/>
												) : (
													<Table.Cell mix={[fg("neutral.muted")]}>
														{t("page.apiKeys.table.expires.never")}
													</Table.Cell>
												)}
												<Table.Actions>
													<Button
														type="button"
														size="sm"
														variant="ghost"
														color="danger"
														commandfor={deleteDialogId}
														command="show-modal"
													>
														{t("page.apiKeys.table.actions.delete")}
													</Button>
													<Confirm
														id={deleteDialogId}
														title={t("app.confirm.deleteApiKey.title", { name: apiKey.name })}
														description={t("app.confirm.deleteApiKey.description")}
														confirmLabel={t("page.apiKeys.table.actions.delete")}
														cancelLabel={t("page.apiKeys.form.actions.cancel")}
														form={{
															action: routes.teamAdminActions.apiKey.delete.href({
																team: ctx.team.slug,
															}),
															fields: (
																<>
																	<input type="hidden" name="_method" value="DELETE" />
																	<input type="hidden" name="api_key_id" value={apiKey.id} />
																</>
															),
														}}
													/>
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
