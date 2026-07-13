/**
 * API v1 collection endpoints for the authenticated team's API keys: list (metadata
 * only, `api-keys:read`) and create (`api-keys:write`), up to the per-team limit.
 * The plaintext key is only ever returned once, in the create response.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BadRequest, Created } from "@pkg/http/status-code";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import type { SelectApiKey } from "~/database/schema";

import ApiKey, { MAX_API_KEYS_PER_TEAM } from "~/app/data/api-key";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { apiKeyScopes } from "~/database/schema";
import routes from "~/routes/web";

/** Maps an API-key row to the OLD APP's exact camelCase JSON shape, without its hash. */
function serializeApiKey(apiKey: SelectApiKey) {
	return {
		id: apiKey.id,
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

/** GET /api/v1/api-keys — lists the team's API keys (metadata only). */
export const apiKeysIndex = createAction(routes.api.v1.apiKeysIndex, {
	middleware: [requireApiKey("api-keys:read")],
	handler: async (ctx) => {
		let db = getServiceContainer().get(Database);
		let keys = await ApiKey.listByTeam(db, ctx.apiTeam.id);
		return apiSuccess({ apiKeys: keys.map(serializeApiKey) });
	},
});

/** POST /api/v1/api-keys — creates a new API key for the team, returning the plaintext key once. */
export const apiKeysCreate = createAction(routes.api.v1.apiKeysCreate, {
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

		let { record, key } = await ApiKey.create(db, ctx.apiTeam.id, {
			name: result.data.name,
			scopes: result.data.scopes,
			expires_at: result.data.expiresAt ?? null,
		});

		return apiSuccess({ apiKey: serializeApiKey(record), key }, Created);
	},
});
