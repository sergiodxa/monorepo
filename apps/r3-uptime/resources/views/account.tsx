/**
 * Account page: read-only profile (name/email come from the auth server, not
 * locally editable), a language preference select, the list of every team the
 * viewer belongs to with a leave action (members only — owners and admins must
 * leave by deleting the team or being demoted first), and a create-team dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectTeam, SupportedLanguage } from "~/database/schema";

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

/** {@link css}'s return type doesn't fit `HTMLSelectElement` (Cloudflare Workers types conflict). */
function mixForSelect(
	mixin: CSSMixinDescriptor,
): MixinDescriptor<HTMLSelectElement, CSSMixinDescriptor["args"], ElementProps> {
	return mixin as unknown as MixinDescriptor<
		HTMLSelectElement,
		CSSMixinDescriptor["args"],
		ElementProps
	>;
}

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
	en: "English",
	es: "Espanol",
	de: "Deutsch",
	ja: "Japanese",
	fr: "Francais",
	it: "Italiano",
};

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
					<a
						href={`mailto:${viewer.email}`}
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
						{viewer.email}
					</a>
				</p>

				<h2>Language</h2>
				<form method="post" action={routes.accountActions.updateLanguage.href()}>
					<select
						name="language"
						defaultValue={preferredLanguage ?? "auto"}
						mix={[
							mixForSelect(
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
							),
						]}
					>
						<option value="auto">Auto-detect</option>
						{Object.entries(LANGUAGE_LABELS).map(([code, label]) => (
							<option key={code} value={code}>
								{label}
							</option>
						))}
					</select>
					<button type="submit" mix={[buttonSecondary]}>
						Save language
					</button>
				</form>

				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					<h2>Your teams</h2>
					<button type="button" commandfor="create-team" command="show-modal" mix={[buttonPrimary]}>
						Create team
					</button>
				</div>
				<dialog
					id="create-team"
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
					<h3>Create a team</h3>
					<form method="post" action={routes.accountActions.createTeam.href()}>
						<Field label="Name">
							<input
								type="text"
								name="name"
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
						<button type="button" commandfor="create-team" command="close" mix={[buttonSecondary]}>
							Cancel
						</button>
						<button type="submit" mix={[buttonPrimary]}>
							Create team
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
											<a
												href={routes.app.team.dashboard.href({ team: team.slug })}
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
												{team.name}
											</a>
										</td>
										<td>
											<Badge tone={isOwner ? "up" : "neutral"}>{isOwner ? "owner" : role}</Badge>
										</td>
										<td>
											{canLeave && (
												<form method="post" action={routes.accountActions.leaveTeam.href()}>
													<input type="hidden" name="team_id" value={team.id} />
													<button
														type="submit"
														mix={[
															css({
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
															}),
														]}
													>
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
			</div>
		);
	};
}
