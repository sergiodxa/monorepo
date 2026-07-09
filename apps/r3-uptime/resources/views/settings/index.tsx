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

import type {
	SelectInvite,
	SelectMembership,
	SelectTeam,
	SelectTeamDomain,
} from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

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
				<h1>Settings</h1>

				<h2>General</h2>
				<form method="post" action={routes.teamAdminActions.updateTeam.href({ team: team.slug })}>
					<label mix={[s.field]}>
						<span>Name</span>
						<input type="text" name="name" required defaultValue={team.name} mix={[s.input]} />
					</label>
					<label mix={[s.field]}>
						<span>Logo URL</span>
						<input type="url" name="logo" defaultValue={team.logo ?? ""} mix={[s.input]} />
					</label>
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<h2>Members</h2>
				<button
					type="button"
					commandfor="invite-member"
					command="show-modal"
					mix={[s.buttonSecondary]}
				>
					Invite member
				</button>
				<dialog id="invite-member" mix={[s.dialog]}>
					<h3>Invite a member</h3>
					<form
						method="post"
						action={routes.teamAdminActions.createInvite.href({ team: team.slug })}
					>
						<label mix={[s.field]}>
							<span>Email</span>
							<input type="email" name="email" required mix={[s.input]} />
						</label>
						<button
							type="button"
							commandfor="invite-member"
							command="close"
							mix={[s.buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[s.buttonPrimary]}>
							Send invite
						</button>
					</form>
				</dialog>

				<table mix={[s.table]}>
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
										<span mix={[s.badge, isOwner ? s.badgeUp : s.badgeNeutral]}>
											{isOwner ? "owner" : member.role}
										</span>
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
													<button type="submit" mix={[s.buttonSecondary]}>
														Make {nextRole}
													</button>
												</form>
												<button
													type="button"
													commandfor={`remove-member-${member.id}`}
													command="show-modal"
													mix={[s.buttonDanger]}
												>
													Remove
												</button>
												<dialog id={`remove-member-${member.id}`} mix={[s.dialog]}>
													<h3>Remove this member?</h3>
													<form
														method="post"
														action={routes.teamAdminActions.removeMember.href({ team: team.slug })}
													>
														<input type="hidden" name="subject_id" value={member.subject_id} />
														<input type="hidden" name="email" value={subject?.emailAddress ?? ""} />
														<button
															type="button"
															commandfor={`remove-member-${member.id}`}
															command="close"
															mix={[s.buttonSecondary]}
														>
															Cancel
														</button>
														<button type="submit" mix={[s.buttonDanger]}>
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

				{pendingInvites.length > 0 && (
					<>
						<h3>Pending invites</h3>
						<table mix={[s.table]}>
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
												<input type="hidden" name="invite_id" value={invite.id} />
												<button type="submit" mix={[s.buttonSecondary]}>
													Revoke
												</button>
											</form>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</>
				)}

				<h2>Domains</h2>
				<p mix={[s.mutedSmall]}>
					Verified domains automatically join new sign-ups whose email matches to this team.
				</p>
				<form method="post" action={routes.teamAdminActions.addDomain.href({ team: team.slug })}>
					<label mix={[s.field]}>
						<span>Domain</span>
						<input type="text" name="hostname" required placeholder="example.com" mix={[s.input]} />
					</label>
					<button type="submit" mix={[s.buttonSecondary]}>
						Add domain
					</button>
				</form>

				<table mix={[s.table]}>
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
										<span mix={[s.badge, s.badgeUp]}>verified</span>
									) : (
										<>
											<span mix={[s.badge, s.badgeNeutral]}>pending</span>
											<p mix={[s.mutedSmall]}>
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
											<button type="submit" mix={[s.buttonSecondary]}>
												Retry
											</button>
										</form>
									)}
									<form
										method="post"
										action={routes.teamAdminActions.removeDomain.href({ team: team.slug })}
									>
										<input type="hidden" name="domain_id" value={domain.id} />
										<button type="submit" mix={[s.buttonDanger]}>
											Remove
										</button>
									</form>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<h2>Billing</h2>
				<a href={routes.app.team.checkout.href({ team: team.slug })} mix={[s.link]}>
					Manage billing
				</a>

				<h2>Danger zone</h2>
				<button type="button" commandfor="delete-team" command="show-modal" mix={[s.buttonDanger]}>
					Delete team
				</button>
				<dialog id="delete-team" mix={[s.dialog]}>
					<h3>Delete "{team.name}"?</h3>
					<p mix={[s.mutedSmall]}>
						This permanently deletes the team and every monitor, alert, status page, and API key it
						owns. Type <code>DELETE</code> to confirm.
					</p>
					<form method="post" action={routes.teamAdminActions.deleteTeam.href({ team: team.slug })}>
						<input type="text" name="confirmation" required mix={[s.input]} />
						<button
							type="button"
							commandfor="delete-team"
							command="close"
							mix={[s.buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[s.buttonDanger]}>
							Delete team
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
