/**
 * `POST /tenants/:tenantId/api-keys/:keyId/rotate` — mints a successor key
 * carrying the incumbent's own subject and scopes forward, and opens the
 * incumbent's overlap window in the same call.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RotateApiKeyResult } from "~/database/api-keys";

import {
	apiKeyEntitlementRequired,
	apiKeyNotFound,
	apiKeyPrefixNotSet,
	keyIdParam,
} from "~/app/http/controllers/management/api-keys/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let RotateApiKeyBodySchema = s.object({ overlap: s.optional(s.number()) });

/** Maps every `rotateApiKey` refusal onto its own `problem+json` response. */
function rotateApiKeyFailure(result: Exclude<RotateApiKeyResult, { ok: true }>): Response {
	if (result.reason === "not-found") return apiKeyNotFound();
	if (result.reason === "prefix-not-set") return apiKeyPrefixNotSet();
	if (result.reason === "entitlement-required") return apiKeyEntitlementRequired();

	return problem({
		type: "https://docs.example.com/errors/overlap-too-long",
		title: "The requested overlap window exceeds the longest one a rotation may open",
		status: 400,
	});
}

/**
 * Builds the `apiKeysRotate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.apiKeysRotate, createApiKeysRotateAction(options));
 */
export function createApiKeysRotateAction(options: ManagementControllerOptions) {
	return createAction(routes.apiKeysRotate, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "keys:write");
			if (refused) return refused;

			let keyId = keyIdParam(ctx);

			let parsed = parseBody(
				RotateApiKeyBodySchema,
				(await ctx.request.json().catch(() => null)) ?? {},
			);
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.rotateApiKey({
				keyId,
				overlap: parsed.data.overlap,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return rotateApiKeyFailure(result);

			return json(
				{ key: result.key, value: result.value, incumbentExpiresAt: result.incumbentExpiresAt },
				{ status: 200 },
			);
		},
	});
}
