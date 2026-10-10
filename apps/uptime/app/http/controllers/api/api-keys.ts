/**
 * API v1 collection endpoints for the authenticated team's API keys: list (metadata
 * only, `api-keys:read`) and create (`api-keys:write`), up to the per-team limit.
 * The plaintext key is only ever returned once, in the create response.
 *
 * A key can only create a key no more powerful than itself — see the scope check in
 * `apiKeysCreate`. Without that, `api-keys:write` would be an escalation to every other
 * scope rather than a permission alongside them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Created } from "@sdxc/http/status-code";
import { InvalidCursorError, Pagination } from "@sdxc/pagination";
import { issuesFrom } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createController } from "remix/router";

import type { SelectApiKey } from "~/database/schema";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import { idempotentUnstored } from "~/app/http/middleware/idempotency";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { CREATE_API_KEY_BODY } from "~/app/http/openapi/api-keys";
import { MAX_API_KEYS_PER_TEAM } from "~/app/models/api-keys";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import { apiPage, NEWEST_FIRST, PAGING } from "~/app/services/pagination";
import { encodeId } from "~/app/services/typed-id";
import { apiKeysRoutes } from "~/routes/api-groups";

/** Maps an API-key row to its public JSON shape (camelCase fields), omitting the key hash. */
function serializeApiKey(apiKey: SelectApiKey) {
	return {
		id: encodeId("key", apiKey.id),
		name: apiKey.name,
		scopes: apiKey.scopes,
		createdAt: apiKey.created_at,
		lastUsedAt: apiKey.last_used_at,
		expiresAt: apiKey.expires_at,
		keyPrefix: apiKey.key_prefix,
	};
}

export default createController(apiKeysRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/api-keys — lists the team's API keys (metadata only). */
		apiKeysIndex: {
			middleware: [requireApiKey("api-keys:read")],
			handler: async (ctx) => {
				let params = PAGING.parse(ctx.url.searchParams);
				if (isFailure(params))
					return apiProblems.badRequest({
						detail: params.error.message,
						instance: problemInstance(),
					});

				// Chaining returns new queries, so the same one both counts and pages.
				let query = ctx.models.apiKeys.inTeam(ctx.apiTeam.id);

				let page = await Pagination.byKeyset(query, {
					orderBy: NEWEST_FIRST,
					cursor: params.data.cursor,
					limit: params.data.perPage,
				});

				if (isFailure(page)) {
					if (page.error instanceof InvalidCursorError) {
						return apiProblems.badRequest({
							detail: page.error.message,
							instance: problemInstance(),
						});
					}
					return apiProblems.internal({ detail: page.error.message, instance: problemInstance() });
				}

				return apiPage({ apiKeys: page.data.items.map(serializeApiKey) }, page.data, {
					url: ctx.url,
					perPage: params.data.perPage,
					total: await query.count(),
				});
			},
		},

		/** POST /api/v1/api-keys — creates a new API key for the team, returning the plaintext key once. */
		apiKeysCreate: {
			middleware: [requireApiKey("api-keys:write"), idempotentUnstored],
			handler: async (ctx) => {
				let existingCount = await ctx.models.apiKeys.inTeam(ctx.apiTeam.id).count();
				if (existingCount >= MAX_API_KEYS_PER_TEAM) {
					return apiProblems.limitExceeded({
						detail: "API key limit reached for this team",
						instance: problemInstance(),
					});
				}

				let result = await validate(ctx.request, CREATE_API_KEY_BODY);
				if (isFailure(result)) {
					return apiProblems.validationError({
						instance: problemInstance(),
						extensions: { errors: issuesFrom(result.error) },
					});
				}

				/**
				 * A key may only grant scopes it already holds; otherwise `api-keys:write`
				 * could mint a broader copy of itself, escalating into every other scope
				 * including the billable `ping:trigger`.
				 */
				let held = new Set<string>(ctx.apiKey.scopes);
				let ungranted = result.data.scopes.filter((scope) => !held.has(scope));
				if (ungranted.length > 0) {
					return apiProblems.forbidden({
						detail: `API key cannot grant scopes it does not hold: ${ungranted.join(", ")}`,
						instance: problemInstance(),
					});
				}

				let { record, key } = unwrap(
					await ctx.models.apiKeys.issue(ctx.apiTeam.id, {
						name: result.data.name,
						scopes: result.data.scopes,
						expires_at: result.data.expiresAt ?? null,
					}),
				);

				return apiSuccess({ apiKey: serializeApiKey(record), key }, Created);
			},
		},
	},
});
