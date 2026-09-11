/**
 * API v1 endpoint that deletes a single API key belonging to the authenticated
 * team, requiring `api-keys:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotFound } from "@sdxc/http/status-code";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import ApiKey from "~/app/data/api-key";
import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

const ApiKeyIdParams = s.object({ apiKeyId: typedId("key") });

/** DELETE /api/v1/api-keys/:apiKeyId — revokes an API key for the team. */
export const apiKeyDestroy = createAction(routes.api.v1.apiKeys.destroy, {
	middleware: [catchValidationError(), requireApiKey("api-keys:write")],
	handler: async (ctx) => {
		let { apiKeyId } = s.parse(ApiKeyIdParams, ctx.params);
		let existing = await ApiKey.findByIdForTeam(ctx.db, ctx.apiTeam.id, apiKeyId);
		if (!existing) return apiError("NOT_FOUND", "API key not found", NotFound);

		await ApiKey.deleteById(ctx.db, apiKeyId);
		return apiSuccess({ deleted: true });
	},
});
