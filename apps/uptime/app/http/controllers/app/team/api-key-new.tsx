/**
 * New API key page controller. Requires `requireUser` + `requireTeam` +
 * `requireAbility(abilities.apiKeys.write)`. Renders the new API key form as one settings
 * section listing every `apiKeyScopes` value as a checkbox; the create action renders it again
 * with a rejected submission, so nothing typed or checked is lost.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { requireAbility } from "@sdxc/authz/middleware/router";
import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { maxIs, p, pis } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { Checkbox, CheckboxGroup, DateField, Description, FieldError, TextField } from "@sdxc/ui";
import { SettingsSection } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import type { ApiKeyScope } from "~/database/schema";

import { teamAccess } from "~/app/http/middleware/access";
import { getViewer } from "~/app/http/middleware/auth";
import requireTeam from "~/app/http/middleware/require-team";
import requireUser from "~/app/http/middleware/require-user";
import abilities from "~/app/policies/abilities";
import { apiKeyScopes } from "~/database/schema";
import AppShell from "~/resources/layouts/app-shell";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";

/**
 * Viewport width from which the scope list splits into two columns: below it a column of
 * scope entries (a scope string plus a sentence of prose) would wrap after a few words.
 */
const SCOPES_TWO_COLUMN_QUERY = "(min-width: 1024px)";

/** DOM id of the scopes error, which the scope group names through `aria-describedby`. */
const SCOPES_ERROR_ID = "api-key-scopes-error";

/**
 * What the create action received and which fields it rejected, so the form renders again
 * with the typed name, the chosen date and every checked scope, and an error beside each field.
 */
export interface NewApiKeySubmission {
	values: { name: string; expires_at: string; scopes: string[] };
	issues: { name?: boolean; scopes?: boolean };
}

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

/**
 * Renders the new API key form for the current request: empty from the page, refilled with a
 * rejected submission and a 400 from the create action.
 *
 * @param submission - The rejected form, with its values and issues.
 * @param init - Response options, such as the 400 a rejected submission answers with.
 * @returns The rendered page.
 */
export function renderNewApiKeyForm(
	submission?: NewApiKeySubmission,
	init?: ResponseInit,
): Promise<Response> | Response {
	let ctx = getContext();
	let viewer = getViewer();
	if (!viewer) throw new Error("requireUser must run before this handler");

	let t = ctx.intl.t;
	let checked = new Set(submission?.values.scopes ?? []);
	let scopesError = submission?.issues.scopes === true;

	return ctx.render(
		<DocumentLayout assets={ctx.assets} title={`${ctx.team.name} · New API key`}>
			<AppShell
				team={ctx.team}
				currentPath={ctx.url.pathname}
				teams={ctx.teams}
				viewer={viewer}
				isAdmin={ctx.membership.role === "admin"}
				intl={ctx.intl}
				heading={t("page.apiKeys.form.title")}
				breadcrumbs={[
					{
						label: t("page.apiKeys.header.title"),
						href: routes.app.team.apiKeys.index.href({ team: ctx.team.slug }),
					},
				]}
			>
				<SettingsSection
					id="details"
					title={t("page.apiKeys.form.sections.details.title")}
					description={t("page.apiKeys.form.sections.details.description")}
					form={{ action: routes.teamAdminActions.apiKey.create.href({ team: ctx.team.slug }) }}
					labels={{ save: t("page.apiKeys.form.actions.create") }}
					mix={[maxIs("56rem")]}
				>
					<div mix={[p(4), vstack({ gap: 5, align: "stretch" })]}>
						<TextField
							label={t("page.apiKeys.form.fields.name.label")}
							type="text"
							name="name"
							required
							defaultValue={submission?.values.name}
							placeholder={t("page.apiKeys.form.fields.name.placeholder")}
							description={t("page.apiKeys.form.fields.name.description")}
							errorMessage={
								submission?.issues.name ? t("page.apiKeys.fieldErrors.name") : undefined
							}
						/>

						<DateField
							label={t("page.apiKeys.form.fields.expiresAt.label")}
							name="expires_at"
							defaultValue={submission?.values.expires_at || undefined}
							description={t("page.apiKeys.form.fields.expiresAt.description")}
						/>
					</div>

					<div mix={[p(4), vstack({ gap: 3, align: "stretch" })]}>
						<div mix={[vstack({ gap: 0.5, align: "stretch" })]}>
							<span id="api-key-scopes-label" mix={[fontSize("sm"), weight("medium")]}>
								{t("page.apiKeys.form.fields.scopes.label")}
							</span>
							<Description>{t("page.apiKeys.form.fields.scopes.description")}</Description>
						</div>
						<CheckboxGroup
							aria-labelledby="api-key-scopes-label"
							aria-describedby={scopesError ? SCOPES_ERROR_ID : undefined}
							aria-invalid={scopesError ? "true" : undefined}
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
											defaultChecked={checked.has(scope)}
											aria-describedby={descriptionId(scope)}
										>
											{scope}
										</Checkbox>
										<Description id={descriptionId(scope)} mix={pis("1.75rem")}>
											{t(`page.apiKeys.form.fields.scopes.descriptions.${scope}`, {
												nsSeparator: false,
											})}
										</Description>
									</div>
								))}
							</div>
						</CheckboxGroup>
						{scopesError && (
							<FieldError id={SCOPES_ERROR_ID}>{t("page.apiKeys.fieldErrors.scopes")}</FieldError>
						)}
					</div>
				</SettingsSection>
			</AppShell>
		</DocumentLayout>,
		init,
	);
}

/** GET /app/:team/api-keys/new — the new API key form. */
export default createAction(routes.app.team.apiKeys.new, {
	middleware: [requireUser, requireTeam, teamAccess, requireAbility(abilities.apiKeys.write)],
	handler: () => renderNewApiKeyForm(),
});
