/**
 * Account page: read-only profile (name/email come from the auth server, not
 * locally editable), a language preference select, the list of every team the
 * viewer belongs to with a leave action (members only — owners and admins must
 * leave by deleting the team or being demoted first), and a create-team dialog
 * (triggered from the page header's "Create team" action).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, Handle, MixinDescriptor } from "remix/ui";

import { css } from "remix/ui";

import type { SelectTeam, SupportedLanguage } from "~/database/schema";

import Avatar from "~/resources/components/avatar";
import Badge from "~/resources/components/badge";
import Field from "~/resources/components/field";
import { danger, neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

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

const section = css({ marginBottom: 32 });

const sectionTitle = css({ margin: "0 0 4px" });

const sectionDescription = css({
	margin: "0 0 16px",
	fontSize: "0.8125rem",
	color: neutral[500],
});

/** Bordered card wrapping each section's actual content. */
const card = css({
	padding: 20,
	borderRadius: 8,
	border: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
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
				<section mix={[section]}>
					<h2 mix={[sectionTitle]}>Profile</h2>
					<p mix={[sectionDescription]}>Your personal information.</p>
					<div mix={[card, css({ display: "flex", alignItems: "center", gap: 16 })]}>
						<Avatar src={viewer.avatar || null} name={viewer.name} size={48} />
						<div>
							<div mix={[css({ fontWeight: 600 })]}>{viewer.name}</div>
							<a
								href={`mailto:${viewer.email}`}
								mix={[
									css({
										fontSize: "0.8125rem",
										color: primary[600],
										textDecoration: "none",
										"&:hover": { textDecoration: "underline" },
										"@media (prefers-color-scheme: dark)": { color: primary[400] },
									}),
								]}
							>
								{viewer.email}
							</a>
						</div>
					</div>
				</section>

				<section mix={[section]}>
					<h2 mix={[sectionTitle]}>Language Preference</h2>
					<p mix={[sectionDescription]}>Choose your preferred language for the interface.</p>
					<div mix={[card]}>
						<form method="post" action={routes.accountActions.updateLanguage.href()}>
							<Field label="Language">
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
							</Field>
							<p
								mix={[
									css({
										margin: "8px 0 16px",
										fontSize: "0.8125rem",
										color: neutral[500],
									}),
								]}
							>
								Select your preferred language. Auto-detect uses your browser settings.
							</p>
							<div mix={[css({ display: "flex", justifyContent: "flex-end" })]}>
								<button type="submit" mix={[buttonSecondary]}>
									Save language
								</button>
							</div>
						</form>
					</div>
				</section>

				<section>
					<h2 mix={[sectionTitle]}>Your Teams</h2>
					<p mix={[sectionDescription]}>Teams you are a member of.</p>
					<div mix={[card, css({ padding: 0, overflowX: "auto" })]}>
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
				</section>

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
			</div>
		);
	};
}
