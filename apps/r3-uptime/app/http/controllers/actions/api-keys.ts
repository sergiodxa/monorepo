/**
 * Form actions for creating and deleting API keys. Requires `requireRole("admin")`.
 * The newly-created plaintext key is stashed in a one-time session flash (read and
 * cleared by the list page) rather than shown directly here — there's no
 * client-side navigation state to pass it through, since every page here is a full
 * server render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/fetch-router";

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { Session } from "remix/session";

import ApiKey, { MAX_API_KEYS_PER_TEAM } from "~/app/data/api-key";
import { CreateApiKeySchema, DeleteApiKeySchema } from "~/app/http/validators/api-key";
import routes from "~/routes/web";

/** POST /actions/:team/create-api-key */
export async function createApiKey(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, CreateApiKeySchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: "Please check the API key details." });
		return redirect(routes.app.team.apiKeyNew.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);

	let count = await ApiKey.countByTeam(db, ctx.team.id);
	if (count >= MAX_API_KEYS_PER_TEAM) {
		return badRequest(`A team can have at most ${MAX_API_KEYS_PER_TEAM} API keys.`);
	}

	let { name, scopes, expires_at } = result.data;
	let { record, key } = await ApiKey.create(db, ctx.team.id, { name, scopes, expires_at });

	session?.flash("newApiKey", { name: record.name, key });
	return redirect(routes.app.team.apiKeys.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}

/** DELETE /actions/:team/delete-api-key */
export async function deleteApiKey(ctx: RequestContext<{ team: string }>) {
	let result = await validate(ctx.formData, DeleteApiKeySchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.apiKeys.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let apiKey = await ApiKey.findByIdForTeam(db, ctx.team.id, result.data.api_key_id);
	if (!apiKey) return notFound("Not Found");

	await ApiKey.deleteById(db, apiKey.id);

	session?.flash("toast", { intent: "success", message: `API key "${apiKey.name}" deleted.` });
	return redirect(routes.app.team.apiKeys.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
}
