/**
 * Team settings page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")` — only admins and the owner may view or manage settings.
 *
 * Renders the team settings page as a series of card-boxed sections (General, Members,
 * Domains, Billing, Danger Zone); every destructive action (remove member, revoke
 * invite, remove domain) is gated behind an `AlertDialog` confirmation. Billing and Danger
 * Zone are owner-only — an admin who isn't the owner never sees them. The danger-zone
 * delete button relies on the native `pattern="DELETE"` constraint (no client JS) to
 * stay disabled-in-effect until the confirmation input matches exactly. The Pending
 * Invitations and Verified Domains cards each swap their table for an `Empty` state
 * when their list has zero rows, instead of rendering a table with only a header row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

import { AuthSDK } from "@pkg/auth-sdk";
import {
	BadgeMinusIcon,
	ExternalLinkIcon,
	HandshakeIcon,
	RefreshCcwIcon,
	UserCogIcon,
	UserMinusIcon,
	UserPlusIcon,
} from "@pkg/lucide-remix";
import { AlertDialog, Button, Empty, LinkButton, Table } from "@pkg/r3-ui";
import { inject } from "@pkg/service-container";
import { visuallyHidden } from "@pkg/u/a11y";
import { bg, border, borderEdge, fg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { pointerEvents, pseudoContent, raw } from "@pkg/u/general";
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
} from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { is, maxIs, mi, minIs, p, m, width } from "@pkg/u/size";
import { hover, when } from "@pkg/u/state";
import {
	font,
	fontSize,
	nowrap,
	textAlign,
	textDecoration,
	weight,
	wordBreak,
} from "@pkg/u/typography";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import Invite from "~/app/data/invite";
import Team from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { resolveSubjects } from "~/app/services/subjects";
import Avatar from "~/resources/components/avatar";
import Field from "~/resources/components/field";
import RowMenu, { menuItem, menuItemDanger, menuSeparator } from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/** How many days a pending invite stays acceptable before it's shown as expired. */
const INVITE_EXPIRATION_DAYS = 7;

/** The moment a pending invite stops being acceptable, `INVITE_EXPIRATION_DAYS` after it was created. */
function getInviteExpirationDate(createdAt: number): Date {
	let expiresAt = new Date(createdAt);
	expiresAt.setDate(expiresAt.getDate() + INVITE_EXPIRATION_DAYS);
	return expiresAt;
}

/** A locale-formatted "in 3 days" description of `target` relative to now, or `isExpired: true` once it's past. */
function formatRelativeTime(target: Date, locale: string): { text: string; isExpired: boolean } {
	let diffMs = target.getTime() - Date.now();
	if (diffMs <= 0) return { text: "", isExpired: true };

	let rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
	let diffSeconds = Math.floor(diffMs / 1000);
	let diffMinutes = Math.floor(diffSeconds / 60);
	let diffHours = Math.floor(diffMinutes / 60);
	let diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) return { text: rtf.format(diffDays, "day"), isExpired: false };
	if (diffHours > 0) return { text: rtf.format(diffHours, "hour"), isExpired: false };
	if (diffMinutes > 0) return { text: rtf.format(diffMinutes, "minute"), isExpired: false };
	return { text: rtf.format(diffSeconds, "second"), isExpired: false };
}

/**
 * Splits a translated string containing exactly one `<code>...</code>` span into plain
 * text plus a `<code>` node, so the domain-verification note can render an inline code
 * fragment from locale copy without a raw-HTML sink.
 */
