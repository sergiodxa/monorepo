/**
 * API v1 endpoint that deletes a single API key belonging to the authenticated
 * team, requiring `api-keys:write` via `requireApiKey`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { NotFound } from "@pkg/http/status-code";
import { getServiceContainer } from "@pkg/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

import ApiKey from "~/app/data/api-key";
import requireApiKey from "~/app/http/middleware/require-api-key";
import { apiError, apiSuccess } from "~/app/services/api-response";
import routes from "~/routes/web";

const ApiKeyIdParams = s.object({ apiKeyId: s.string() });

/** DELETE /api/v1/api-keys/:apiKeyId — revokes an API key for the team. */
export const apiKeyDestroy = createAction(routes.api.v1.apiKeys.destroy, {
	middleware: [requireApiKey("api-keys:write")],
	handler: async (ctx) => {
		let { apiKeyId } = s.parse(ApiKeyIdParams, ctx.params);
		let db = getServiceContainer().get(Database);
		let existing = await ApiKey.findByIdForTeam(db, ctx.apiTeam.id, apiKeyId);
		if (!existing) return apiError("NOT_FOUND", "API key not found", NotFound);

		await ApiKey.deleteById(db, apiKeyId);
		return apiSuccess({ deleted: true });
	},
});
