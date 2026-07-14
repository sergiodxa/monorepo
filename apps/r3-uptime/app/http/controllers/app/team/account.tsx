/**
 * Account page controller. Requires `requireUser` + `requireTeam` — the `:team` in
 * its URL only picks which team's shell wraps the page; the content itself lists
 * every team the viewer belongs to.
 *
 * Renders the account page body: profile, language preference, and team list. The
 * "Leave" button per team only shows for members who aren't the owner.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CSSMixinDescriptor, ElementProps, MixinDescriptor } from "remix/ui";

import { PlusIcon } from "@pkg/lucide-remix";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import Team from "~/app/data/team";
import UserPreferences from "~/app/data/user-preferences";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { supportedLanguages } from "~/database/schema";
import Avatar from "~/resources/components/avatar";
import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral, primary } from "~/resources/theme";
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

/** GET /app/:team/account — the signed-in user's account settings. */
export default createAction(routes.app.team.account, {
	middleware: [requireUser, requireTeam],
	handler: inject([Database] as const, async (db) => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		let [memberships, preferences] = await Promise.all([
			Team.listWithRoleBySubjectId(db, viewer.id),
			UserPreferences.findBySubjectId(db, viewer.id),
		]);

		let preferredLanguage = preferences?.preferred_language ?? null;

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · Account`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.account.header.title")}
					actions={
						<Button type="button" commandfor="create-team" command="show-modal">
							<PlusIcon size={16} strokeWidth={1.5} />
							{ctx.i18next.t("page.account.teams.actions.createTeam")}
						</Button>
					}
				>
					<div>
						<section mix={[css({ marginBottom: 32 })]}>
							<h2 mix={[css({ margin: "0 0 4px" })]}>
								{ctx.i18next.t("page.account.profile.title")}
							</h2>
							<p mix={[css({ margin: "0 0 16px", fontSize: "0.8125rem", color: neutral[500] })]}>
								{ctx.i18next.t("page.account.profile.description")}
							</p>
							<div
								mix={[
									css({
										padding: 20,
										borderRadius: 8,
										border: `1px solid ${neutral[200]}`,
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
									css({ display: "flex", alignItems: "center", gap: 16 }),
								]}
							>
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

						<section mix={[css({ marginBottom: 32 })]}>
							<h2 mix={[css({ margin: "0 0 4px" })]}>
								{ctx.i18next.t("page.account.language.title")}
							</h2>
							<p mix={[css({ margin: "0 0 16px", fontSize: "0.8125rem", color: neutral[500] })]}>
								{ctx.i18next.t("page.account.language.description")}
							</p>
							<div
								mix={[
									css({
										padding: 20,
										borderRadius: 8,
										border: `1px solid ${neutral[200]}`,
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
								]}
							>
								<form method="post" action={routes.accountActions.updateLanguage.href()}>
									<Field label={ctx.i18next.t("page.account.language.form.fields.language.label")}>
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
											<option value="auto">
												{ctx.i18next.t("page.account.language.form.fields.language.options.auto")}
											</option>
											{supportedLanguages.map((code) => (
												<option key={code} value={code}>
													{ctx.i18next.t(
														`page.account.language.form.fields.language.options.${code}`,
													)}
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
										{ctx.i18next.t("page.account.language.form.fields.language.description")}
									</p>
									<div mix={[css({ display: "flex", justifyContent: "flex-end" })]}>
										<Button type="submit" variant="outline">
											{ctx.i18next.t("page.account.language.form.cta")}
										</Button>
									</div>
								</form>
							</div>
						</section>

						<section>
							<h2 mix={[css({ margin: "0 0 4px" })]}>
								{ctx.i18next.t("page.account.teams.title")}
							</h2>
							<p mix={[css({ margin: "0 0 16px", fontSize: "0.8125rem", color: neutral[500] })]}>
								{ctx.i18next.t("page.account.teams.description")}
							</p>
							<div
								mix={[
									css({
										padding: 20,
										borderRadius: 8,
										border: `1px solid ${neutral[200]}`,
										"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
									}),
									css({ padding: 0, overflowX: "auto" }),
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
											<th>{ctx.i18next.t("page.account.teams.table.columns.team")}</th>
											<th>{ctx.i18next.t("page.account.teams.table.columns.role")}</th>
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
															href={routes.app.team.dashboard.index.href({ team: team.slug })}
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
														<Badge tone={isOwner ? "up" : "neutral"}>
															{ctx.i18next.t(
																`page.account.teams.table.role.${isOwner ? "owner" : role}`,
															)}
														</Badge>
													</td>
													<td>
														{canLeave && (
															<form method="post" action={routes.accountActions.leaveTeam.href()}>
																<input type="hidden" name="team_id" value={team.id} />
																<Button type="submit" color="danger">
																	{ctx.i18next.t("page.account.teams.table.actions.leave")}
																</Button>
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
							<h3>{ctx.i18next.t("page.createTeam.header.title")}</h3>
							<form method="post" action={routes.accountActions.createTeam.href()}>
								<Field label={ctx.i18next.t("page.createTeam.form.fields.name.label")}>
									<input
										type="text"
										name="name"
										required
										placeholder={ctx.i18next.t("page.createTeam.form.fields.name.placeholder")}
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
									<Button type="button" variant="outline" commandfor="create-team" command="close">
										{ctx.i18next.t("page.createTeam.form.cancel")}
									</Button>
									<Button type="submit">{ctx.i18next.t("page.createTeam.form.cta")}</Button>
								</div>
							</form>
						</dialog>
					</div>
				</AppShell>
			</DocumentLayout>,
		);
	}),
});
