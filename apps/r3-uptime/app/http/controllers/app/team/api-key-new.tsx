/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Renders the new API key form, listing every value of
 * `apiKeyScopes` as a scope checkbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";
import { css } from "remix/ui";

import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { apiKeyScopes } from "~/database/schema";
import Button from "~/resources/components/button";
import Field from "~/resources/components/field";
import FormPage from "~/resources/components/form-page";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import { neutral } from "~/resources/theme";
import routes from "~/routes/web";

/** GET /app/:team/api-keys/new — the new API key form. */
export default createAction(routes.app.team.apiKeys.new, {
	middleware: [requireUser, requireTeam, requireRole("admin")],
	handler: () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this handler");

		return ctx.render(
			<DocumentLayout title={`${ctx.team.name} · New API key`}>
				<AppShell
					team={ctx.team}
					currentPath={ctx.url.pathname}
					teams={ctx.teams}
					viewer={viewer}
					isAdmin={ctx.membership.role === "admin"}
					heading={ctx.i18next.t("page.apiKeys.form.title")}
				>
					<FormPage>
						<form
							method="post"
							action={routes.teamAdminActions.apiKey.create.href({ team: ctx.team.slug })}
						>
							<Field label={ctx.i18next.t("page.apiKeys.form.fields.name.label")}>
								<input
									type="text"
									name="name"
									required
									placeholder={ctx.i18next.t("page.apiKeys.form.fields.name.placeholder")}
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

							<fieldset
								mix={[
									css({
										display: "flex",
										flexDirection: "column",
										gap: 4,
										marginBottom: 20,
										fontSize: "0.875rem",
										fontWeight: 500,
									}),
								]}
							>
								<legend>{ctx.i18next.t("page.apiKeys.form.fields.scopes.label")}</legend>
								{apiKeyScopes.map((scope) => (
									<label
										key={scope}
										mix={[
											css({
												display: "flex",
												alignItems: "center",
												gap: 8,
												marginBottom: 16,
												fontSize: "0.875rem",
											}),
										]}
									>
										<input type="checkbox" name="scopes" value={scope} />
										<span>
											{ctx.i18next.t(`page.apiKeys.form.fields.scopes.options.${scope}`, {
												nsSeparator: false,
											})}
										</span>
									</label>
								))}
							</fieldset>

							<Field label={ctx.i18next.t("page.apiKeys.form.fields.expiresAt.label")}>
								<input
									type="date"
									name="expires_at"
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

							<Button type="submit">{ctx.i18next.t("page.apiKeys.form.actions.create")}</Button>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
