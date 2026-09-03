/**
 * Account page controller. Requires `requireUser` + `requireTeam`. The URL's `:team`
 * selects which shell wraps the page; the settings inside apply to the viewer across
 * every team they belong to. The Emails section carries `EMAIL_PREFERENCES_ANCHOR` so
 * digest unsubscribe links land directly on its switches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DownloadIcon, LogOutIcon, PlusIcon, Trash2Icon } from "@sdxc/icons";
import { inject } from "@sdxc/service-container";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { boxSizing, hstack, shrink, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { is, m, maxIs, mi, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { font, fontSize, textAlign, textDecoration, weight } from "@sdxc/u/typography";
import { AlertDialog, Button, Description, Empty, Select, Switch, Table } from "@sdxc/ui";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { OptionalEmail } from "~/database/schema";

import AccountDeletion from "~/app/data/account-deletion";
import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { EMAIL_PREFERENCES_ANCHOR } from "~/app/emails/shared/team-digest";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { planAccountErasure } from "~/app/services/account-erasure";
import { optionalEmails, supportedLanguages } from "~/database/schema";
import Avatar from "~/resources/components/avatar";
import Field from "~/resources/components/field";
import RowMenu, { menuItem, menuItemDanger } from "~/resources/components/row-menu";
import { SETTINGS_FIELD_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Viewport from which a section's card is allowed to bleed past its column: below it, the
 * same 24px bleed the shell pads by would overflow and scroll sideways, so the card stays
 * flush until the shell's own breakpoint gives it room.
 */
const CARD_BLEED_FROM = "(min-width: 768px)";

/**
 * The bordered card each section on this page is built around, pulled out by the 24px of
 * inline padding its own rows carry so the copy inside lines up with the section heading
 * above it rather than sitting 24px to the right.
 */
function settingsCard() {
	return [
		rounded("12px"),
		border({ color: "neutral", width: 1 }),
		overflow(),
		media(CARD_BLEED_FROM, mi("-24px")),
	];
}

/** DOM id of one email's description, wired to its switch through `aria-describedby`. */
function emailDescriptionId(email: OptionalEmail) {
	return `email-${email}-description`;
}

/**
 * The bordered card the delete section is built around: the same geometry as
 * {@link settingsCard}, in the danger colour that marks it as the page's destructive
 * section.
 */
function dangerCard() {
	return [
		rounded("12px"),
		border({ color: "danger", width: 1 }),
		overflow(),
		media(CARD_BLEED_FROM, mi("-24px")),
	];
}

/**
 * The typed-confirmation field. `pattern="DELETE"` gates the submit button natively with
 * no client JS involved; the action enforces the same word again since the authoritative
 * check happens server-side.
 */
function confirmationInput() {
	return [
		is("full"),
		boxSizing("border-box"),
		p("8px", "12px"),
		rounded("6px"),
		border({ color: "neutral", width: 1 }),
		fontSize("0.875rem"),
		font("inherit"),
		bg("neutral.tint"),
		fg("inherit"),
	];
}

