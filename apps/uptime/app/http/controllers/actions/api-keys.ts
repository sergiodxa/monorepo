/**
 * Form actions for creating and deleting API keys. Requires `requireAbility(abilities.apiKeys.write)`.
 * The newly-created plaintext key is stashed in a one-time session flash, read and cleared by the list
 * page, since every page here is a full server render with no client-side navigation state to carry
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import { renderNewApiKeyForm } from "~/app/http/controllers/app/team/api-key-new";
import { CreateApiKeySchema, DeleteApiKeySchema } from "~/app/http/validators/api-key";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import routes from "~/routes/web";

/**
 * POST /actions/:team/create-api-key. A rejected submission renders the new key form again with
 * a 400, keeping the typed name, the date and every checked scope beside the field's error.
 */
export const createApiKey = createAction(routes.teamAdminActions.apiKey.create, async (ctx) => {
	let result = await validate(ctx.formData, CreateApiKeySchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		let rejected = new Set(result.error.issues.map((issue) => issue.path?.at(0)));
		let name = ctx.formData.get("name");
		let expiresAt = ctx.formData.get("expires_at");
		let scopes = ctx.formData
			.getAll("scopes")
			.filter((scope): scope is string => typeof scope === "string");
		return renderNewApiKeyForm(
			{
				values: {
					name: typeof name === "string" ? name : "",
					expires_at: typeof expiresAt === "string" ? expiresAt : "",
					scopes,
				},
				issues: {
					name: rejected.has("name"),
					scopes: rejected.has("scopes") || scopes.length === 0,
				},
			},
			{ status: 400 },
		);
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
