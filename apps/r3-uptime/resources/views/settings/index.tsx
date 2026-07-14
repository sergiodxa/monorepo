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
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
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

const dialogActions = css({ display: "flex", gap: 8, justifyContent: "flex-end" });

namespace SettingsView {
	export interface Props {
		team: SelectTeam;
		members: SelectMembership[];
		subjectsById: Map<string, Subject>;
		pendingInvites: SelectInvite[];
		domains: SelectTeamDomain[];
	}
}

/** Renders the team settings page; every destructive action (remove member, delete team) is gated behind a `<dialog>` confirmation. */
export default function SettingsView(handle: Handle<SettingsView.Props>) {
	return () => {
		let { team, members, subjectsById, pendingInvites, domains } = handle.props;

		return (
			<div>
				<h2>General</h2>
				<form method="post" action={routes.teamAdminActions.team.update.href({ team: team.slug })}>
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
					<Button type="submit">Save changes</Button>
				</form>

				<h2>Members</h2>
				<Button type="button" variant="outline" commandfor="invite-member" command="show-modal">
					Invite member
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
					<h3>Invite a member</h3>
					<form
						method="post"
						action={routes.teamAdminActions.invite.create.href({ team: team.slug })}
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
						<div mix={[dialogActions]}>
							<Button type="button" variant="outline" commandfor="invite-member" command="close">
								Cancel
							</Button>
							<Button type="submit">Send invite</Button>
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
														action={routes.teamAdminActions.member.changeRole.href({
															team: team.slug,
														})}
													>
														<input type="hidden" name="subject_id" value={member.subject_id} />
														<input type="hidden" name="role" value={nextRole} />
														<Button type="submit" variant="outline">
															Make {nextRole}
														</Button>
													</form>
													<Button
														type="button"
														color="danger"
														commandfor={`remove-member-${member.id}`}
														command="show-modal"
													>
														Remove
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
														<h3>Remove this member?</h3>
														<form
															method="post"
															action={routes.teamAdminActions.member.remove.href({
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
															<div mix={[dialogActions]}>
																<Button
																	type="button"
																	variant="outline"
																	commandfor={`remove-member-${member.id}`}
																	command="close"
																>
																	Cancel
																</Button>
																<Button type="submit" color="danger">
																	Remove
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
													action={routes.teamAdminActions.invite.revoke.href({ team: team.slug })}
												>
													<input type="hidden" name="_method" value="DELETE" />
													<input type="hidden" name="invite_id" value={invite.id} />
													<Button type="submit" variant="outline">
														Revoke
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
				<form method="post" action={routes.teamAdminActions.domain.add.href({ team: team.slug })}>
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
					<Button type="submit" variant="outline">
						Add domain
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
												action={routes.teamAdminActions.domain.retryVerification.href({
													team: team.slug,
												})}
											>
												<input type="hidden" name="domain_id" value={domain.id} />
												<Button type="submit" variant="outline">
													Retry
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
												Remove
											</Button>
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
				<Button type="button" color="danger" commandfor="delete-team" command="show-modal">
					Delete team
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
					<form
						method="post"
						action={routes.teamAdminActions.team.delete.href({ team: team.slug })}
					>
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
						<div mix={[dialogActions]}>
							<Button type="button" variant="outline" commandfor="delete-team" command="close">
								Cancel
							</Button>
							<Button type="submit" color="danger">
								Delete team
							</Button>
						</div>
					</form>
				</dialog>
			</div>
		);
	};
}
