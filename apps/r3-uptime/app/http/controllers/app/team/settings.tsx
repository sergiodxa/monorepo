/**
 * Team settings page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")` — only admins and the owner may view or manage settings.
 *
 * Renders the team settings page; every destructive action (remove member, delete
 * team) is gated behind a `<dialog>` confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { AuthSDK } from "@pkg/auth-sdk";
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
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { primary } from "~/resources/theme";
import routes from "~/routes/web";

const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
} as const;

/** GET /app/:team/settings — team settings: general, members, domains, danger zone. */
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
					<div>
						<h2>{ctx.i18next.t("page.settings.sections.general.title")}</h2>
						<form
							method="post"
							action={routes.teamAdminActions.team.update.href({ team: team.slug })}
						>
							<Field label={ctx.i18next.t("page.settings.form.fields.name.label")}>
								<input
									type="text"
									name="name"
									required
									defaultValue={team.name}
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
							<Field label={ctx.i18next.t("page.settings.form.fields.logo.label")}>
								<input
									type="url"
									name="logo"
									defaultValue={team.logo ?? ""}
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
							<Button type="submit">{ctx.i18next.t("page.settings.form.actions.save")}</Button>
						</form>

						<h2>{ctx.i18next.t("page.settings.members.title")}</h2>
						<Button type="button" variant="outline" commandfor="invite-member" command="show-modal">
							{ctx.i18next.t("page.settings.members.actions.invite")}
						</Button>
						<dialog
							id="invite-member"
							mix={[
								css({
									padding: 24,
									borderRadius: 8,
									border: `1px solid ${neutral[300]}`,
									maxWidth: 400,
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
							<h3>{ctx.i18next.t("page.invite.header.title")}</h3>
							<form
								method="post"
								action={routes.teamAdminActions.invite.create.href({ team: team.slug })}
							>
								<Field label={ctx.i18next.t("page.invite.form.fields.email.label")}>
									<input
										type="email"
										name="email"
										required
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
										commandfor="invite-member"
										command="close"
									>
										{ctx.i18next.t("page.invite.form.cancel")}
									</Button>
									<Button type="submit">{ctx.i18next.t("page.invite.form.cta")}</Button>
								</div>
							</form>
						</dialog>

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
										<th>{ctx.i18next.t("page.settings.members.table.columns.name")}</th>
										<th>{ctx.i18next.t("page.settings.members.table.columns.role")}</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{members.map((member) => {
										let subject = subjectsById.get(member.subject_id);
										let isOwner = member.subject_id === team.owner_id;
										let nextRole = member.role === "admin" ? "member" : "admin";

										return (
											<tr key={member.id}>
												<td>
													{subject
														? `${subject.displayName} (${subject.emailAddress})`
														: member.subject_id}
												</td>
												<td>
													<Badge tone={isOwner ? "up" : "neutral"}>
														{ctx.i18next.t(
															`page.settings.members.table.role.${isOwner ? "owner" : member.role}`,
														)}
													</Badge>
												</td>
												<td>
													{!isOwner && (
														<>
															<form
																method="post"
																action={routes.teamAdminActions.member.changeRole.href({
																	team: team.slug,
																})}
															>
																<input type="hidden" name="subject_id" value={member.subject_id} />
																<input type="hidden" name="role" value={nextRole} />
																<Button type="submit" variant="outline">
																	{ctx.i18next.t(
																		`page.settings.members.table.actions.changeRole.${member.role}`,
																	)}
																</Button>
															</form>
															<Button
																type="button"
																color="danger"
																commandfor={`remove-member-${member.id}`}
																command="show-modal"
															>
																{ctx.i18next.t("page.settings.members.table.actions.remove")}
															</Button>
															<dialog
																id={`remove-member-${member.id}`}
																mix={[
																	css({
																		padding: 24,
																		borderRadius: 8,
																		border: `1px solid ${neutral[300]}`,
																		maxWidth: 400,
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
																<h3>
																	{ctx.i18next.t(
																		"page.settings.members.table.confirmation.removeMember",
																		{ name: subject?.displayName ?? member.subject_id },
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
																			css({ display: "flex", gap: 8, justifyContent: "flex-end" }),
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
																			{ctx.i18next.t("page.settings.members.table.actions.remove")}
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

						{pendingInvites.length > 0 && (
							<>
								<h3>{ctx.i18next.t("page.settings.members.invitedTable.label")}</h3>
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
												<th>{ctx.i18next.t("page.settings.members.invitedTable.columns.email")}</th>
												<th>Invited</th>
												<th></th>
											</tr>
										</thead>
										<tbody>
											{pendingInvites.map((invite) => (
												<tr key={invite.id}>
													<td>{invite.email}</td>
													<td>{new Date(invite.created_at).toLocaleDateString()}</td>
													<td>
														<form
															method="post"
															action={routes.teamAdminActions.invite.revoke.href({
																team: team.slug,
															})}
														>
															<input type="hidden" name="_method" value="DELETE" />
															<input type="hidden" name="invite_id" value={invite.id} />
															<Button type="submit" variant="outline">
																{ctx.i18next.t("page.settings.members.invitedTable.actions.revoke")}
															</Button>
														</form>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</>
						)}

						<h2>{ctx.i18next.t("page.settings.domains.title")}</h2>
						<p
							mix={[
								css({
									fontSize: "0.8125rem",
									color: neutral[500],
									"@media (prefers-color-scheme: dark)": {
										color: neutral[400],
									},
								}),
							]}
						>
							{ctx.i18next.t("page.settings.domains.description")}
						</p>
						<form
							method="post"
							action={routes.teamAdminActions.domain.add.href({ team: team.slug })}
						>
							<Field label={ctx.i18next.t("page.settings.domains.form.fields.hostname.label")}>
								<input
									type="text"
									name="hostname"
									required
									placeholder={ctx.i18next.t(
										"page.settings.domains.form.fields.hostname.placeholder",
									)}
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
							<Button type="submit" variant="outline">
								{ctx.i18next.t("page.settings.domains.form.cta")}
							</Button>
						</form>

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
										<th>{ctx.i18next.t("page.settings.domains.table.columns.hostname")}</th>
										<th>Status</th>
										<th></th>
									</tr>
								</thead>
								<tbody>
									{domains.map((domain) => (
										<tr key={domain.id}>
											<td>{domain.hostname}</td>
											<td>
												{domain.verified_at !== null ? (
													<Badge tone="up">verified</Badge>
												) : (
													<>
														<Badge tone="neutral">
															{ctx.i18next.t("page.settings.domains.table.verifiedAt.pending")}
														</Badge>
														<p
															mix={[
																css({
																	fontSize: "0.8125rem",
																	color: neutral[500],
																	"@media (prefers-color-scheme: dark)": {
																		color: neutral[400],
																	},
																}),
															]}
														>
															Add a TXT record at <code>_ping-verification.{domain.hostname}</code>{" "}
															with value <code>ping_{domain.id}</code>.
														</p>
													</>
												)}
											</td>
											<td>
												{domain.verified_at === null && (
													<form
														method="post"
														action={routes.teamAdminActions.domain.retryVerification.href({
															team: team.slug,
														})}
													>
														<input type="hidden" name="domain_id" value={domain.id} />
														<Button type="submit" variant="outline">
															{ctx.i18next.t(
																"page.settings.domains.table.actions.retryVerification",
															)}
														</Button>
													</form>
												)}
												<form
													method="post"
													action={routes.teamAdminActions.domain.remove.href({ team: team.slug })}
												>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="domain_id" value={domain.id} />
													<Button type="submit" color="danger">
														{ctx.i18next.t("page.settings.domains.table.actions.remove")}
													</Button>
												</form>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>

						<h2>{ctx.i18next.t("page.settings.billing.title")}</h2>
						<a
							href={routes.app.team.checkout.href({ team: team.slug })}
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
							{ctx.i18next.t("page.settings.billing.card.cta")}
						</a>

						<h2>{ctx.i18next.t("page.settings.danger.title")}</h2>
						<Button type="button" color="danger" commandfor="delete-team" command="show-modal">
							{ctx.i18next.t("page.settings.danger.card.cta")}
						</Button>
						<dialog
							id="delete-team"
							mix={[
								css({
									padding: 24,
									borderRadius: 8,
									border: `1px solid ${neutral[300]}`,
									maxWidth: 400,
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
							<h3>{ctx.i18next.t("page.settings.danger.card.title")}</h3>
							<p
								mix={[
									css({
										fontSize: "0.8125rem",
										color: neutral[500],
										"@media (prefers-color-scheme: dark)": {
											color: neutral[400],
										},
									}),
								]}
							>
								{ctx.i18next.t("page.settings.danger.card.warning")}
							</p>
							<form
								method="post"
								action={routes.teamAdminActions.team.delete.href({ team: team.slug })}
							>
								<input type="hidden" name="_method" value="DELETE" />
								<Field label={ctx.i18next.t("page.settings.danger.card.confirmation.label")}>
									<input
										type="text"
										name="confirmation"
										required
										placeholder={ctx.i18next.t(
											"page.settings.danger.card.confirmation.placeholder",
										)}
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
									<Button type="button" variant="outline" commandfor="delete-team" command="close">
										{ctx.i18next.t("page.settings.form.actions.cancel")}
									</Button>
									<Button type="submit" color="danger">
										{ctx.i18next.t("page.settings.danger.card.cta")}
									</Button>
								</div>
							</form>
						</dialog>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
