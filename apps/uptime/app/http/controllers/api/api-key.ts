/**
 * API v1 endpoint that deletes a single API key belonging to the authenticated
 * team, requiring `api-keys:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { unwrap } from "@sdxc/result";
import { createAction } from "remix/router";

import catchValidationError from "~/app/http/middleware/catch-validation-error";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { API_KEY_ID_PARAMS } from "~/app/http/openapi/api-keys";
import { apiProblems, problemInstance } from "~/app/services/api-problems";
import { apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

/** DELETE /api/v1/api-keys/:apiKeyId — revokes an API key for the team. */
export const apiKeyDestroy = createAction(routes.api.v1.apiKeys.destroy, {
	middleware: [catchValidationError(), requireApiKey("api-keys:write")],
	handler: async (ctx) => {
		let { apiKeyId } = s.parse(API_KEY_ID_PARAMS, ctx.params);
		let existing = await ctx.models.apiKeys.inTeam(ctx.apiTeam.id).where({ id: apiKeyId }).first();
		if (!existing)
			return apiProblems.notFound({ detail: "API key not found", instance: problemInstance() });

		unwrap(await ctx.models.apiKeys.delete(apiKeyId));
		return apiSuccess({ deleted: true });
	},
});
