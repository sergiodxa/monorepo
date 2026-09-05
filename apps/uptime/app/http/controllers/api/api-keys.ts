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

import { BadRequest, Created, Forbidden } from "@sdxc/http/status-code";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createController } from "remix/router";

import type { SelectApiKey } from "~/database/schema";

import ApiKey, { MAX_API_KEYS_PER_TEAM } from "~/app/data/api-key";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { encodeId } from "~/app/services/typed-id";
import { apiKeyScopes } from "~/database/schema";
import routes from "~/routes/web";

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

const CreateApiKeySchema = s.object({
	name: s.string().pipe(checks.minLength(1), checks.maxLength(255)),
	scopes: s
		.array(s.enum_(apiKeyScopes))
		.refine((value) => value.length > 0, "At least one scope is required."),
	expiresAt: s.optional(
		s
			.string()
			.refine((value: string) => Number.isFinite(new Date(value).getTime()), "Invalid date/time.")
			.transform((value: string) => new Date(value).getTime()),
	),
});

/** Route leaves this controller handles, grouped for a single `router.map()` call. */
export const apiKeysRoutes = {
	apiKeysIndex: routes.api.v1.apiKeys.index,
	apiKeysCreate: routes.api.v1.apiKeys.create,
};

export default createController(apiKeysRoutes, {
	middleware: [catchValidationError()],
	actions: {
		/** GET /api/v1/api-keys — lists the team's API keys (metadata only). */
		apiKeysIndex: {
			middleware: [requireApiKey("api-keys:read")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);
				let keys = await ApiKey.listByTeam(db, ctx.apiTeam.id);
				return apiSuccess({ apiKeys: keys.map(serializeApiKey) });
			},
		},

		/** POST /api/v1/api-keys — creates a new API key for the team, returning the plaintext key once. */
		apiKeysCreate: {
			middleware: [requireApiKey("api-keys:write")],
			handler: async (ctx) => {
				let db = getServiceContainer().get(Database);

				let existingCount = await ApiKey.countByTeam(db, ctx.apiTeam.id);
				if (existingCount >= MAX_API_KEYS_PER_TEAM) {
					return apiError("LIMIT_EXCEEDED", "API key limit reached for this team", BadRequest);
				}

				let result = await validate(ctx.request, CreateApiKeySchema);
				if (isFailure(result)) {
					return apiError(
						"VALIDATION_ERROR",
						result.error.issues.map((issue) => issue.message).join(", "),
						BadRequest,
					);
				}

				/**
				 * A key may only grant scopes it already holds; otherwise `api-keys:write`
				 * could mint a broader copy of itself, escalating into every other scope
				 * including the billable `ping:trigger`.
				 */
				let held = new Set<string>(ctx.apiKey.scopes);
				let ungranted = result.data.scopes.filter((scope) => !held.has(scope));
				if (ungranted.length > 0) {
					return apiError(
						"FORBIDDEN",
						`API key cannot grant scopes it does not hold: ${ungranted.join(", ")}`,
						Forbidden,
					);
				}

				let { record, key } = await ApiKey.create(db, ctx.apiTeam.id, {
					name: result.data.name,
					scopes: result.data.scopes,
					expires_at: result.data.expiresAt ?? null,
				});

				return apiSuccess({ apiKey: serializeApiKey(record), key }, Created);
			},
		},
	},
});
