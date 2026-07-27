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
import { AlertDialog, Button, Empty, Select, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { hstack, shrink, vstack } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { is, m, maxIs, mi, p } from "@pkg/u/size";
import { hover, when } from "@pkg/u/state";
import { fontSize, textAlign, textDecoration, weight } from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { supportedLanguages } from "~/database/schema";
import Avatar from "~/resources/components/avatar";
import Field from "~/resources/components/field";
import RowMenu, { menuItem, menuItemDanger } from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
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
					<div mix={[vstack({ gap: "48px" })]}>
						{/* Profile */}
						<section
							id="profile"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[vstack({ gap: "4px" })]}>
								<h2 mix={[m(0), fontSize("1.25rem"), weight(600)]}>
									{ctx.i18next.t("page.account.profile.title")}
								</h2>
								<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.account.profile.description")}
								</p>
							</div>

							<div mix={[rounded("12px"), border({ color: "neutral", width: 1 }), overflow()]}>
								<div
									mix={[p("20px", "24px"), borderEdge("block-end", { color: "neutral", width: 1 })]}
								>
									<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600)]}>
										{ctx.i18next.t("page.account.profile.card.title")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.account.profile.card.description")}
									</p>
								</div>

								<div mix={[p("24px"), hstack({ align: "center", gap: "16px" })]}>
									<Avatar src={viewer.avatar || null} name={viewer.name} size={48} />
									<div>
										<div mix={[weight(600)]}>{viewer.name}</div>
										<a
											href={`mailto:${viewer.email}`}
											mix={[
												fontSize("0.8125rem"),
												fg("brand"),
												textDecoration("none"),
												hover(textDecoration("underline")),
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
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[vstack({ gap: "4px" })]}>
								<h2 mix={[m(0), fontSize("1.25rem"), weight(600)]}>
									{ctx.i18next.t("page.account.language.title")}
								</h2>
								<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.account.language.description")}
								</p>
							</div>

							<div mix={[rounded("12px"), border({ color: "neutral", width: 1 }), overflow()]}>
								<form method="post" action={routes.accountActions.updateLanguage.href()}>
									<div
										mix={[
											p("20px", "24px"),
											borderEdge("block-end", { color: "neutral", width: 1 }),
										]}
									>
										<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600)]}>
											{ctx.i18next.t("page.account.language.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.account.language.card.description")}
										</p>
									</div>

									<div
										mix={[
											// `Field`'s own trailing margin already spaces its last
											// instance from the footer below, so this region carries no
											// bottom padding of its own — otherwise the two would stack
											// into a gap far larger than every other card's footer rhythm.
											p("24px", "24px", 0, "24px"),
											vstack({ gap: "8px" }),
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
											p("16px", "24px"),
											borderEdge("block-start", { color: "neutral", width: 1 }),
											hstack({ justify: "end", gap: "8px" }),
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
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[hstack({ align: "start", justify: "between", gap: "16px" })]}>
								<div mix={[vstack({ gap: "4px" })]}>
									<h2 mix={[m(0), fontSize("1.25rem"), weight(600)]}>
										{ctx.i18next.t("page.account.teams.title")}
									</h2>
									<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.account.teams.description")}
									</p>
								</div>
								<Button
									type="button"
									commandfor="create-team"
									command="show-modal"
									mix={[shrink(0)]}
								>
									<PlusIcon size={16} strokeWidth={1.5} />
									<span>{ctx.i18next.t("page.account.teams.actions.createTeam")}</span>
								</Button>
							</div>

							<dialog
								id="create-team"
								mix={[
									is("full"),
									maxIs("min(440px, calc(100vw - 32px))"),
									p("24px"),
									raw({ boxSizing: "border-box" }),
									rounded("8px"),
									border({ color: "neutral", width: 1 }),
									bg("neutral.tint"),
									fg("neutral.emphasis"),
									when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
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
												p("8px", "12px"),
												rounded("6px"),
												border({ color: "neutral", width: 1 }),
												fontSize("0.875rem"),
												raw({ fontFamily: "inherit" }),
												bg("neutral.tint"),
												fg("inherit"),
											]}
										/>
									</Field>
									<div mix={[hstack({ gap: "8px", justify: "end" })]}>
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

							<div mix={[rounded("12px"), border({ color: "neutral", width: 1 }), overflow()]}>
								<div
									mix={[p("20px", "24px"), borderEdge("block-end", { color: "neutral", width: 1 })]}
								>
									<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600)]}>
										{ctx.i18next.t("page.account.teams.table.label")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.account.teams.table.description")}
									</p>
								</div>

								{memberships.length === 0 ? (
									<div mix={[p("24px")]}>
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
														<span mix={[visuallyHidden()]}>
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
																		fg("brand"),
																		textDecoration("none"),
																		hover(textDecoration("underline")),
																	]}
																>
																	{team.name}
																</a>
															</Table.Cell>
															<Table.Cell mix={[textAlign("end")]}>
																{ctx.i18next.t(
																	`page.account.teams.table.role.${isOwner ? "owner" : role}`,
																)}
															</Table.Cell>
															<Table.Cell mix={[textAlign("center")]}>
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
