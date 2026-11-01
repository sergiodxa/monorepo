/**
 * Form actions for creating and deleting API keys. Requires `requireAbility(abilities.apiKeys.write)`.
 * The newly-created plaintext key is stashed in a one-time session flash, read and cleared by the list
 * page, since every page here is a full server render with no client-side navigation state to carry
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Form } from "@sdxc/ui";

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import { CreateApiKeySchema, DeleteApiKeySchema } from "~/app/http/validators/api-key";
import { issueField, translateIssues } from "~/app/http/validators/form-submission";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import NewApiKeyPage from "~/resources/views/api-keys/new-api-key-page";
import routes from "~/routes/web";

/** The `page.apiKeys.fieldErrors` key per field the form can flag. */
const ISSUE_KEYS: Record<string, string> = { name: "name", scopes: "scopes" };

/**
 * POST /actions/:team/create-api-key. A rejected submission renders the new key form again with
 * a 422, keeping the typed name, the date and every checked scope beside the field's error.
 */
export const createApiKey = createAction(routes.teamAdminActions.apiKey.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateApiKeySchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		/** A key with no scope can do nothing, so an empty choice reads as a refused scope list. */
		let noScopes = ctx.formData.getAll("scopes").length === 0;
		let reported = noScopes
			? [...result.error.issues, { message: "scopes", path: ["scopes"] }]
			: result.error.issues;
		let issues: Form.Issue[] = translateIssues(
			reported.filter((issue) => (issueField(issue) ?? "") in ISSUE_KEYS),
			(field) => ({
				field,
				message: ctx.intl.t(`page.apiKeys.fieldErrors.${ISSUE_KEYS[field ?? ""]}`),
			}),
		);
		return ctx.render(<NewApiKeyPage submission={{ values: ctx.formData, issues }} />, {
			status: 422,
		});
	}

	let count = await ctx.models.apiKeys.inTeam(ctx.team.id).count();
	if (count >= MAX_API_KEYS_PER_TEAM) {
		return badRequest(`A team can have at most ${MAX_API_KEYS_PER_TEAM} API keys.`);
	}

	let { name, scopes, expires_at } = result.data;
	let { record, key } = unwrap(
		await ctx.models.apiKeys.issue(ctx.team.id, { name, scopes, expires_at }),
	);

	session?.flash("newApiKey", { name: record.name, key });
	return redirect(routes.app.team.apiKeys.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/delete-api-key */
export const deleteApiKey = createAction(routes.teamAdminActions.apiKey.delete, async (ctx) => {
	let result = await validate(ctx.formData, DeleteApiKeySchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.apiKeys.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let apiKey = await ctx.models.apiKeys
		.inTeam(ctx.team.id)
		.where({ id: result.data.api_key_id })
		.first();
	if (!apiKey) return notFound("Not Found");

	unwrap(await ctx.models.apiKeys.delete(apiKey.id));

	session?.flash("toast", { intent: "success", message: `API key "${apiKey.name}" deleted.` });
	return redirect(routes.app.team.apiKeys.index.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
