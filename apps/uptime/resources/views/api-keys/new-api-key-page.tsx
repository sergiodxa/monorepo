/**
 * The new API key page: one settings section listing every `apiKeyScopes` value as a checkbox.
 * Drawn by the form's GET route and again by the create action when it refuses a submission,
 * so the typed name, the chosen date and every checked scope come back beside each field's error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { gap, grid, gridTemplate, repeat, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { maxIs, p, pis } from "@sdxc/u/size";
import { fontSize, weight } from "@sdxc/u/typography";
import { Checkbox, CheckboxGroup, DateField, Description, FieldError, TextField } from "@sdxc/ui";
import { SettingsSection } from "@sdxc/ui/app";
import { getContext } from "remix/middleware/async-context";

import type { FormSubmission } from "~/app/http/validators/form-submission";
import type { ApiKeyScope } from "~/database/schema";

import { getViewer } from "~/app/http/middleware/auth";
import { fieldIssue, submittedList, submittedText } from "~/app/http/validators/form-submission";
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

export namespace NewApiKeyPage {
	export interface Props {
		/** The submission the create action refused; omitted on a first visit. */
		submission?: FormSubmission;
	}
}

/** Renders the whole document for the current request's team and signed-in viewer. */
export default function NewApiKeyPage(handle: Handle<NewApiKeyPage.Props>) {
	return () => {
		let ctx = getContext();
		let viewer = getViewer();
		if (!viewer) throw new Error("requireUser must run before this page renders");
		let { submission } = handle.props;

		let t = ctx.intl.t;
		let checked = new Set(submittedList(submission, "scopes", []));
		let scopesIssue = fieldIssue(submission, "scopes");

		return (
			<DocumentLayout
				assets={ctx.assets}
				title={`${ctx.team.name} · ${t("page.apiKeys.form.title")}`}
			>
				<AppShell
					team={ctx.team}
					currentPath={routes.app.team.apiKeys.new.href({ team: ctx.team.slug })}
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
								defaultValue={submittedText(submission, "name", "")}
								placeholder={t("page.apiKeys.form.fields.name.placeholder")}
								description={t("page.apiKeys.form.fields.name.description")}
								errorMessage={fieldIssue(submission, "name")}
							/>

							<DateField
								label={t("page.apiKeys.form.fields.expiresAt.label")}
								name="expires_at"
								defaultValue={submittedText(submission, "expires_at", "") || undefined}
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
								aria-describedby={scopesIssue ? SCOPES_ERROR_ID : undefined}
								aria-invalid={scopesIssue ? "true" : undefined}
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
							{scopesIssue && <FieldError id={SCOPES_ERROR_ID}>{scopesIssue}</FieldError>}
						</div>
					</SettingsSection>
				</AppShell>
			</DocumentLayout>
		);
	};
}
