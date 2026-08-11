/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireRole("admin")`. Renders the new API key form, listing every value of
 * `apiKeyScopes` as a scope checkbox.
 *
 * The fields are grouped into two bordered cards — what the key is called and how
 * long it lives, and what it is allowed to do — inside a single `<form>`, so the
 * page reads as distinct settings groups while still submitting as one request. The
 * submit control sits at the foot of the last card rather than loose under the
 * fields.
 *
 * There are two dozen scopes and each carries a sentence or two of prose, so the
 * list is a row-flow grid that splits into two columns on wide viewports: grid
 * items are atomic, so no entry can be torn across the column boundary the way CSS
 * multi-column would tear it, and row flow keeps the DOM in `apiKeyScopes` order so
 * tab order matches the reading order and each `:read`/`:write` pair stays side by
 * side in one row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat, vstack } from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { mbe, pis } from "@pkg/u/size";
import { Button, Checkbox, CheckboxGroup, DateField, Description, TextField } from "@pkg/ui";
import { getContext } from "remix/async-context-middleware";
import { createAction } from "remix/fetch-router";

import type { ApiKeyScope } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import requireRole from "~/app/http/middleware/require-role";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import { apiKeyScopes } from "~/database/schema";
import FormPage from "~/resources/components/form-page";
import SettingsSection from "~/resources/components/settings-section";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Widest this form's column is allowed to grow, overriding `FormPage`'s default.
 * Every other field is comfortable at the default, but two columns of scopes are
 * not: each entry is a scope string plus a wrapped sentence of prose, and at 640px
 * the pair would be ~310px each and wrap after three or four words.
 */
const FORM_MAX_WIDTH = "880px";

/**
 * Viewport width from which the scope list splits into two columns. `AppShell`
 * spends 256px on the sidebar and 48px of padding per side from 768px up, so the
 * form only sees `viewport - 352px`: this leaves ~320px per column, and the next
 * step down (768px) would leave ~200px, which is narrower than the descriptions
 * read well at.
 */
const SCOPES_TWO_COLUMN_QUERY = "(min-width: 1024px)";

/**
 * DOM id for one scope's description, referenced by that scope's checkbox through
 * `aria-describedby`. The `:` in a scope string is a legal id character but needs
 * escaping in a CSS selector, so it is swapped out here.
 *
 * @param scope The scope the description belongs to.
 * @returns The description element's id.
 */
function descriptionId(scope: ApiKeyScope) {
	return `api-key-scope-${scope.replace(":", "-")}-description`;
}

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
					<FormPage maxWidth={FORM_MAX_WIDTH}>
						<form
							method="post"
							action={routes.teamAdminActions.apiKey.create.href({ team: ctx.team.slug })}
							mix={[vstack({ gap: 12 })]}
						>
							<SettingsSection
								id="details"
								title={ctx.i18next.t("page.apiKeys.form.sections.details.title")}
								description={ctx.i18next.t("page.apiKeys.form.sections.details.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<TextField
											label={ctx.i18next.t("page.apiKeys.form.fields.name.label")}
											type="text"
											name="name"
											required
											placeholder={ctx.i18next.t("page.apiKeys.form.fields.name.placeholder")}
											description={ctx.i18next.t("page.apiKeys.form.fields.name.description")}
											mix={mbe("28px")}
										/>

										<DateField
											label={ctx.i18next.t("page.apiKeys.form.fields.expiresAt.label")}
											name="expires_at"
											description={ctx.i18next.t("page.apiKeys.form.fields.expiresAt.description")}
											mix={mbe("28px")}
										/>
									</SettingsSection.Body>
								</SettingsSection.Card>
							</SettingsSection>

							{/* The section heading is the group's visible caption now, so the group is named
							through `aria-label` with that same string rather than repeating it as a second
							"Permissions" line inside the card. */}
							<SettingsSection
								id="scopes"
								title={ctx.i18next.t("page.apiKeys.form.fields.scopes.label")}
								description={ctx.i18next.t("page.apiKeys.form.fields.scopes.description")}
							>
								<SettingsSection.Card>
									<SettingsSection.Body>
										<CheckboxGroup
											aria-label={ctx.i18next.t("page.apiKeys.form.fields.scopes.label")}
											mix={[mbe("28px")]}
										>
											<div
												mix={[
													grid(),
													gap(3),
													media(SCOPES_TWO_COLUMN_QUERY, gridTemplate({ columns: repeat(2, 1) })),
												]}
											>
												{apiKeyScopes.map((scope) => (
													<div key={scope} mix={[vstack({ gap: 1 })]}>
														<Checkbox
															name="scopes"
															value={scope}
															aria-describedby={descriptionId(scope)}
														>
															{scope}
														</Checkbox>
														<Description id={descriptionId(scope)} mix={pis("1.75rem")}>
															{ctx.i18next.t(
																`page.apiKeys.form.fields.scopes.descriptions.${scope}`,
																{ nsSeparator: false },
															)}
														</Description>
													</div>
												))}
											</div>
										</CheckboxGroup>
									</SettingsSection.Body>
									<SettingsSection.Footer>
										<Button type="submit">
											{ctx.i18next.t("page.apiKeys.form.actions.create")}
										</Button>
									</SettingsSection.Footer>
								</SettingsSection.Card>
							</SettingsSection>
						</form>
					</FormPage>
				</AppShell>
			</DocumentLayout>,
		);
	},
});
