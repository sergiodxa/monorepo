/**
 * Team settings page: general info, members (role changes, removal, invites),
 * domains (add/remove, verification status), a billing link, and a danger zone for
 * team deletion. Every destructive action uses a native `<dialog>` confirmation.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Subject } from "@pkg/auth-sdk";
import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type {
	SelectInvite,
	SelectMembership,
	SelectTeam,
	SelectTeamDomain,
} from "~/database/schema";

import Badge from "~/resources/components/badge";
import Field from "~/resources/components/field";
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

const primary = {
	600: "oklch(0.6 0.16 142)",
	400: "oklch(0.78 0.16 142)",
} as const;

const danger = {
	600: "oklch(0.58 0.18 25)",
	700: "oklch(0.48 0.16 25)",
} as const;

const buttonPrimary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: neutral[900],
	color: "#ffffff",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: neutral[800] },
});

const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: `2px solid ${neutral[300]}`,
	background: "#ffffff",
	color: neutral[500],
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: neutral[50] },
	"@media (prefers-color-scheme: dark)": {
		background: neutral[900],
		color: neutral[400],
		borderColor: neutral[700],
		"&:hover": { background: neutral[800] },
	},
});

const buttonDanger = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: danger[600],
	color: "#ffffff",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: danger[700] },
});

namespace SettingsView {
	export interface Props {
		team: SelectTeam;
		members: SelectMembership[];
		subjectsById: Map<string, Subject>;
		pendingInvites: SelectInvite[];
		domains: SelectTeamDomain[];
	}
}

export default function SettingsView(handle: Handle<SettingsView.Props>) {
	return () => {
		let { team, members, subjectsById, pendingInvites, domains } = handle.props;

		return (
			<div>
				<h1 mix={[css({ margin: "0 0 24px" })]}>Settings</h1>

				<h2>General</h2>
				<form method="post" action={routes.teamAdminActions.updateTeam.href({ team: team.slug })}>
					<Field label="Name">
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
					<Field label="Logo URL">
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
					<button type="submit" mix={[buttonPrimary]}>
						Save changes
					</button>
				</form>

				<h2>Members</h2>
				<button
					type="button"
					commandfor="invite-member"
					command="show-modal"
					mix={[buttonSecondary]}
				>
					Invite member
				</button>
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
					<h3>Invite a member</h3>
					<form
						method="post"
						action={routes.teamAdminActions.createInvite.href({ team: team.slug })}
					>
						<Field label="Email">
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
						<button
							type="button"
							commandfor="invite-member"
							command="close"
							mix={[buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[buttonPrimary]}>
							Send invite
						</button>
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
								<th>Member</th>
								<th>Role</th>
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
												{isOwner ? "owner" : member.role}
											</Badge>
										</td>
										<td>
											{!isOwner && (
												<>
													<form
														method="post"
														action={routes.teamAdminActions.changeRole.href({ team: team.slug })}
													>
														<input type="hidden" name="subject_id" value={member.subject_id} />
														<input type="hidden" name="role" value={nextRole} />
														<button type="submit" mix={[buttonSecondary]}>
															Make {nextRole}
														</button>
													</form>
													<button
														type="button"
														commandfor={`remove-member-${member.id}`}
														command="show-modal"
														mix={[buttonDanger]}
													>
														Remove
													</button>
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
														<h3>Remove this member?</h3>
														<form
															method="post"
															action={routes.teamAdminActions.removeMember.href({
																team: team.slug,
															})}
														>
															<input type="hidden" name="_method" value="DELETE" />
															<input type="hidden" name="subject_id" value={member.subject_id} />
															<input
																type="hidden"
																name="email"
																value={subject?.emailAddress ?? ""}
															/>
															<button
																type="button"
																commandfor={`remove-member-${member.id}`}
																command="close"
																mix={[buttonSecondary]}
															>
																Cancel
															</button>
															<button type="submit" mix={[buttonDanger]}>
																Remove
															</button>
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
						<h3>Pending invites</h3>
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
										<th>Email</th>
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
													action={routes.teamAdminActions.revokeInvite.href({ team: team.slug })}
												>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="invite_id" value={invite.id} />
													<button type="submit" mix={[buttonSecondary]}>
														Revoke
													</button>
												</form>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				)}

				<h2>Domains</h2>
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
					Verified domains automatically join new sign-ups whose email matches to this team.
				</p>
				<form method="post" action={routes.teamAdminActions.addDomain.href({ team: team.slug })}>
					<Field label="Domain">
						<input
							type="text"
							name="hostname"
							required
							placeholder="example.com"
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
					<button type="submit" mix={[buttonSecondary]}>
						Add domain
					</button>
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
								<th>Domain</th>
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
												<Badge tone="neutral">pending</Badge>
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
													Add a TXT record at <code>_ping-verification.{domain.hostname}</code> with
													value <code>ping_{domain.id}</code>.
												</p>
											</>
										)}
									</td>
									<td>
										{domain.verified_at === null && (
											<form
												method="post"
												action={routes.teamAdminActions.retryDomainVerification.href({
													team: team.slug,
												})}
											>
												<input type="hidden" name="domain_id" value={domain.id} />
												<button type="submit" mix={[buttonSecondary]}>
													Retry
												</button>
											</form>
										)}
										<form
											method="post"
											action={routes.teamAdminActions.removeDomain.href({ team: team.slug })}
										>
											<input type="hidden" name="_method" value="DELETE" />
											<input type="hidden" name="domain_id" value={domain.id} />
											<button type="submit" mix={[buttonDanger]}>
												Remove
											</button>
										</form>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<h2>Billing</h2>
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
					Manage billing
				</a>

				<h2>Danger zone</h2>
				<button type="button" commandfor="delete-team" command="show-modal" mix={[buttonDanger]}>
					Delete team
				</button>
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
					<h3>Delete "{team.name}"?</h3>
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
						This permanently deletes the team and every monitor, alert, status page, and API key it
						owns. Type <code>DELETE</code> to confirm.
					</p>
					<form method="post" action={routes.teamAdminActions.deleteTeam.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input
							type="text"
							name="confirmation"
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
						<button type="button" commandfor="delete-team" command="close" mix={[buttonSecondary]}>
							Cancel
						</button>
						<button type="submit" mix={[buttonDanger]}>
							Delete team
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
