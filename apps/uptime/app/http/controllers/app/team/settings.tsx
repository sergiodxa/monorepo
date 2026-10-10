/**
 * Team settings page controller, gated behind `requireUser`, `requireTeam`, and
 * `requireRole("admin")`. Billing and Danger Zone stay owner-only, and the
 * danger-zone delete button relies on the native `pattern="DELETE"` constraint
 * to stay disabled-in-effect until the confirmation input matches exactly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { addDays, formatDate, formatRelative } from "@sdxc/dates";
import { Trans } from "@sdxc/i18n/ui";
import {
	BadgeMinusIcon,
	ExternalLinkIcon,
	HandshakeIcon,
	RefreshCcwIcon,
	UserCogIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { pointerEvents, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	basis,
	boxSizing,
	grow,
	hstack,
	insBottom,
	insRight,
	insTop,
	shrink,
	vstack,
} from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { is, maxIs, mi, minIs, p, m, width } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import {
	font,
	fontSize,
	nowrap,
	textAlign,
	textDecoration,
	weight,
	wordBreak,
} from "@sdxc/u/typography";
import { AlertDialog, Button, Empty, LinkButton, Table } from "@sdxc/ui";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import Invite from "~/app/data/invite";
import Team from "~/app/data/team";
import { admin } from "~/app/http/middleware/admin";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { createManagementClient } from "~/app/lib/management-client";
import { teamLogoUrl } from "~/app/lib/team-logo";
import { resolveSubjects } from "~/app/services/subjects";
import Avatar from "~/resources/components/avatar";
import Field from "~/resources/components/field";
import RowMenu, { menuItem, menuItemDanger, menuSeparator } from "~/resources/components/row-menu";
import { SETTINGS_FIELD_GAP } from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

const INVITE_EXPIRATION_DAYS = 7;

/**
 * Session flash key carrying the logo text the update-team action rejected, read once by
 * this page to refill the field and show its error beside it.
 */
export const TEAM_LOGO_ERROR = "teamLogoError";

/** DOM id of the logo field's error, referenced by the input's `aria-describedby`. */
const LOGO_ERROR_ID = "team-logo-error";

/**
 * How long an invite has left, worded for `locale`, or `isExpired: true` once its
 * {@link INVITE_EXPIRATION_DAYS} have passed so the row shows the expired label instead.
 */
function describeInviteExpiration(
	createdAt: number,
	locale: string,
): { text: string; isExpired: boolean } {
	let expiresAt = addDays(new Date(createdAt), INVITE_EXPIRATION_DAYS);
	if (expiresAt.getTime() <= Date.now()) return { text: "", isExpired: true };
	return { text: formatRelative(expiresAt, { locale }), isExpired: false };
}

/**
 * Viewport from which a section's card is allowed to bleed past its column.
 *
 * `AppShell` pads its content area by 20px below this width and 48px above it, so a
 * card bleeding 6 spacing units past that padding has room only above the threshold.
 */
const CARD_BLEED_FROM = "(min-width: 768px)";

/**
 * The bordered card each section on this page is built around.
 *
 * Pulled out by exactly the inline padding its own rows carry (`p(5, 6)`), so the
 * card's edge lines up with the section heading above it.
 */
function settingsCard(tone: "neutral" | "danger" = "neutral") {
	return [
		rounded("xl"),
		border({ color: tone, width: 1 }),
		overflow(),
		media(CARD_BLEED_FROM, mi(-6)),
	];
}

/** Shared visual style for every text/url input across this page's forms. */
function textInput() {
	return [
		p(2, 3),
		rounded("md"),
		border({ color: "neutral", width: 1 }),
		fontSize("sm"),
		font("inherit"),
		bg("neutral.tint"),
		fg("inherit"),
	];
}

/**
 * GET /app/:team/settings — team settings: general, members, domains, billing, danger zone.
 *
 * The transfer-ownership menu item stays disabled until a transfer action exists. Field's
 * own trailing margin spaces the danger-zone confirmation input from the footer below.
 */