function renderInlineCode(text: string): RemixNode {
	let match = /^(.*)<code>(.*)<\/code>(.*)$/s.exec(text);
	if (!match) return text;
	let [, before, code, after] = match;
	return (
		<>
			{before}
			<code>{code}</code>
			{after}
		</>
	);
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

/** GET /app/:team/settings — team settings: general, members, domains, billing, danger zone. */
export default createAction(routes.app.team.settings, {
	middleware: [requireUser, requireTeam, requireRole("admin")],
	handler: inject([Database, AuthSDK] as const, async (db, authSdk) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [members, pendingInvites, domains] = await Promise.all([
			Team.listMembersByTeam(db, ctx.team.id),
			Invite.listPendingByTeam(db, ctx.team.id),
			TeamDomain.listByTeam(db, ctx.team.id),
		]);

		let subjectsById = await resolveSubjects(
			authSdk,
			members.map((member) => member.subject_id),
		);

		let team = ctx.team;
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
					heading={ctx.i18next.t("page.settings.header.title")}
				>
					<div mix={[vstack({ gap: 12 })]}>
						{/* General */}
						<section
							id="general"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
									{ctx.i18next.t("page.settings.sections.general.title")}
								</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.settings.sections.general.description")}
								</p>
							</div>

							<div mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow()]}>
								<form
									method="post"
									action={routes.teamAdminActions.team.update.href({ team: team.slug })}
								>
									<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.i18next.t("page.settings.form.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.settings.form.card.description")}
										</p>
									</div>

									<div
										mix={[
											// `Field`'s own trailing margin already spaces its last
											// instance from the footer below, so this region carries no
											// bottom padding of its own — otherwise the two would stack
											// into a gap far larger than every other card's footer rhythm.
											p(6, 6, 0, 6),
											vstack({ gap: 2 }),
										]}
									>
										<Field
											label={ctx.i18next.t("page.settings.form.fields.logo.label")}
											description={ctx.i18next.t("page.settings.form.fields.logo.description")}
										>
											<div mix={[hstack({ gap: 4, align: "center" })]}>
												<Avatar src={team.logo || null} name={team.name} size={48} />
												<input
													type="url"
													name="logo"
													defaultValue={team.logo ?? ""}
													placeholder={ctx.i18next.t("page.settings.form.fields.logo.placeholder")}
													mix={[textInput(), grow(), shrink(1), basis("0%")]}
												/>
											</div>
										</Field>

										<Field
											label={ctx.i18next.t("page.settings.form.fields.name.label")}
											description={ctx.i18next.t("page.settings.form.fields.name.description")}
										>
											<input
												type="text"
												name="name"
												required
												defaultValue={team.name}
												placeholder={ctx.i18next.t("page.settings.form.fields.name.placeholder")}
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
											{ctx.i18next.t("page.settings.form.actions.cancel")}
										</Button>
										<Button type="submit">
											{ctx.i18next.t("page.settings.form.actions.save")}
										</Button>
									</div>
								</form>
							</div>
						</section>

						{/* Members */}
						<section
							id="members"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[hstack({ gap: 4, align: "start", justify: "between" })]}>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
										{ctx.i18next.t("page.settings.members.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.members.description")}
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
									<span>{ctx.i18next.t("page.settings.members.actions.invite")}</span>
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
									{ctx.i18next.t("page.invite.header.title")}
								</h3>
								<form
									method="post"
									action={routes.teamAdminActions.invite.create.href({ team: team.slug })}
								>
									<Field label={ctx.i18next.t("page.invite.form.fields.email.label")}>
										<input
											type="email"
											name="email"
											required
											placeholder={ctx.i18next.t("page.invite.form.fields.email.placeholder")}
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
											{ctx.i18next.t("page.invite.form.cancel")}
										</Button>
										<Button type="submit">{ctx.i18next.t("page.invite.form.cta")}</Button>
									</div>
								</form>
							</dialog>

							<div mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow()]}>
								<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
									<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
										{ctx.i18next.t("page.settings.members.table.label")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.members.table.description")}
									</p>
								</div>

								<Table.Container>
									<Table aria-label={ctx.i18next.t("page.settings.members.table.label")}>
										<Table.Header>
											<Table.Row>
												<Table.Column>
													{ctx.i18next.t("page.settings.members.table.columns.name")}
												</Table.Column>
												<Table.Column align="end">
													{ctx.i18next.t("page.settings.members.table.columns.role")}
												</Table.Column>
												<Table.Column align="center">
													<span mix={[visuallyHidden()]}>
														{ctx.i18next.t("page.settings.members.table.columns.actions")}
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
															{ctx.i18next.t(
																`page.settings.members.table.role.${memberIsOwner ? "owner" : member.role}`,
															)}
														</Table.Cell>
														<Table.Cell mix={[textAlign("center")]}>
															{!memberIsOwner && (
																<>
																	<RowMenu
																		id={`member-menu-${member.id}`}
																		label={ctx.i18next.t(
																			"page.settings.members.table.actions.menu",
																		)}
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
																					{ctx.i18next.t(
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
																				{ctx.i18next.t(
																					"page.settings.members.table.actions.remove",
																				)}
																			</span>
																		</button>

																		{viewerIsOwner && member.role === "admin" && (
																			<>
																				<hr mix={[menuSeparator]} />
																				{/* Inert until a transfer-ownership action exists. */}
																				<button type="button" disabled mix={[menuItem]}>
																					<HandshakeIcon size={16} strokeWidth={1.5} />
																					<span>
																						{ctx.i18next.t(
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
																				{ctx.i18next.t(
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
																					{ctx.i18next.t("page.settings.form.actions.cancel")}
																				</AlertDialog.Cancel>
																				<AlertDialog.Action
																					type="submit"
																					commandfor={removeDialogId}
																				>
																					{ctx.i18next.t(
																						"page.settings.members.table.actions.remove",
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
							</div>

							<div mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow()]}>
								<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
									<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
										{ctx.i18next.t("page.settings.members.invitedTable.label")}
									</h3>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.members.invitedTable.description")}
									</p>
								</div>

								{pendingInvites.length === 0 ? (
									<div mix={[p(6)]}>
										<Empty>
											<Empty.Description>
												{ctx.i18next.t("page.settings.members.invitedTable.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
								) : (
									<Table.Container>
										<Table aria-label={ctx.i18next.t("page.settings.members.invitedTable.label")}>
											<Table.Header>
												<Table.Row>
													<Table.Column>
														{ctx.i18next.t("page.settings.members.invitedTable.columns.email")}
													</Table.Column>
													<Table.Column align="end">
														{ctx.i18next.t("page.settings.members.invitedTable.columns.expires")}
													</Table.Column>
													<Table.Column align="center">
														<span mix={[visuallyHidden()]}>
															{ctx.i18next.t("page.settings.members.invitedTable.columns.actions")}
														</span>
													</Table.Column>
												</Table.Row>
											</Table.Header>
											<Table.Body>
												{pendingInvites.map((invite) => {
													let expiration = formatRelativeTime(
														getInviteExpirationDate(invite.created_at),
														ctx.locale,
													);
													let revokeDialogId = `revoke-invite-${invite.id}`;
													let revokeDialogTitleId = `${revokeDialogId}-title`;

													return (
														<Table.Row key={invite.id}>
															<Table.Cell>{invite.email}</Table.Cell>
															<Table.Cell mix={[textAlign("end")]}>
																{expiration.isExpired ? (
																	<span mix={[fg("danger")]}>
																		{ctx.i18next.t(
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
																	label={ctx.i18next.t(
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
																			{ctx.i18next.t(
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
																			{ctx.i18next.t(
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
																				{ctx.i18next.t("page.settings.form.actions.cancel")}
																			</AlertDialog.Cancel>
																			<AlertDialog.Action type="submit" commandfor={revokeDialogId}>
																				{ctx.i18next.t(
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

						{/* Domains */}
						<section
							id="domains"
							mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
						>
							<div mix={[vstack({ gap: 1 })]}>
								<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
									{ctx.i18next.t("page.settings.domains.title")}
								</h2>
								<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
									{ctx.i18next.t("page.settings.domains.description")}
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
									{ctx.i18next.t("page.settings.domains.form.title")}
								</h3>
								<form
									method="post"
									action={routes.teamAdminActions.domain.add.href({ team: team.slug })}
								>
									<Field
										label={ctx.i18next.t("page.settings.domains.form.fields.hostname.label")}
										description={ctx.i18next.t(
											"page.settings.domains.form.fields.hostname.description",
											{ team: team.name },
										)}
									>
										<input
											type="text"
											name="hostname"
											required
											placeholder={ctx.i18next.t(
												"page.settings.domains.form.fields.hostname.placeholder",
											)}
											mix={[textInput()]}
										/>
									</Field>
									<div mix={[hstack({ gap: 2, justify: "end" })]}>
										<Button type="button" variant="outline" commandfor="add-domain" command="close">
											{ctx.i18next.t("page.settings.form.actions.cancel")}
										</Button>
										<Button type="submit">{ctx.i18next.t("page.settings.domains.form.cta")}</Button>
									</div>
								</form>
							</dialog>

							<div mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow()]}>
								<div
									mix={[
										p(5, 6),
										borderEdge("block-end", { color: "neutral", width: 1 }),
										hstack({ gap: 4, align: "center", justify: "between" }),
									]}
								>
									<div>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.i18next.t("page.settings.domains.table.label")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.settings.domains.table.description")}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										commandfor="add-domain"
										command="show-modal"
										mix={[shrink()]}
									>
										<span>{ctx.i18next.t("page.settings.domains.actions.addDomain")}</span>
									</Button>
								</div>

								{domains.length === 0 ? (
									<div mix={[p(6)]}>
										<Empty>
											<Empty.Description>
												{ctx.i18next.t("page.settings.domains.table.empty.description")}
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
										<Table aria-label={ctx.i18next.t("page.settings.domains.table.label")}>
											<Table.Header>
												<Table.Row>
													<Table.Column mix={[nowrap(), minIs("200px")]}>
														{ctx.i18next.t("page.settings.domains.table.columns.hostname")}
													</Table.Column>
													<Table.Column align="end">
														<span mix={hasPendingDomainVerification ? [] : [visuallyHidden()]}>
															{ctx.i18next.t("page.settings.domains.table.columns.id")}
														</span>
													</Table.Column>
													<Table.Column align="end">
														{ctx.i18next.t("page.settings.domains.table.columns.verifiedAt")}
													</Table.Column>
													<Table.Column align="center">
														<span mix={[visuallyHidden()]}>
															{ctx.i18next.t("page.settings.domains.table.columns.actions")}
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
																	? new Date(domain.verified_at).toLocaleDateString(ctx.locale)
																	: ctx.i18next.t("page.settings.domains.table.verifiedAt.pending")}
															</Table.Cell>
															<Table.Cell mix={[textAlign("center")]}>
																<RowMenu
																	id={`domain-menu-${domain.id}`}
																	label={ctx.i18next.t("page.settings.domains.table.actions.menu")}
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
																					{ctx.i18next.t(
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
																			{ctx.i18next.t("page.settings.domains.table.actions.remove")}
																		</span>
																	</button>
																</RowMenu>

																<AlertDialog
																	id={removeDialogId}
																	aria-labelledby={removeDialogTitleId}
																>
																	<AlertDialog.Header>
																		<AlertDialog.Title id={removeDialogTitleId}>
																			{ctx.i18next.t(
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
																				{ctx.i18next.t("page.settings.form.actions.cancel")}
																			</AlertDialog.Cancel>
																			<AlertDialog.Action type="submit" commandfor={removeDialogId}>
																				{ctx.i18next.t(
																					"page.settings.domains.table.actions.remove",
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
										{ctx.i18next.t("page.settings.domains.instructions.title")}
									</h3>
									<p mix={[m(0)]}>
										{ctx.i18next.t("page.settings.domains.instructions.description")}
									</p>
									<dl mix={[m(1, 0), vstack({ gap: 2 })]}>
										<div mix={[hstack({ gap: 2 })]}>
											<dt mix={[weight("semibold")]}>
												{ctx.i18next.t("page.settings.domains.instructions.record.name.label")}
											</dt>
											<dd mix={[m(0)]}>
												<code>
													{ctx.i18next.t("page.settings.domains.instructions.record.name.value")}
												</code>
											</dd>
										</div>
										<div mix={[hstack({ gap: 2 })]}>
											<dt mix={[weight("semibold")]}>
												{ctx.i18next.t("page.settings.domains.instructions.record.content.label")}
											</dt>
											<dd mix={[m(0)]}>
												<code>
													{ctx.i18next.t("page.settings.domains.instructions.record.content.value")}
												</code>
											</dd>
										</div>
									</dl>
									<p mix={[m(0)]}>
										{renderInlineCode(ctx.i18next.t("page.settings.domains.instructions.note"))}
									</p>
									<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.domains.instructions.disclaimer")}
									</p>
								</aside>
							)}
						</section>

						{/* Billing — owner only */}
						{viewerIsOwner && (
							<section
								id="billing"
								mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
							>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold")]}>
										{ctx.i18next.t("page.settings.billing.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.billing.description")}
									</p>
								</div>

								<div mix={[rounded("xl"), border({ color: "neutral", width: 1 }), overflow()]}>
									<div mix={[p(5, 6), borderEdge("block-end", { color: "neutral", width: 1 })]}>
										<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold")]}>
											{ctx.i18next.t("page.settings.billing.card.title")}
										</h3>
										<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.settings.billing.card.description")}
										</p>
									</div>

									<div mix={[p(6)]}>
										<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
											{ctx.i18next.t("page.settings.billing.card.notice")}
										</p>
									</div>

									<div
										mix={[
											p(4, 6),
											borderEdge("block-start", { color: "neutral", width: 1 }),
											hstack({ justify: "end" }),
										]}
									>
										<LinkButton href={routes.app.team.checkout.href({ team: team.slug })}>
											<span>{ctx.i18next.t("page.settings.billing.card.cta")}</span>
											<ExternalLinkIcon size={16} strokeWidth={1.5} />
										</LinkButton>
									</div>
								</div>
							</section>
						)}

						{/* Danger Zone — owner only */}
						{viewerIsOwner && (
							<section
								id="danger"
								mix={[is("full"), maxIs("640px"), mi("auto"), vstack({ gap: 6 })]}
							>
								<div mix={[vstack({ gap: 1 })]}>
									<h2 mix={[m(0), fontSize("xl"), weight("semibold"), fg("danger")]}>
										{ctx.i18next.t("page.settings.danger.title")}
									</h2>
									<p mix={[m(0), fontSize("sm"), fg("neutral.muted")]}>
										{ctx.i18next.t("page.settings.danger.description")}
									</p>
								</div>

								<div mix={[rounded("xl"), border({ color: "danger", width: 1 }), overflow()]}>
									<form
										method="post"
										action={routes.teamAdminActions.team.delete.href({ team: team.slug })}
									>
										<input type="hidden" name="_method" value="DELETE" />

										<div mix={[p(5, 6), borderEdge("block-end", { color: "danger", width: 1 })]}>
											<h3 mix={[m(0, 0, 1, 0), fontSize("base"), weight("semibold"), fg("danger")]}>
												{ctx.i18next.t("page.settings.danger.card.title")}
											</h3>
											<p mix={[m(0), fontSize("0.8125rem"), fg("neutral.muted")]}>
												{ctx.i18next.t("page.settings.danger.card.description")}
											</p>
										</div>

										<div
											mix={[
												// `Field`'s own trailing margin already spaces the
												// confirmation input from the footer below, so this region
												// carries no bottom padding of its own — otherwise the two
												// would stack into a gap far larger than every other card's
												// footer rhythm.
												p(6, 6, 0, 6),
												vstack({ gap: 4 }),
											]}
										>
											<p mix={[m(0), fontSize("sm"), fg("danger")]}>
												{ctx.i18next.t("page.settings.danger.card.warning")}
											</p>

											<Field label={ctx.i18next.t("page.settings.danger.card.confirmation.label")}>
												<input
													type="text"
													name="confirmation"
													required
													autocomplete="off"
													pattern="DELETE"
													title={ctx.i18next.t("page.settings.danger.card.confirmation.label")}
													placeholder={ctx.i18next.t(
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
												{ctx.i18next.t("page.settings.danger.card.cta")}
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
	}),
});
