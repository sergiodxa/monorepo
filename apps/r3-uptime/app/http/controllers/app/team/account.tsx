/**
 * Account page controller. Requires `requireUser` + `requireTeam` — the `:team` in
 * its URL only picks which team's shell wraps the page; the content itself lists
 * every team the viewer belongs to.
 *
 * Renders the account page body as a series of card-boxed sections (Profile,
 * Language, Your Teams), matching the same section-header-plus-bordered-card
 * layout used across this app's other settings pages. The "Leave" action per team
 * only shows for members who aren't the owner, and is gated behind a confirmation
 * dialog like every other destructive action in this app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LogOutIcon, PlusIcon } from "@pkg/lucide-remix";
import { AlertDialog, Empty, Select, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { supportedLanguages } from "~/database/schema";
import Avatar from "~/resources/components/avatar";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import RowMenu, { menuItem, menuItemDanger } from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

/** GET /app/:team/account — the signed-in user's account settings. */
export default createAction(routes.app.team.account, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [memberships, preferences] = await Promise.all([
			Team.listWithRoleBySubjectId(db, viewer.id),
			UserPreferences.findBySubjectId(db, viewer.id),
		]);

		let preferredLanguage = preferences?.preferred_language ?? null;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Account`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.account.header.title")}
				>
					<div mix={[css({ display: "flex", flexDirection: "column", gap: 48 })]}>
						{/* Profile */}
						<section
							id="profile"
							mix={[
								css({
									width: "100%",
									maxWidth: 640,
									marginInline: "auto",
									display: "flex",
									flexDirection: "column",
									gap: 24,
								}),
							]}
						>
							<div mix={[css({ display: "flex", flexDirection: "column", gap: 4 })]}>
								<h2 mix={[css({ margin: 0, fontSize: "1.25rem", fontWeight: 600 })]}>
									{ctx.i18next.t("page.account.profile.title")}
								</h2>
								<p
									mix={[
										css({
											margin: 0,
											fontSize: "0.875rem",
											color: neutral[500],
											"@media (prefers-color-scheme: dark)": { color: neutral[400] },
										}),
									]}
								>
									{ctx.i18next.t("page.account.profile.description")}
								</p>
							</div>

							<div
								mix={[
									css({
										borderRadius: 12,
										border: `1px solid ${neutral[200]}`,
										overflow: "hidden",
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
								]}
							>
								<div
									mix={[
										css({
											padding: "20px 24px",
											borderBottom: `1px solid ${neutral[200]}`,
											"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
										}),
									]}
								>
									<h3 mix={[css({ margin: "0 0 4px", fontSize: "1rem", fontWeight: 600 })]}>
										{ctx.i18next.t("page.account.profile.card.title")}
									</h3>
									<p
										mix={[
											css({
												margin: 0,
												fontSize: "0.8125rem",
												color: neutral[500],
												"@media (prefers-color-scheme: dark)": { color: neutral[400] },
											}),
										]}
									>
										{ctx.i18next.t("page.account.profile.card.description")}
									</p>
								</div>

								<div mix={[css({ padding: 24, display: "flex", alignItems: "center", gap: 16 })]}>
									<Avatar src={viewer.avatar || null} name={viewer.name} size={48} />
									<div>
										<div mix={[css({ fontWeight: 600 })]}>{viewer.name}</div>
										<a
											href={`mailto:${viewer.email}`}
											mix={[
												css({
													fontSize: "0.8125rem",
													color: primary[600],
													textDecoration: "none",
													"&:hover": { textDecoration: "underline" },
													"@media (prefers-color-scheme: dark)": { color: primary[400] },
												}),
											]}
										>
											{viewer.email}
										</a>
									</div>
								</div>
							</div>
						</section>

						{/* Language */}
						<section
							id="language"
							mix={[
								css({
									width: "100%",
									maxWidth: 640,
									marginInline: "auto",
									display: "flex",
									flexDirection: "column",
									gap: 24,
								}),
							]}
						>
							<div mix={[css({ display: "flex", flexDirection: "column", gap: 4 })]}>
								<h2 mix={[css({ margin: 0, fontSize: "1.25rem", fontWeight: 600 })]}>
									{ctx.i18next.t("page.account.language.title")}
								</h2>
								<p
									mix={[
										css({
											margin: 0,
											fontSize: "0.875rem",
											color: neutral[500],
											"@media (prefers-color-scheme: dark)": { color: neutral[400] },
										}),
									]}
								>
									{ctx.i18next.t("page.account.language.description")}
								</p>
							</div>

							<div
								mix={[
									css({
										borderRadius: 12,
										border: `1px solid ${neutral[200]}`,
										overflow: "hidden",
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
								]}
							>
								<form method="post" action={routes.accountActions.updateLanguage.href()}>
									<div
										mix={[
											css({
												padding: "20px 24px",
												borderBottom: `1px solid ${neutral[200]}`,
												"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
											}),
										]}
									>
										<h3 mix={[css({ margin: "0 0 4px", fontSize: "1rem", fontWeight: 600 })]}>
											{ctx.i18next.t("page.account.language.card.title")}
										</h3>
										<p
											mix={[
												css({
													margin: 0,
													fontSize: "0.8125rem",
													color: neutral[500],
													"@media (prefers-color-scheme: dark)": { color: neutral[400] },
												}),
											]}
										>
											{ctx.i18next.t("page.account.language.card.description")}
										</p>
									</div>

									<div
										mix={[
											css({
												// `Field`'s own trailing margin already spaces its last
												// instance from the footer below, so this region carries no
												// bottom padding of its own — otherwise the two would stack
												// into a gap far larger than every other card's footer rhythm.
												padding: "24px 24px 0",
												display: "flex",
												flexDirection: "column",
												gap: 8,
											}),
										]}
									>
										<Field
											label={ctx.i18next.t("page.account.language.form.fields.language.label")}
											description={ctx.i18next.t(
												"page.account.language.form.fields.language.description",
											)}
										>
											<Select name="language" defaultValue={preferredLanguage ?? "auto"}>
												<Select.Option value="auto">
													{ctx.i18next.t("page.account.language.form.fields.language.options.auto")}
												</Select.Option>
												{supportedLanguages.map((code) => (
													<Select.Option key={code} value={code}>
														{ctx.i18next.t(
															`page.account.language.form.fields.language.options.${code}`,
														)}
													</Select.Option>
												))}
											</Select>
										</Field>
									</div>

									<div
										mix={[
											css({
												padding: "16px 24px",
												borderTop: `1px solid ${neutral[200]}`,
												display: "flex",
												justifyContent: "flex-end",
												gap: 8,
												"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
											}),
										]}
									>
										<Button type="reset" variant="outline">
											{ctx.i18next.t("page.account.form.actions.cancel")}
										</Button>
										<Button type="submit">{ctx.i18next.t("page.account.language.form.cta")}</Button>
									</div>
								</form>
							</div>
						</section>

						{/* Your Teams */}
						<section
							id="teams"
							mix={[
								css({
									width: "100%",
									maxWidth: 640,
									marginInline: "auto",
									display: "flex",
									flexDirection: "column",
									gap: 24,
								}),
							]}
						>
							<div
								mix={[
									css({
										display: "flex",
										alignItems: "flex-start",
										justifyContent: "space-between",
										gap: 16,
									}),
								]}
							>
								<div mix={[css({ display: "flex", flexDirection: "column", gap: 4 })]}>
									<h2 mix={[css({ margin: 0, fontSize: "1.25rem", fontWeight: 600 })]}>
										{ctx.i18next.t("page.account.teams.title")}
									</h2>
									<p
										mix={[
											css({
												margin: 0,
												fontSize: "0.875rem",
												color: neutral[500],
												"@media (prefers-color-scheme: dark)": { color: neutral[400] },
											}),
										]}
									>
										{ctx.i18next.t("page.account.teams.description")}
									</p>
								</div>
								<Button
									type="button"
									commandfor="create-team"
									command="show-modal"
									mix={[css({ flexShrink: 0 })]}
								>
									<PlusIcon size={16} strokeWidth={1.5} />
									<span>{ctx.i18next.t("page.account.teams.actions.createTeam")}</span>
								</Button>
							</div>

							<dialog
								id="create-team"
								mix={[
									css({
										width: "100%",
										maxWidth: "min(440px, calc(100vw - 32px))",
										padding: 24,
										boxSizing: "border-box",
										borderRadius: 8,
										border: `1px solid ${neutral[300]}`,
										"&::backdrop": {
											background: "rgba(0, 0, 0, 0.4)",
										},
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
											color: neutral[50],
										},
									}),
								]}
							>
								<h3>{ctx.i18next.t("page.createTeam.header.title")}</h3>
								<form method="post" action={routes.accountActions.createTeam.href()}>
									<Field label={ctx.i18next.t("page.createTeam.form.fields.name.label")}>
										<input
											type="text"
											name="name"
											required
											placeholder={ctx.i18next.t("page.createTeam.form.fields.name.placeholder")}
											mix={[
												css({
													padding: "8px 12px",
													borderRadius: 6,
													border: `1px solid ${neutral[200]}`,
													fontSize: "0.875rem",
													fontFamily: "inherit",
													background: neutral[50],
													color: "inherit",
													"@media (prefers-color-scheme: dark)": {
														borderColor: neutral[700],
														background: neutral[900],
													},
												}),
											]}
										/>
									</Field>
									<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
										<Button
											type="button"
											variant="outline"
											commandfor="create-team"
											command="close"
										>
											{ctx.i18next.t("page.createTeam.form.cancel")}
										</Button>
										<Button type="submit">{ctx.i18next.t("page.createTeam.form.cta")}</Button>
									</div>
								</form>
							</dialog>

							<div
								mix={[
									css({
										borderRadius: 12,
										border: `1px solid ${neutral[200]}`,
										overflow: "hidden",
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
								]}
							>
								<div
									mix={[
										css({
											padding: "20px 24px",
											borderBottom: `1px solid ${neutral[200]}`,
											"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
										}),
									]}
								>
									<h3 mix={[css({ margin: "0 0 4px", fontSize: "1rem", fontWeight: 600 })]}>
										{ctx.i18next.t("page.account.teams.table.label")}
									</h3>
									<p
										mix={[
											css({
												margin: 0,
												fontSize: "0.8125rem",
												color: neutral[500],
												"@media (prefers-color-scheme: dark)": { color: neutral[400] },
											}),
										]}
									>
										{ctx.i18next.t("page.account.teams.table.description")}
									</p>
								</div>

								{memberships.length === 0 ? (
									<div mix={[css({ padding: 24 })]}>
										<Empty>
											<Empty.Description>
												{ctx.i18next.t("page.account.teams.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
								) : (
									<Table.Container>
										<Table aria-label={ctx.i18next.t("page.account.teams.table.label")}>
											<Table.Header>
												<Table.Row>
													<Table.Column>
														{ctx.i18next.t("page.account.teams.table.columns.team")}
													</Table.Column>
													<Table.Column align="end">
														{ctx.i18next.t("page.account.teams.table.columns.role")}
													</Table.Column>
													<Table.Column align="center">
														<span
															mix={[
																css({
																	position: "absolute",
																	width: 1,
																	height: 1,
																	padding: 0,
																	margin: -1,
																	overflow: "hidden",
																	clip: "rect(0, 0, 0, 0)",
																	whiteSpace: "nowrap",
																	border: 0,
																}),
															]}
														>
															{ctx.i18next.t("page.account.teams.table.columns.actions")}
														</span>
													</Table.Column>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{memberships.map(({ team, role, isOwner }) => {
													let canLeave = !isOwner && role === "member";
													let leaveDialogId = `leave-team-${team.id}`;
													let leaveDialogTitleId = `${leaveDialogId}-title`;

													return (
														<Table.Row key={team.id}>
															<Table.Cell>
																<a
																	href={routes.app.team.dashboard.index.href({ team: team.slug })}
																	mix={[
																		css({
																			color: primary[600],
																			textDecoration: "none",
																			"&:hover": { textDecoration: "underline" },
																			"@media (prefers-color-scheme: dark)": {
																				color: primary[400],
																			},
																		}),
																	]}
																>
																	{team.name}
																</a>
															</Table.Cell>
															<Table.Cell mix={[css({ textAlign: "right" })]}>
																{ctx.i18next.t(
																	`page.account.teams.table.role.${isOwner ? "owner" : role}`,
																)}
															</Table.Cell>
															<Table.Cell mix={[css({ textAlign: "center" })]}>
																{canLeave && (
																	<>
																		<RowMenu
																			id={`team-menu-${team.id}`}
																			label={ctx.i18next.t("page.account.teams.table.actions.menu")}
																		>
																			<button
																				type="button"
																				commandfor={leaveDialogId}
																				command="show-modal"
																				mix={[menuItem, menuItemDanger]}
																			>
																				<LogOutIcon size={16} strokeWidth={1.5} />
																				<span>
																					{ctx.i18next.t("page.account.teams.table.actions.leave")}
																				</span>
																			</button>
																		</RowMenu>

																		<AlertDialog
																			id={leaveDialogId}
																			aria-labelledby={leaveDialogTitleId}
																		>
																			<AlertDialog.Header>
																				<AlertDialog.Title id={leaveDialogTitleId}>
																					{ctx.i18next.t(
																						"page.account.teams.table.confirmation.leaveTeam",
																						{ name: team.name },
																					)}
																				</AlertDialog.Title>
																			</AlertDialog.Header>
																			<form
																				method="post"
																				action={routes.accountActions.leaveTeam.href()}
																			>
																				<input type="hidden" name="team_id" value={team.id} />
																				<AlertDialog.Footer>
																					<AlertDialog.Cancel commandfor={leaveDialogId}>
																						{ctx.i18next.t("page.account.form.actions.cancel")}
																					</AlertDialog.Cancel>
																					<AlertDialog.Action
																						type="submit"
																						commandfor={leaveDialogId}
																					>
																						{ctx.i18next.t(
																							"page.account.teams.table.actions.leave",
																						)}
																					</AlertDialog.Action>
																				</AlertDialog.Footer>
																			</form>
																		</AlertDialog>
																	</>
																)}
															</Table.Cell>
														</Table.Row>
													);
												})}
											</Table.Body>
										</Table>
									</Table.Container>
								)}
							</div>
						</section>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
