/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Renders the new API key form, listing every value of
 * `apiKeyScopes` as a scope checkbox.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Checkbox, CheckboxGroup, Description, Label } from "@pkg/r3-ui";
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

/** DOM id for the scopes {@link CheckboxGroup}'s visible caption, wired through `aria-labelledby`. */
const SCOPES_LABEL_ID = "api-key-scopes-label";

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

							<div
								mix={[css({ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 })]}
							>
								<CheckboxGroup aria-labelledby={SCOPES_LABEL_ID}>
									<Label id={SCOPES_LABEL_ID}>
										{ctx.i18next.t("page.apiKeys.form.fields.scopes.label")}
									</Label>
									{apiKeyScopes.map((scope) => (
										<Checkbox key={scope} name="scopes" value={scope}>
											{ctx.i18next.t(`page.apiKeys.form.fields.scopes.options.${scope}`, {
												nsSeparator: false,
											})}
										</Checkbox>
									))}
								</CheckboxGroup>
								<Description>
									{ctx.i18next.t("page.apiKeys.form.fields.scopes.description")}
								</Description>
							</div>

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