export default createAction(routes.app.team.settings, {
	middleware: [requireUser, requireTeam, requireRole("admin"), admin(createManagementClient)],
	handler: async (ctx) => {
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [members, pendingInvites, domains] = await Promise.all([
			Team.listMembersByTeam(ctx.db, ctx.team.id),
			Invite.listPendingByTeam(ctx.db, ctx.team.id),
			ctx.models.teamDomains.inTeam(ctx.team.id).orderBy("created_at", "desc").all(),
		]);

		let subjectsById = await resolveSubjects(
			ctx.admin,
			members.map((member) => member.subject_id),
		);

		let team = ctx.team;
		let rejectedLogo = ctx.get(Session)?.get(TEAM_LOGO_ERROR);
		let logoError = typeof rejectedLogo === "string";
		let viewerIsOwner = viewer.id === team.owner_id;
		let hasPendingDomainVerification = domains.some((domain) => domain.verified_at === null);

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Settings`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					intl={ctx.intl}
					heading={ctx.intl.t("page.settings.header.title")}
				>
					<div mix={[vstack({ gap: 12 })]}>
						<section
							id="general"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
									{ctx.intl.t("page.settings.sections.general.title")}
								</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.intl.t("page.settings.sections.general.description")}
								</p>
							</div>

							<div mix={settingsCard()}>
								<form
									method="post"
									action={routes.teamAdminActions.team.update.href({ team: team.slug })}
								>
									<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.intl.t("page.settings.form.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.intl.t("page.settings.form.card.description")}
										</p>
									</div>

									<div mix={[p(6), vstack({ gap: SETTINGS_FIELD_GAP })]}>
										<Field
											label={ctx.intl.t("page.settings.form.fields.logo.label")}
											description={ctx.intl.t("page.settings.form.fields.logo.description")}
											error={
												logoError ? ctx.intl.t("page.settings.form.fields.logo.error") : undefined
											}
											errorId={LOGO_ERROR_ID}
										>
											<div mix={[hstack({ gap: 4, align: "center" })]}>
												<Avatar src={teamLogoUrl(team.logo)} name={team.name} size={48} />
												<input
													type="url"
													name="logo"
													defaultValue={logoError ? rejectedLogo : (team.logo ?? "")}
													placeholder={ctx.intl.t("page.settings.form.fields.logo.placeholder")}
													aria-invalid={logoError ? "true" : undefined}
													aria-describedby={logoError ? LOGO_ERROR_ID : undefined}
													mix={[textInput(), grow(), shrink(1), basis("0%")]}
												/>
											</div>
										</Field>

										<Field
											label={ctx.intl.t("page.settings.form.fields.name.label")}
											description={ctx.intl.t("page.settings.form.fields.name.description")}
										>
											<input
												type="text"
												name="name"
												required
												defaultValue={team.name}
												placeholder={ctx.intl.t("page.settings.form.fields.name.placeholder")}
												mix={[textInput()]}
											/>
										</Field>
									</div>

									<div
										mix={[
											p(4, 6),
											borderEdge("block-start", { color: "neutral", width: 1 }),
											hstack({ gap: 2, justify: "end" }),
										]}
									>
										<Button type="reset" variant="outline">
											{ctx.intl.t("page.settings.form.actions.cancel")}
										</Button>
										<Button type="submit">{ctx.intl.t("page.settings.form.actions.save")}</Button>
									</div>
								</form>
							</div>
						</section>

						<section
							id="members"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[hstack({ gap: 4, align: "start", justify: "between" })]}>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
										{ctx.intl.t("page.settings.members.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.members.description")}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									commandfor="invite-member"
									command="show-modal"
									mix={[shrink()]}
								>
									<UserPlusIcon size={16} strokeWidth={1.5} />
									<span>{ctx.intl.t("page.settings.members.actions.invite")}</span>
								</Button>
							</div>

							<dialog
								id="invite-member"
								mix={[
									is("full"),
									maxIs("min(440px, calc(100vw - 32px))"),
									p(6),
									boxSizing("border-box"),
									rounded("lg"),
									border({ color: "neutral", width: 1 }),
									bg("neutral.tint"),
									fg("neutral.emphasis"),
									when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
								]}
							>
								<h3 mix={[m(0, 0, 4, 0), fontSize("base"), weight("semibold")]}>
									{ctx.intl.t("page.invite.header.title")}
								</h3>
								<form
									method="post"
									action={routes.teamAdminActions.invite.create.href({ team: team.slug })}
									mix={[vstack({ gap: SETTINGS_FIELD_GAP })]}
								>
									<Field label={ctx.intl.t("page.invite.form.fields.email.label")}>
										<input
											type="email"
											name="email"
											required
											placeholder={ctx.intl.t("page.invite.form.fields.email.placeholder")}
											mix={[textInput()]}
										/>
									</Field>
									<div mix={[hstack({ gap: 2, justify: "end" })]}>
										<Button
											type="button"
											variant="outline"
											commandfor="invite-member"
											command="close"
										>
											{ctx.intl.t("page.invite.form.cancel")}
										</Button>
										<Button type="submit">{ctx.intl.t("page.invite.form.cta")}</Button>
									</div>
								</form>
							</dialog>

							<div mix={settingsCard()}>
								<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
									<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
										{ctx.intl.t("page.settings.members.table.label")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.members.table.description")}
									</p>
								</div>

								<Table.Container>
									<Table aria-label={ctx.intl.t("page.settings.members.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.intl.t("page.settings.members.table.columns.name")}
												</Table.Column>
												<Table.Column align="end">
													{ctx.intl.t("page.settings.members.table.columns.role")}
												</Table.Column>
												<Table.Column align="center">
													<span mix={[visuallyHidden()]}>
														{ctx.intl.t("page.settings.members.table.columns.actions")}
													</span>
												</Table.Column>
											</Table.Row>
										</Table.Header>
										<Table.Body>
											{members.map((member) => {
												let subject = subjectsById.get(member.subject_id);
												let memberIsOwner = member.subject_id === team.owner_id;
												let nextRole = member.role === "admin" ? "member" : "admin";
												let displayName = subject?.displayName ?? member.subject_id;
												let removeDialogId = `remove-member-${member.id}`;
												let removeDialogTitleId = `${removeDialogId}-title`;

												return (
													<Table.Row key={member.id}>
														<Table.Cell>
															<div mix={[hstack({ gap: 3, align: "center" })]}>
																<Avatar
																	src={subject?.avatar || null}
																	name={displayName}
																	size={40}
																/>
																<div mix={[vstack({ gap: 0.5 })]}>
																	<span mix={[weight("semibold")]}>{displayName}</span>
																	{subject && (
																		<a
																			href={`mailto:${subject.emailAddress}`}
																			mix={[
																				fontSize("0.8125rem"),
																				fg("neutral.muted"),
																				textDecoration("none"),
																				hover(textDecoration("underline")),
																			]}
																		>
																			{subject.emailAddress}
																		</a>
																	)}
																</div>
															</div>
														</Table.Cell>
														<Table.Cell mix={[textAlign("end")]}>
															{ctx.intl.t(
																`page.settings.members.table.role.${memberIsOwner ? "owner" : member.role}`,
															)}
														</Table.Cell>
														<Table.Cell mix={[textAlign("center")]}>
															{!memberIsOwner && (
																<>
																	<RowMenu
																		id={`member-menu-${member.id}`}
																		label={ctx.intl.t("page.settings.members.table.actions.menu")}
																	>
																		<form
																			method="post"
																			action={routes.teamAdminActions.member.changeRole.href({
																				team: team.slug,
																			})}
																		>
																			<input
																				type="hidden"
																				name="subject_id"
																				value={member.subject_id}
																			/>
																			<input type="hidden" name="role" value={nextRole} />
																			<button type="submit" mix={[menuItem]}>
																				<UserCogIcon size={16} strokeWidth={1.5} />
																				<span>
																					{ctx.intl.t(
																						`page.settings.members.table.actions.changeRole.${member.role}`,
																					)}
																				</span>
																			</button>
																		</form>

																		<button
																			type="button"
																			commandfor={removeDialogId}
																			command="show-modal"
																			mix={[menuItem, menuItemDanger]}
																		>
																			<UserMinusIcon size={16} strokeWidth={1.5} />
																			<span>
																				{ctx.intl.t("page.settings.members.table.actions.remove")}
																			</span>
																		</button>

																		{viewerIsOwner && member.role === "admin" && (
																			<>
																				<hr mix={[menuSeparator]} />
																				<button type="button" disabled mix={[menuItem]}>
																					<HandshakeIcon size={16} strokeWidth={1.5} />
																					<span>
																						{ctx.intl.t(
																							"page.settings.members.table.actions.transfer",
																						)}
																					</span>
																				</button>
																			</>
																		)}
																	</RowMenu>

																	<AlertDialog
																		id={removeDialogId}
																		aria-labelledby={removeDialogTitleId}
																	>
																		<AlertDialog.Header>
																			<AlertDialog.Title id={removeDialogTitleId}>
																				{ctx.intl.t(
																					"page.settings.members.table.confirmation.removeMember",
																					{ name: displayName },
																				)}
																			</AlertDialog.Title>
																		</AlertDialog.Header>
																		<form
																			method="post"
																			action={routes.teamAdminActions.member.remove.href({
																				team: team.slug,
																			})}
																		>
																			<input type="hidden" name="_method" value="DELETE" />
																			<input
																				type="hidden"
																				name="subject_id"
																				value={member.subject_id}
																			/>
																			<input
																				type="hidden"
																				name="email"
																				value={subject?.emailAddress ?? ""}
																			/>
																			<AlertDialog.Footer>
																				<AlertDialog.Cancel commandfor={removeDialogId}>
																					{ctx.intl.t("page.settings.form.actions.cancel")}
																				</AlertDialog.Cancel>
																				<AlertDialog.Action
																					type="submit"
																					commandfor={removeDialogId}
																				>
																					{ctx.intl.t("page.settings.members.table.actions.remove")}
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
							</div>

							<div mix={settingsCard()}>
								<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
									<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
										{ctx.intl.t("page.settings.members.invitedTable.label")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.members.invitedTable.description")}
									</p>
								</div>

								{pendingInvites.length === 0 ? (
									<div mix={[p(6)]}>
										<Empty>
											<Empty.Description>
												{ctx.intl.t("page.settings.members.invitedTable.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
								) : (
									<Table.Container>
										<Table aria-label={ctx.intl.t("page.settings.members.invitedTable.label")}>
											<Table.Header>
												<Table.Row>
													<Table.Column>
														{ctx.intl.t("page.settings.members.invitedTable.columns.email")}
													</Table.Column>
													<Table.Column align="end">
														{ctx.intl.t("page.settings.members.invitedTable.columns.expires")}
													</Table.Column>
													<Table.Column align="center">
														<span mix={[visuallyHidden()]}>
															{ctx.intl.t("page.settings.members.invitedTable.columns.actions")}
														</span>
													</Table.Column>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{pendingInvites.map((invite) => {
													let expiration = describeInviteExpiration(invite.created_at, ctx.locale);
													let revokeDialogId = `revoke-invite-${invite.id}`;
													let revokeDialogTitleId = `${revokeDialogId}-title`;

													return (
														<Table.Row key={invite.id}>
															<Table.Cell>{invite.email}</Table.Cell>
															<Table.Cell mix={[textAlign("end")]}>
																{expiration.isExpired ? (
																	<span mix={[fg("danger")]}>
																		{ctx.intl.t(
																			"page.settings.members.invitedTable.expires.expired",
																		)}
																	</span>
																) : (
																	<span>{expiration.text}</span>
																)}
															</Table.Cell>
															<Table.Cell mix={[textAlign("center")]}>
																<RowMenu
																	id={`invite-menu-${invite.id}`}
																	label={ctx.intl.t(
																		"page.settings.members.invitedTable.actions.menu",
																	)}
																>
																	<button
																		type="button"
																		commandfor={revokeDialogId}
																		command="show-modal"
																		mix={[menuItem, menuItemDanger]}
																	>
																		<UserMinusIcon size={16} strokeWidth={1.5} />
																		<span>
																			{ctx.intl.t(
																				"page.settings.members.invitedTable.actions.revoke",
																			)}
																		</span>
																	</button>
																</RowMenu>

																<AlertDialog
																	id={revokeDialogId}
																	aria-labelledby={revokeDialogTitleId}
																>
																	<AlertDialog.Header>
																		<AlertDialog.Title id={revokeDialogTitleId}>
																			{ctx.intl.t(
																				"page.settings.members.invitedTable.confirmation.revokeInvite",
																				{ email: invite.email },
																			)}
																		</AlertDialog.Title>
																	</AlertDialog.Header>
																	<form
																		method="post"
																		action={routes.teamAdminActions.invite.revoke.href({
																			team: team.slug,
																		})}
																	>
																		<input type="hidden" name="_method" value="DELETE" />
																		<input type="hidden" name="invite_id" value={invite.id} />
																		<AlertDialog.Footer>
																			<AlertDialog.Cancel commandfor={revokeDialogId}>
																				{ctx.intl.t("page.settings.form.actions.cancel")}
																			</AlertDialog.Cancel>
																			<AlertDialog.Action type="submit" commandfor={revokeDialogId}>
																				{ctx.intl.t(
																					"page.settings.members.invitedTable.actions.revoke",
																				)}
																			</AlertDialog.Action>
																		</AlertDialog.Footer>
																	</form>
																</AlertDialog>
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
							id="domains"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
									{ctx.intl.t("page.settings.domains.title")}
								</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.intl.t("page.settings.domains.description")}
								</p>
							</div>

							<dialog
								id="add-domain"
								mix={[
									is("full"),
									maxIs("min(440px, calc(100vw - 32px))"),
									p(6),
									boxSizing("border-box"),
									rounded("lg"),
									border({ color: "neutral", width: 1 }),
									bg("neutral.tint"),
									fg("neutral.emphasis"),
									when("&::backdrop", bg("rgba(0, 0, 0, 0.4)")),
								]}
							>
								<h3 mix={[m(0, 0, 4, 0), fontSize("base"), weight("semibold")]}>
									{ctx.intl.t("page.settings.domains.form.title")}
								</h3>
								<form
									method="post"
									action={routes.teamAdminActions.domain.add.href({ team: team.slug })}
								>
									<Field
										label={ctx.intl.t("page.settings.domains.form.fields.hostname.label")}
										description={ctx.intl.t(
											"page.settings.domains.form.fields.hostname.description",
											{ team: team.name },
										)}
									>
										<input
											type="text"
											name="hostname"
											required
											placeholder={ctx.intl.t(
												"page.settings.domains.form.fields.hostname.placeholder",
											)}
											mix={[textInput()]}
										/>
									</Field>
									<div mix={[hstack({ gap: 2, justify: "end" })]}>
										<Button type="button" variant="outline" commandfor="add-domain" command="close">
											{ctx.intl.t("page.settings.form.actions.cancel")}
										</Button>
										<Button type="submit">{ctx.intl.t("page.settings.domains.form.cta")}</Button>
									</div>
								</form>
							</dialog>

							<div mix={settingsCard()}>
								<div
									mix={[
										p(5, 6),
										borderEdge("block-end", { color: "neutral", width: 1 }),
										hstack({ gap: 4, align: "center", justify: "between" }),
									]}
								>
									<div>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.intl.t("page.settings.domains.table.label")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.intl.t("page.settings.domains.table.description")}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										commandfor="add-domain"
										command="show-modal"
										mix={[shrink()]}
									>
										<span>{ctx.intl.t("page.settings.domains.actions.addDomain")}</span>
									</Button>
								</div>

								{domains.length === 0 ? (
									<div mix={[p(6)]}>
										<Empty>
											<Empty.Description>
												{ctx.intl.t("page.settings.domains.table.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
								) : (
									<Table.Container
										mix={[
											when("&::after", [
												pseudoContent('""'),
												absolute(),
												insTop(0),
												insRight(0),
												insBottom(0),
												width("24px"),
												pointerEvents(),
												raw({ boxShadow: "inset -16px 0 12px -12px rgba(0, 0, 0, 0.18)" }),
												media(
													"(prefers-color-scheme: dark)",
													raw({ boxShadow: "inset -16px 0 12px -12px rgba(0, 0, 0, 0.6)" }),
												),
											]),
										]}
									>
										<Table aria-label={ctx.intl.t("page.settings.domains.table.label")}>
											<Table.Header>
												<Table.Row>
													<Table.Column mix={[nowrap(), minIs("200px")]}>
														{ctx.intl.t("page.settings.domains.table.columns.hostname")}
													</Table.Column>
													<Table.Column align="end">
														<span mix={hasPendingDomainVerification ? [] : [visuallyHidden()]}>
															{ctx.intl.t("page.settings.domains.table.columns.id")}
														</span>
													</Table.Column>
													<Table.Column align="end">
														{ctx.intl.t("page.settings.domains.table.columns.verifiedAt")}
													</Table.Column>
													<Table.Column align="center">
														<span mix={[visuallyHidden()]}>
															{ctx.intl.t("page.settings.domains.table.columns.actions")}
														</span>
													</Table.Column>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{domains.map((domain) => {
													let removeDialogId = `remove-domain-${domain.id}`;
													let removeDialogTitleId = `${removeDialogId}-title`;

													return (
														<Table.Row key={domain.id}>
															<Table.Cell mix={[nowrap()]}>{domain.hostname}</Table.Cell>
															<Table.Cell
																mix={[
																	textAlign("end"),
																	font("inherit"),
																	wordBreak("break-all"),
																	fontSize("xs"),
																	maxIs("140px"),
																]}
															>
																{domain.verified_at === null ? `ping_${domain.id}` : null}
															</Table.Cell>
															<Table.Cell mix={[textAlign("end")]}>
																{domain.verified_at !== null
																	? formatDate(new Date(domain.verified_at), {
																			locale: ctx.locale,
																			timeZone: "UTC",
																		})
																	: ctx.intl.t("page.settings.domains.table.verifiedAt.pending")}
															</Table.Cell>
															<Table.Cell mix={[textAlign("center")]}>
																<RowMenu
																	id={`domain-menu-${domain.id}`}
																	label={ctx.intl.t("page.settings.domains.table.actions.menu")}
																>
																	{domain.verified_at === null && (
																		<form
																			method="post"
																			action={routes.teamAdminActions.domain.retryVerification.href(
																				{
																					team: team.slug,
																				},
																			)}
																		>
																			<input type="hidden" name="domain_id" value={domain.id} />
																			<button type="submit" mix={[menuItem]}>
																				<RefreshCcwIcon size={16} strokeWidth={1.5} />
																				<span>
																					{ctx.intl.t(
																						"page.settings.domains.table.actions.retryVerification",
																					)}
																				</span>
																			</button>
																		</form>
																	)}

																	<button
																		type="button"
																		commandfor={removeDialogId}
																		command="show-modal"
																		mix={[menuItem, menuItemDanger]}
																	>
																		<BadgeMinusIcon size={16} strokeWidth={1.5} />
																		<span>
																			{ctx.intl.t("page.settings.domains.table.actions.remove")}
																		</span>
																	</button>
																</RowMenu>

																<AlertDialog
																	id={removeDialogId}
																	aria-labelledby={removeDialogTitleId}
																>
																	<AlertDialog.Header>
																		<AlertDialog.Title id={removeDialogTitleId}>
																			{ctx.intl.t(
																				"page.settings.domains.table.confirmation.removeDomain",
																				{ hostname: domain.hostname },
																			)}
																		</AlertDialog.Title>
																	</AlertDialog.Header>
																	<form
																		method="post"
																		action={routes.teamAdminActions.domain.remove.href({
																			team: team.slug,
																		})}
																	>
																		<input type="hidden" name="_method" value="DELETE" />
																		<input type="hidden" name="domain_id" value={domain.id} />
																		<AlertDialog.Footer>
																			<AlertDialog.Cancel commandfor={removeDialogId}>
																				{ctx.intl.t("page.settings.form.actions.cancel")}
																			</AlertDialog.Cancel>
																			<AlertDialog.Action type="submit" commandfor={removeDialogId}>
																				{ctx.intl.t("page.settings.domains.table.actions.remove")}
																			</AlertDialog.Action>
																		</AlertDialog.Footer>
																	</form>
																</AlertDialog>
															</Table.Cell>
														</Table.Row>
													);
												})}
											</Table.Body>
										</Table>
									</Table.Container>
								)}
							</div>

							{hasPendingDomainVerification && (
								<aside
									mix={[
										vstack({ gap: 2 }),
										rounded("xl"),
										border({ color: "neutral", width: 1 }),
										p(4),
										fontSize("sm"),
									]}
								>
									<h3 mix={[m(0), fontSize("1.0625rem"), weight("semibold")]}>
										{ctx.intl.t("page.settings.domains.instructions.title")}
									</h3>
									<p mix={[m(0)]}>{ctx.intl.t("page.settings.domains.instructions.description")}</p>
									<dl mix={[m(1, 0), vstack({ gap: 2 })]}>
										<div mix={[hstack({ gap: 2 })]}>
											<dt mix={[weight("semibold")]}>
												{ctx.intl.t("page.settings.domains.instructions.record.name.label")}
											</dt>
											<dd mix={[m(0)]}>
												<code>
													{ctx.intl.t("page.settings.domains.instructions.record.name.value")}
												</code>
											</dd>
										</div>
										<div mix={[hstack({ gap: 2 })]}>
											<dt mix={[weight("semibold")]}>
												{ctx.intl.t("page.settings.domains.instructions.record.content.label")}
											</dt>
											<dd mix={[m(0)]}>
												<code>
													{ctx.intl.t("page.settings.domains.instructions.record.content.value")}
												</code>
											</dd>
										</div>
									</dl>
									<p mix={[m(0)]}>
										<Trans
											intl={ctx.intl}
											i18nKey="page.settings.domains.instructions.note"
											components={{ code: <code /> }}
										/>
									</p>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.domains.instructions.disclaimer")}
									</p>
								</aside>
							)}
						</section>

						{viewerIsOwner && (
							<section
								id="billing"
								mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
							>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
										{ctx.intl.t("page.settings.billing.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.billing.description")}
									</p>
								</div>

								<div mix={settingsCard()}>
									<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.intl.t("page.settings.billing.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.intl.t("page.settings.billing.card.description")}
										</p>
									</div>

									<div mix={[p(6)]}>
										<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
											{ctx.intl.t("page.settings.billing.card.notice")}
										</p>
									</div>

									<div
										mix={[
											p(4, 6),
											borderEdge("block-start", { color: "neutral", width: 1 }),
											hstack({ justify: "end" }),
										]}
									>
										<LinkButton
											href={routes.app.team.checkout.href({ team: team.slug })}
											data-rmx-document=""
										>
											<span>{ctx.intl.t("page.settings.billing.card.cta")}</span>
											<ExternalLinkIcon size={16} strokeWidth={1.5} />
										</LinkButton>
									</div>
								</div>
							</section>
						)}

						{viewerIsOwner && (
							<section
								id="danger"
								mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
							>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold"), fg("danger")]}>
										{ctx.intl.t("page.settings.danger.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.intl.t("page.settings.danger.description")}
									</p>
								</div>

								<div mix={settingsCard("danger")}>
									<form
										method="post"
										action={routes.teamAdminActions.team.delete.href({ team: team.slug })}
									>
										<input type="hidden" name="_method" value="DELETE" />

										<div mix={[p(5, 6), borderEdge("block-end", { color: "danger", width: 1 })]}>
											<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold"), fg("danger")]}>
												{ctx.intl.t("page.settings.danger.card.title")}
											</h3>
											<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
												{ctx.intl.t("page.settings.danger.card.description")}
											</p>
										</div>

										<div mix={[p(6, 6, 0, 6), vstack({ gap: 4 })]}>
											<p mix={[m(0), fontSize("sm"), fg("danger")]}>
												{ctx.intl.t("page.settings.danger.card.warning")}
											</p>

											<Field label={ctx.intl.t("page.settings.danger.card.confirmation.label")}>
												<input
													type="text"
													name="confirmation"
													required
													autocomplete="off"
													pattern="DELETE"
													title={ctx.intl.t("page.settings.danger.card.confirmation.label")}
													placeholder={ctx.intl.t(
														"page.settings.danger.card.confirmation.placeholder",
													)}
													mix={[textInput()]}
												/>
											</Field>
										</div>

										<div
											mix={[
												p(4, 6),
												borderEdge("block-start", { color: "danger", width: 1 }),
												hstack({ justify: "end" }),
											]}
										>
											<Button type="submit" color="danger">
												{ctx.intl.t("page.settings.danger.card.cta")}
											</Button>
										</div>
									</form>
								</div>
							</section>
						)}
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
