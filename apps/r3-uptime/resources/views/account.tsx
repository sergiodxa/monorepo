/**
 * Account page: read-only profile (name/email come from the auth server, not
 * locally editable), a language preference select, the list of every team the
 * viewer belongs to with a leave action (members only — owners and admins must
 * leave by deleting the team or being demoted first), and a create-team dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTeam, SupportedLanguage } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
	en: "English",
	es: "Espanol",
	de: "Deutsch",
	ja: "Japanese",
	fr: "Francais",
	it: "Italiano",
};

namespace AccountView {
	export interface Props {
		viewer: { name: string; email: string; avatar: string };
		memberships: Array<{ team: SelectTeam; role: "member" | "admin"; isOwner: boolean }>;
		preferredLanguage: SupportedLanguage | null;
	}
}

export default function AccountView(handle: Handle<AccountView.Props>) {
	return () => {
		let { viewer, memberships, preferredLanguage } = handle.props;

		return (
			<div>
				<h1>Account</h1>

				<h2>Profile</h2>
				<p>{viewer.name}</p>
				<p mix={[s.mutedSmall]}>
					<a href={`mailto:${viewer.email}`} mix={[s.link]}>
						{viewer.email}
					</a>
				</p>

				<h2>Language</h2>
				<form method="post" action={routes.accountActions.updateLanguage.href()}>
					<select name="language" defaultValue={preferredLanguage ?? "auto"} mix={[s.selectInput]}>
						<option value="auto">Auto-detect</option>
						{Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
							<option key={code} value={code}>
								{label}
							</option>
						))}
					</select>
					<button type="submit" mix={[s.buttonSecondary]}>
						Save language
					</button>
				</form>

				<div mix={[s.row]}>
					<h2>Your teams</h2>
					<button
						type="button"
						commandfor="create-team"
						command="show-modal"
						mix={[s.buttonPrimary]}
					>
						Create team
					</button>
				</div>
				<dialog id="create-team" mix={[s.dialog]}>
					<h3>Create a team</h3>
					<form method="post" action={routes.accountActions.createTeam.href()}>
						<label mix={[s.field]}>
							<span>Name</span>
							<input type="text" name="name" required mix={[s.input]} />
						</label>
						<button
							type="button"
							commandfor="create-team"
							command="close"
							mix={[s.buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[s.buttonPrimary]}>
							Create team
						</button>
					</form>
				</dialog>

				<table mix={[s.table]}>
					<thead>
						<tr>
							<th>Team</th>
							<th>Role</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{memberships.map(({ team, role, isOwner }) => {
							let canLeave = !isOwner && role === "member";

							return (
								<tr key={team.id}>
									<td>
										<a href={routes.app.team.dashboard.href({ team: team.slug })} mix={[s.link]}>
											{team.name}
										</a>
									</td>
									<td>
										<span mix={[s.badge, isOwner ? s.badgeUp : s.badgeNeutral]}>
											{isOwner ? "owner" : role}
										</span>
									</td>
									<td>
										{canLeave && (
											<form method="post" action={routes.accountActions.leaveTeam.href()}>
												<input type="hidden" name="team_id" value={team.id} />
												<button type="submit" mix={[s.buttonDanger]}>
													Leave
												</button>
											</form>
										)}
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
			</div>
		);
	};
}
