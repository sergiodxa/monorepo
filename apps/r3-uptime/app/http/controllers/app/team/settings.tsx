/**
 * Team settings page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")` — only admins and the owner may view or manage settings.
 *
 * Renders the team settings page as a series of card-boxed sections (General, Members,
 * Domains, Billing, Danger Zone); every destructive action (remove member, revoke
 * invite, remove domain) is gated behind a `<dialog>` confirmation. Billing and Danger
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
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Invite from "~/app/data/invite";
import Team from "~/app/data/team";
import TeamDomain from "~/app/data/team-domain";
import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { resolveSubjects } from "~/app/services/subjects";
import Avatar from "~/resources/components/avatar";
import Button from "~/resources/components/button";
import Empty from "~/resources/components/empty";
import Field from "~/resources/components/field";
import LinkButton from "~/resources/components/link-button";
import RowMenu, { menuItem, menuItemDanger, menuSeparator } from "~/resources/components/row-menu";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { danger, neutral } from "~/resources/theme";
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
	return css({
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
	});
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
					<div mix={[css({ display: "flex", flexDirection: "column", gap: 48 })]}>
						{/* General */}
						<section
							id="general"
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
									{ctx.i18next.t("page.settings.sections.general.title")}
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
									{ctx.i18next.t("page.settings.sections.general.description")}
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
								<form
									method="post"
									action={routes.teamAdminActions.team.update.href({ team: team.slug })}
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
											{ctx.i18next.t("page.settings.form.card.title")}
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
											{ctx.i18next.t("page.settings.form.card.description")}
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
											label={ctx.i18next.t("page.settings.form.fields.logo.label")}
											description={ctx.i18next.t("page.settings.form.fields.logo.description")}
										>
											<div mix={[css({ display: "flex", alignItems: "center", gap: 16 })]}>
												<Avatar src={team.logo || null} name={team.name} size={48} />
												<input
													type="url"
													name="logo"
													defaultValue={team.logo ?? ""}
													placeholder={ctx.i18next.t("page.settings.form.fields.logo.placeholder")}
													mix={[textInput(), css({ flex: 1 })]}
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
										{ctx.i18next.t("page.settings.members.title")}
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
										{ctx.i18next.t("page.settings.members.description")}
									</p>
								</div>
								<Button
									type="button"
									variant="outline"
									commandfor="invite-member"
									command="show-modal"
									mix={[css({ flexShrink: 0 })]}
								>
									<UserPlusIcon size={16} strokeWidth={1.5} />
									<span>{ctx.i18next.t("page.settings.members.actions.invite")}</span>
								</Button>
							</div>

							<dialog
								id="invite-member"
								mix={[
									css({
										width: "100%",
										maxWidth: "min(440px, calc(100vw - 32px))",
										padding: 24,
										boxSizing: "border-box",
										borderRadius: 8,
										border: `1px solid ${neutral[300]}`,
										"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
											color: neutral[50],
										},
									}),
								]}
							>
								<h3 mix={[css({ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 })]}>
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
									<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
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
										{ctx.i18next.t("page.settings.members.table.label")}
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
										{ctx.i18next.t("page.settings.members.table.description")}
									</p>
								</div>

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
												"& tr:last-child td": { borderBottom: "none" },
												"@media (prefers-color-scheme: dark)": {
													"& th, & td": { borderColor: neutral[800] },
												},
											}),
										]}
									>
										<thead>
											<tr>
												<th>{ctx.i18next.t("page.settings.members.table.columns.name")}</th>
												<th mix={[css({ textAlign: "right" })]}>
													{ctx.i18next.t("page.settings.members.table.columns.role")}
												</th>
												<th mix={[css({ textAlign: "center" })]}>
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
														{ctx.i18next.t("page.settings.members.table.columns.actions")}
													</span>
												</th>
											</tr>
										</thead>
										<tbody>
											{members.map((member) => {
												let subject = subjectsById.get(member.subject_id);
												let memberIsOwner = member.subject_id === team.owner_id;
												let nextRole = member.role === "admin" ? "member" : "admin";
												let displayName = subject?.displayName ?? member.subject_id;

												return (
													<tr key={member.id}>
														<td>
															<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
																<Avatar
																	src={subject?.avatar || null}
																	name={displayName}
																	size={40}
																/>
																<div
																	mix={[css({ display: "flex", flexDirection: "column", gap: 2 })]}
																>
																	<span mix={[css({ fontWeight: 600 })]}>{displayName}</span>
																	{subject && (
																		<a
																			href={`mailto:${subject.emailAddress}`}
																			mix={[
																				css({
																					fontSize: "0.8125rem",
																					color: neutral[500],
																					textDecoration: "none",
																					"&:hover": { textDecoration: "underline" },
																					"@media (prefers-color-scheme: dark)": {
																						color: neutral[400],
																					},
																				}),
																			]}
																		>
																			{subject.emailAddress}
																		</a>
																	)}
																</div>
															</div>
														</td>
														<td mix={[css({ textAlign: "right" })]}>
															{ctx.i18next.t(
																`page.settings.members.table.role.${memberIsOwner ? "owner" : member.role}`,
															)}
														</td>
														<td mix={[css({ textAlign: "center" })]}>
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
																			commandfor={`remove-member-${member.id}`}
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

																	<dialog
																		id={`remove-member-${member.id}`}
																		mix={[
																			css({
																				width: "100%",
																				maxWidth: "min(440px, calc(100vw - 32px))",
																				padding: 24,
																				boxSizing: "border-box",
																				borderRadius: 8,
																				border: `1px solid ${neutral[300]}`,
																				"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
																				"@media (prefers-color-scheme: dark)": {
																					borderColor: neutral[700],
																					background: neutral[900],
																					color: neutral[50],
																				},
																			}),
																		]}
																	>
																		<h3
																			mix={[
																				css({
																					margin: "0 0 16px",
																					fontSize: "1rem",
																					fontWeight: 600,
																				}),
																			]}
																		>
																			{ctx.i18next.t(
																				"page.settings.members.table.confirmation.removeMember",
																				{ name: displayName },
																			)}
																		</h3>
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
																			<div
																				mix={[
																					css({
																						display: "flex",
																						gap: 8,
																						justifyContent: "flex-end",
																					}),
																				]}
																			>
																				<Button
																					type="button"
																					variant="outline"
																					commandfor={`remove-member-${member.id}`}
																					command="close"
																				>
																					{ctx.i18next.t("page.settings.form.actions.cancel")}
																				</Button>
																				<Button type="submit" color="danger">
																					{ctx.i18next.t(
																						"page.settings.members.table.actions.remove",
																					)}
																				</Button>
																			</div>
																		</form>
																	</dialog>
																</>
															)}
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
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
										{ctx.i18next.t("page.settings.members.invitedTable.label")}
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
										{ctx.i18next.t("page.settings.members.invitedTable.description")}
									</p>
								</div>

								{pendingInvites.length === 0 ? (
									<div mix={[css({ padding: 24 })]}>
										<Empty>
											<Empty.Description>
												{ctx.i18next.t("page.settings.members.invitedTable.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
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
													"& tr:last-child td": { borderBottom: "none" },
													"@media (prefers-color-scheme: dark)": {
														"& th, & td": { borderColor: neutral[800] },
													},
												}),
											]}
										>
											<thead>
												<tr>
													<th>
														{ctx.i18next.t("page.settings.members.invitedTable.columns.email")}
													</th>
													<th mix={[css({ textAlign: "right" })]}>
														{ctx.i18next.t("page.settings.members.invitedTable.columns.expires")}
													</th>
													<th mix={[css({ textAlign: "center" })]}>
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
															{ctx.i18next.t("page.settings.members.invitedTable.columns.actions")}
														</span>
													</th>
												</tr>
											</thead>
											<tbody>
												{pendingInvites.map((invite) => {
													let expiration = formatRelativeTime(
														getInviteExpirationDate(invite.created_at),
														ctx.locale,
													);

													return (
														<tr key={invite.id}>
															<td>{invite.email}</td>
															<td mix={[css({ textAlign: "right" })]}>
																{expiration.isExpired ? (
																	<span mix={[css({ color: danger[600] })]}>
																		{ctx.i18next.t(
																			"page.settings.members.invitedTable.expires.expired",
																		)}
																	</span>
																) : (
																	<span>{expiration.text}</span>
																)}
															</td>
															<td mix={[css({ textAlign: "center" })]}>
																<RowMenu
																	id={`invite-menu-${invite.id}`}
																	label={ctx.i18next.t(
																		"page.settings.members.invitedTable.actions.menu",
																	)}
																>
																	<button
																		type="button"
																		commandfor={`revoke-invite-${invite.id}`}
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

																<dialog
																	id={`revoke-invite-${invite.id}`}
																	mix={[
																		css({
																			width: "100%",
																			maxWidth: "min(440px, calc(100vw - 32px))",
																			padding: 24,
																			boxSizing: "border-box",
																			borderRadius: 8,
																			border: `1px solid ${neutral[300]}`,
																			"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
																			"@media (prefers-color-scheme: dark)": {
																				borderColor: neutral[700],
																				background: neutral[900],
																				color: neutral[50],
																			},
																		}),
																	]}
																>
																	<h3
																		mix={[
																			css({
																				margin: "0 0 16px",
																				fontSize: "1rem",
																				fontWeight: 600,
																			}),
																		]}
																	>
																		{ctx.i18next.t(
																			"page.settings.members.invitedTable.confirmation.revokeInvite",
																			{ email: invite.email },
																		)}
																	</h3>
																	<form
																		method="post"
																		action={routes.teamAdminActions.invite.revoke.href({
																			team: team.slug,
																		})}
																	>
																		<input type="hidden" name="_method" value="DELETE" />
																		<input type="hidden" name="invite_id" value={invite.id} />
																		<div
																			mix={[
																				css({
																					display: "flex",
																					gap: 8,
																					justifyContent: "flex-end",
																				}),
																			]}
																		>
																			<Button
																				type="button"
																				variant="outline"
																				commandfor={`revoke-invite-${invite.id}`}
																				command="close"
																			>
																				{ctx.i18next.t("page.settings.form.actions.cancel")}
																			</Button>
																			<Button type="submit" color="danger">
																				{ctx.i18next.t(
																					"page.settings.members.invitedTable.actions.revoke",
																				)}
																			</Button>
																		</div>
																	</form>
																</dialog>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</section>

						{/* Domains */}
						<section
							id="domains"
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
									{ctx.i18next.t("page.settings.domains.title")}
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
									{ctx.i18next.t("page.settings.domains.description")}
								</p>
							</div>

							<dialog
								id="add-domain"
								mix={[
									css({
										width: "100%",
										maxWidth: "min(440px, calc(100vw - 32px))",
										padding: 24,
										boxSizing: "border-box",
										borderRadius: 8,
										border: `1px solid ${neutral[300]}`,
										"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
										"@media (prefers-color-scheme: dark)": {
											borderColor: neutral[700],
											background: neutral[900],
											color: neutral[50],
										},
									}),
								]}
							>
								<h3 mix={[css({ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 })]}>
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
									<div mix={[css({ display: "flex", gap: 8, justifyContent: "flex-end" })]}>
										<Button type="button" variant="outline" commandfor="add-domain" command="close">
											{ctx.i18next.t("page.settings.form.actions.cancel")}
										</Button>
										<Button type="submit">{ctx.i18next.t("page.settings.domains.form.cta")}</Button>
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
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											gap: 16,
											"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
										}),
									]}
								>
									<div>
										<h3 mix={[css({ margin: "0 0 4px", fontSize: "1rem", fontWeight: 600 })]}>
											{ctx.i18next.t("page.settings.domains.table.label")}
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
											{ctx.i18next.t("page.settings.domains.table.description")}
										</p>
									</div>
									<Button
										type="button"
										variant="outline"
										commandfor="add-domain"
										command="show-modal"
										mix={[css({ flexShrink: 0 })]}
									>
										<span>{ctx.i18next.t("page.settings.domains.actions.addDomain")}</span>
									</Button>
								</div>

								{domains.length === 0 ? (
									<div mix={[css({ padding: 24 })]}>
										<Empty>
											<Empty.Description>
												{ctx.i18next.t("page.settings.domains.table.empty.description")}
											</Empty.Description>
										</Empty>
									</div>
								) : (
									<div
										mix={[
											css({
												position: "relative",
												overflowX: "auto",
												"&::after": {
													content: '""',
													position: "absolute",
													top: 0,
													right: 0,
													bottom: 0,
													width: 24,
													pointerEvents: "none",
													boxShadow: `inset -16px 0 12px -12px rgba(0, 0, 0, 0.18)`,
													"@media (prefers-color-scheme: dark)": {
														boxShadow: `inset -16px 0 12px -12px rgba(0, 0, 0, 0.6)`,
													},
												},
											}),
										]}
									>
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
													"& tr:last-child td": { borderBottom: "none" },
													"@media (prefers-color-scheme: dark)": {
														"& th, & td": { borderColor: neutral[800] },
													},
												}),
											]}
										>
											<thead>
												<tr>
													<th mix={[css({ whiteSpace: "nowrap", minWidth: 200 })]}>
														{ctx.i18next.t("page.settings.domains.table.columns.hostname")}
													</th>
													<th mix={[css({ textAlign: "right" })]}>
														<span
															mix={
																hasPendingDomainVerification
																	? []
																	: [
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
																		]
															}
														>
															{ctx.i18next.t("page.settings.domains.table.columns.id")}
														</span>
													</th>
													<th mix={[css({ textAlign: "right" })]}>
														{ctx.i18next.t("page.settings.domains.table.columns.verifiedAt")}
													</th>
													<th mix={[css({ textAlign: "center" })]}>
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
															{ctx.i18next.t("page.settings.domains.table.columns.actions")}
														</span>
													</th>
												</tr>
											</thead>
											<tbody>
												{domains.map((domain) => (
													<tr key={domain.id}>
														<td mix={[css({ whiteSpace: "nowrap" })]}>{domain.hostname}</td>
														<td
															mix={[
																css({
																	textAlign: "right",
																	fontFamily: "inherit",
																	fontSize: "0.75rem",
																	maxWidth: 140,
																	wordBreak: "break-all",
																}),
															]}
														>
															{domain.verified_at === null ? `ping_${domain.id}` : null}
														</td>
														<td mix={[css({ textAlign: "right" })]}>
															{domain.verified_at !== null
																? new Date(domain.verified_at).toLocaleDateString(ctx.locale)
																: ctx.i18next.t("page.settings.domains.table.verifiedAt.pending")}
														</td>
														<td mix={[css({ textAlign: "center" })]}>
															<RowMenu
																id={`domain-menu-${domain.id}`}
																label={ctx.i18next.t("page.settings.domains.table.actions.menu")}
															>
																{domain.verified_at === null && (
																	<form
																		method="post"
																		action={routes.teamAdminActions.domain.retryVerification.href({
																			team: team.slug,
																		})}
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
																	commandfor={`remove-domain-${domain.id}`}
																	command="show-modal"
																	mix={[menuItem, menuItemDanger]}
																>
																	<BadgeMinusIcon size={16} strokeWidth={1.5} />
																	<span>
																		{ctx.i18next.t("page.settings.domains.table.actions.remove")}
																	</span>
																</button>
															</RowMenu>

															<dialog
																id={`remove-domain-${domain.id}`}
																mix={[
																	css({
																		width: "100%",
																		maxWidth: "min(440px, calc(100vw - 32px))",
																		padding: 24,
																		boxSizing: "border-box",
																		borderRadius: 8,
																		border: `1px solid ${neutral[300]}`,
																		"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
																		"@media (prefers-color-scheme: dark)": {
																			borderColor: neutral[700],
																			background: neutral[900],
																			color: neutral[50],
																		},
																	}),
																]}
															>
																<h3
																	mix={[
																		css({ margin: "0 0 16px", fontSize: "1rem", fontWeight: 600 }),
																	]}
																>
																	{ctx.i18next.t(
																		"page.settings.domains.table.confirmation.removeDomain",
																		{ hostname: domain.hostname },
																	)}
																</h3>
																<form
																	method="post"
																	action={routes.teamAdminActions.domain.remove.href({
																		team: team.slug,
																	})}
																>
																	<input type="hidden" name="_method" value="DELETE" />
																	<input type="hidden" name="domain_id" value={domain.id} />
																	<div
																		mix={[
																			css({
																				display: "flex",
																				gap: 8,
																				justifyContent: "flex-end",
																			}),
																		]}
																	>
																		<Button
																			type="button"
																			variant="outline"
																			commandfor={`remove-domain-${domain.id}`}
																			command="close"
																		>
																			{ctx.i18next.t("page.settings.form.actions.cancel")}
																		</Button>
																		<Button type="submit" color="danger">
																			{ctx.i18next.t("page.settings.domains.table.actions.remove")}
																		</Button>
																	</div>
																</form>
															</dialog>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>

							{hasPendingDomainVerification && (
								<aside
									mix={[
										css({
											display: "flex",
											flexDirection: "column",
											gap: 8,
											borderRadius: 12,
											border: `1px solid ${neutral[300]}`,
											padding: 16,
											fontSize: "0.875rem",
											"@media (prefers-color-scheme: dark)": { borderColor: neutral[700] },
										}),
									]}
								>
									<h3 mix={[css({ margin: 0, fontSize: "1.0625rem", fontWeight: 600 })]}>
										{ctx.i18next.t("page.settings.domains.instructions.title")}
									</h3>
									<p mix={[css({ margin: 0 })]}>
										{ctx.i18next.t("page.settings.domains.instructions.description")}
									</p>
									<dl
										mix={[
											css({ margin: "4px 0", display: "flex", flexDirection: "column", gap: 8 }),
										]}
									>
										<div mix={[css({ display: "flex", gap: 8 })]}>
											<dt mix={[css({ fontWeight: 600 })]}>
												{ctx.i18next.t("page.settings.domains.instructions.record.name.label")}
											</dt>
											<dd mix={[css({ margin: 0 })]}>
												<code>
													{ctx.i18next.t("page.settings.domains.instructions.record.name.value")}
												</code>
											</dd>
										</div>
										<div mix={[css({ display: "flex", gap: 8 })]}>
											<dt mix={[css({ fontWeight: 600 })]}>
												{ctx.i18next.t("page.settings.domains.instructions.record.content.label")}
											</dt>
											<dd mix={[css({ margin: 0 })]}>
												<code>
													{ctx.i18next.t("page.settings.domains.instructions.record.content.value")}
												</code>
											</dd>
										</div>
									</dl>
									<p mix={[css({ margin: 0 })]}>
										{renderInlineCode(ctx.i18next.t("page.settings.domains.instructions.note"))}
									</p>
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
										{ctx.i18next.t("page.settings.domains.instructions.disclaimer")}
									</p>
								</aside>
							)}
						</section>

						{/* Billing — owner only */}
						{viewerIsOwner && (
							<section
								id="billing"
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
										{ctx.i18next.t("page.settings.billing.title")}
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
										{ctx.i18next.t("page.settings.billing.description")}
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
											{ctx.i18next.t("page.settings.billing.card.title")}
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
											{ctx.i18next.t("page.settings.billing.card.description")}
										</p>
									</div>

									<div mix={[css({ padding: 24 })]}>
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
											{ctx.i18next.t("page.settings.billing.card.notice")}
										</p>
									</div>

									<div
										mix={[
											css({
												padding: "16px 24px",
												borderTop: `1px solid ${neutral[200]}`,
												display: "flex",
												justifyContent: "flex-end",
												"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
											}),
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
									<h2
										mix={[
											css({
												margin: 0,
												fontSize: "1.25rem",
												fontWeight: 600,
												color: danger[600],
											}),
										]}
									>
										{ctx.i18next.t("page.settings.danger.title")}
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
										{ctx.i18next.t("page.settings.danger.description")}
									</p>
								</div>

								<div
									mix={[
										css({
											borderRadius: 12,
											border: `1px solid ${danger[600]}`,
											overflow: "hidden",
										}),
									]}
								>
									<form
										method="post"
										action={routes.teamAdminActions.team.delete.href({ team: team.slug })}
									>
										<input type="hidden" name="_method" value="DELETE" />

										<div
											mix={[
												css({
													padding: "20px 24px",
													borderBottom: `1px solid ${danger[600]}`,
												}),
											]}
										>
											<h3
												mix={[
													css({
														margin: "0 0 4px",
														fontSize: "1rem",
														fontWeight: 600,
														color: danger[600],
													}),
												]}
											>
												{ctx.i18next.t("page.settings.danger.card.title")}
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
												{ctx.i18next.t("page.settings.danger.card.description")}
											</p>
										</div>

										<div
											mix={[
												css({
													// `Field`'s own trailing margin already spaces the
													// confirmation input from the footer below, so this region
													// carries no bottom padding of its own — otherwise the two
													// would stack into a gap far larger than every other card's
													// footer rhythm.
													padding: "24px 24px 0",
													display: "flex",
													flexDirection: "column",
													gap: 16,
												}),
											]}
										>
											<p mix={[css({ margin: 0, fontSize: "0.875rem", color: danger[600] })]}>
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
												css({
													padding: "16px 24px",
													borderTop: `1px solid ${danger[600]}`,
													display: "flex",
													justifyContent: "flex-end",
												}),
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