/** GET /app/:team/account — the signed-in user's account settings. */
export default createAction(routes.app.team.account, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [memberships, preferences, plan, queuedDeletion] = await Promise.all([
			Team.listWithRoleBySubjectId(db, viewer.id),
			UserPreferences.findBySubjectId(db, viewer.id),
			planAccountErasure(db, viewer.id),
			AccountDeletion.findBySubjectId(db, viewer.id),
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
					i18next={ctx.i18next}
					heading={ctx.i18next.t("page.account.header.title")}
				>
					<div mix={[vstack({ gap: "48px" })]}>
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

							<div mix={settingsCard()}>
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

							<div mix={settingsCard()}>
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

									<div mix={[p("24px"), vstack({ gap: SETTINGS_FIELD_GAP })]}>
										<Field
											label={ctx.i18next.t("page.account.language.form.fields.language.label")}
											description={ctx.i18next.t(
												"page.account.language.form.fields.language.description",
											)}
										>
											<Select
												name="language"
												/**
												 * `<select>` has no `defaultValue` attribute, so the saved preference is marked
												 * `selected` on its own `<option>` instead — spelling it on the host would
												 * render as inert markup and leave "Automatic" showing.
												 */
											>
												<Select.Option value="auto" selected={preferredLanguage === null}>
													{ctx.i18next.t("page.account.language.form.fields.language.options.auto")}
												</Select.Option>
												{supportedLanguages.map((code) => (
													<Select.Option
														key={code}
														value={code}
														selected={code === preferredLanguage}
													>
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

						<section
							id={EMAIL_PREFERENCES_ANCHOR}
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[vstack({ gap: "4px" })]}>
								<h2 mix={[m(0), fontSize("1.25rem"), weight(600)]}>
									{ctx.i18next.t("page.account.emails.title")}
								</h2>
								<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.account.emails.description")}
								</p>
							</div>

							<div mix={settingsCard()}>
								<form method="post" action={routes.accountActions.updateEmails.href()}>
									<div
										mix={[
											p("20px", "24px"),
											borderEdge("block-end", { color: "neutral", width: 1 }),
										]}
									>
										<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600)]}>
											{ctx.i18next.t("page.account.emails.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.account.emails.card.description")}
										</p>
									</div>

									<div mix={[p("24px"), vstack({ gap: "20px" })]}>
										{optionalEmails.map((email) => (
											<div key={email} mix={[vstack({ gap: "4px" })]}>
												<Switch
													name="emails"
													value={email}
													/**
													 * Checked means subscribed; every switch defaults to checked because the
													 * stored preference lists only the emails a member turned off, so an absent
													 * email means they still want it.
													 */
													defaultChecked={UserPreferences.wants(preferences, email)}
													aria-describedby={emailDescriptionId(email)}
												>
													{ctx.i18next.t(`page.account.emails.list.${email}.name`)}
												</Switch>
												<Description
													/**
													 * Sits flush with the switch rather than indented under its label: a
													 * switch's track is 2.75rem wide, so an indent sized for a checkbox's label
													 * lands under neither the track nor the text.
													 */
													id={emailDescriptionId(email)}
												>
													{ctx.i18next.t(`page.account.emails.list.${email}.description`)}
												</Description>
											</div>
										))}
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
										<Button type="submit">{ctx.i18next.t("page.account.emails.form.cta")}</Button>
									</div>
								</form>
							</div>
						</section>

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
									boxSizing("border-box"),
									rounded("8px"),
									border({ color: "neutral", width: 1 }),
									bg("neutral.tint"),
									fg("neutral.emphasis"),
									when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
								]}
							>
								<h3>{ctx.i18next.t("page.createTeam.header.title")}</h3>
								<form
									method="post"
									action={routes.accountActions.createTeam.href()}
									mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}
								>
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
												font("inherit"),
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

							<div mix={settingsCard()}>
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

						<section
							id="data"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[vstack({ gap: "4px" })]}>
								<h2 mix={[m(0), fontSize("1.25rem"), weight(600)]}>
									{ctx.i18next.t("page.account.dataExport.title")}
								</h2>
								<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.account.dataExport.description")}
								</p>
							</div>

							<div mix={settingsCard()}>
								<form
									method="post"
									/**
									 * Uses POST so cross-origin protections apply: safe methods like GET carry
									 * none, and this action returns the viewer's entire account export.
									 */
									action={routes.accountActions.exportData.href()}
								>
									<div
										mix={[
											p("20px", "24px"),
											borderEdge("block-end", { color: "neutral", width: 1 }),
										]}
									>
										<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600)]}>
											{ctx.i18next.t("page.account.dataExport.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.account.dataExport.card.description")}
										</p>
									</div>

									<div mix={[p("24px"), vstack({ gap: "12px" })]}>
										<p mix={[m(0), fontSize("0.875rem")]}>
											{ctx.i18next.t("page.account.dataExport.card.includes")}
										</p>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.account.dataExport.card.excludes")}
										</p>
									</div>

									<div
										mix={[
											p("16px", "24px"),
											borderEdge("block-start", { color: "neutral", width: 1 }),
											hstack({ justify: "end" }),
										]}
									>
										<Button type="submit">
											<DownloadIcon size={16} strokeWidth={1.5} />
											<span>{ctx.i18next.t("page.account.dataExport.form.cta")}</span>
										</Button>
									</div>
								</form>
							</div>
						</section>

						<section
							id="delete-account"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: "24px" })]}
						>
							<div mix={[vstack({ gap: "4px" })]}>
								<h2 mix={[m(0), fontSize("1.25rem"), weight(600), fg("danger")]}>
									{ctx.i18next.t("page.account.deleteAccount.title")}
								</h2>
								<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.account.deleteAccount.description")}
								</p>
							</div>

							{queuedDeletion ? (
								/**
								 * Replaces the form rather than sitting above it: offering the confirmation
								 * again to somebody already queued would suggest the first request failed,
								 * when the only remaining action is the button below.
								 */
								<div mix={dangerCard()}>
									<div
										mix={[
											p("20px", "24px"),
											borderEdge("block-end", { color: "danger", width: 1 }),
										]}
									>
										<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600), fg("danger")]}>
											{ctx.i18next.t("page.account.deleteAccount.queued.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.account.deleteAccount.queued.requestedAt", {
												date: new Date(queuedDeletion.requested_at).toISOString().slice(0, 10),
											})}
										</p>
									</div>

									<div mix={[p("24px")]}>
										<p mix={[m(0), fontSize("0.875rem")]}>
											{ctx.i18next.t("page.account.deleteAccount.queued.description")}
										</p>
									</div>

									<form method="post" action={routes.accountActions.cancelDeletion.href()}>
										<input type="hidden" name="_method" value="DELETE" />
										<div
											mix={[
												p("16px", "24px"),
												borderEdge("block-start", { color: "danger", width: 1 }),
												hstack({ justify: "end" }),
											]}
										>
											<Button type="submit" variant="outline">
												{ctx.i18next.t("page.account.deleteAccount.queued.cta")}
											</Button>
										</div>
									</form>
								</div>
							) : (
								<div mix={dangerCard()}>
									<form method="post" action={routes.accountActions.requestDeletion.href()}>
										<div
											mix={[
												p("20px", "24px"),
												borderEdge("block-end", { color: "danger", width: 1 }),
											]}
										>
											<h3 mix={[m(0, 0, "4px", 0), fontSize("1rem"), weight(600), fg("danger")]}>
												{ctx.i18next.t("page.account.deleteAccount.card.title")}
											</h3>
											<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
												{ctx.i18next.t("page.account.deleteAccount.card.description")}
											</p>
										</div>

										<div mix={[p("24px"), vstack({ gap: "16px" })]}>
											<p mix={[m(0), fontSize("0.875rem")]}>
												{ctx.i18next.t("page.account.deleteAccount.card.whatHappens")}
											</p>

											{plan.ownedTeams.length === 0 ? (
												<p mix={[m(0), fontSize("0.875rem"), fg("neutral.muted")]}>
													{ctx.i18next.t("page.account.deleteAccount.card.noOwnedTeams")}
												</p>
											) : (
												<div mix={[vstack({ gap: "8px" })]}>
													<p mix={[m(0), fontSize("0.875rem")]}>
														{ctx.i18next.t("page.account.deleteAccount.card.ownedTeamsIntro")}
													</p>
													<ul mix={[m(0), p(0, 0, 0, "20px"), fontSize("0.875rem")]}>
														{plan.ownedTeams.map((team) => (
															<li key={team.id}>
																{team.otherMemberCount === 0
																	? ctx.i18next.t(
																			"page.account.deleteAccount.card.ownedTeamAlone",
																			{ name: team.name },
																		)
																	: ctx.i18next.t("page.account.deleteAccount.card.ownedTeam", {
																			name: team.name,
																			count: team.otherMemberCount,
																		})}
															</li>
														))}
													</ul>
												</div>
											)}

											{plan.othersLosingAccess > 0 && (
												<p
													/**
													 * Called out separately in the danger colour: it names a consequence for
													 * other people, while the rest of this section covers the account
													 * holder's own data.
													 */
													mix={[m(0), fontSize("0.875rem"), weight(600), fg("danger")]}
												>
													{ctx.i18next.t("page.account.deleteAccount.card.othersWarning", {
														count: plan.othersLosingAccess,
													})}
												</p>
											)}

											<div mix={[vstack({ gap: "4px" })]}>
												<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
													{ctx.i18next.t("page.account.deleteAccount.card.retained.intro")}
												</p>
												<ul
													mix={[
														m(0),
														p(0, 0, 0, "20px"),
														fontSize("0.8125rem"),
														fg("neutral.muted"),
													]}
												>
													<li>
														{ctx.i18next.t("page.account.deleteAccount.card.retained.billing")}
													</li>
													<li>
														{ctx.i18next.t("page.account.deleteAccount.card.retained.analytics")}
													</li>
													<li>{ctx.i18next.t("page.account.deleteAccount.card.retained.logs")}</li>
													<li>
														{ctx.i18next.t("page.account.deleteAccount.card.retained.identity")}
													</li>
												</ul>
											</div>

											<Field
												label={ctx.i18next.t("page.account.deleteAccount.card.confirmation.label")}
											>
												<input
													type="text"
													name="confirmation"
													required
													autocomplete="off"
													pattern="DELETE"
													title={ctx.i18next.t(
														"page.account.deleteAccount.card.confirmation.label",
													)}
													placeholder={ctx.i18next.t(
														"page.account.deleteAccount.card.confirmation.placeholder",
													)}
													mix={confirmationInput()}
												/>
											</Field>
										</div>

										<div
											mix={[
												p("16px", "24px"),
												borderEdge("block-start", { color: "danger", width: 1 }),
												hstack({ justify: "end" }),
											]}
										>
											<Button type="submit" color="danger">
												<Trash2Icon size={16} strokeWidth={1.5} />
												<span>{ctx.i18next.t("page.account.deleteAccount.card.cta")}</span>
											</Button>
										</div>
									</form>
								</div>
							)}
						</section>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
