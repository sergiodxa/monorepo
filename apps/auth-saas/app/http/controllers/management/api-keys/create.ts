/**
 * `POST /tenants/:tenantId/api-keys` — mints an API key for one of the
 * tenant's own end users, narrowing rather than creating an authorization.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { CreateApiKeyResult } from "~/database/api-keys";

import {
	apiKeyEntitlementRequired,
	apiKeyPrefixNotSet,
} from "~/app/http/controllers/management/api-keys/shared";
import { parseBody } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

let CreateApiKeyBodySchema = s.object({
	subjectId: s.string(),
	name: s.string(),
	scopes: s.array(s.string()),
	expiresAt: s.optional(s.number()),
});

/** Maps every `createApiKey` refusal onto its own `problem+json` response. */
function createApiKeyFailure(result: Exclude<CreateApiKeyResult, { ok: true }>): Response {
	if (result.reason === "prefix-not-set") return apiKeyPrefixNotSet();
	if (result.reason === "entitlement-required") return apiKeyEntitlementRequired();

	if (result.reason === "scope-not-held") {
		return managementProblem("scopeNotHeld", {
			detail: `"${result.scope}" is not a scope this subject holds.`,
		});
	}

	return managementProblem("expiryTooFar");
}

/**
 * Builds the `apiKeysCreate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.apiKeysCreate, createApiKeysCreateAction(options));
 */
export function createApiKeysCreateAction(options: ManagementControllerOptions) {
	return createAction(routes.apiKeysCreate, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "keys:write");
			if (refused) return refused;

			let parsed = parseBody(CreateApiKeyBodySchema, await ctx.request.json().catch(() => null));
			if (!parsed.ok) return parsed.response;

			let result = await ctx.tenantStub.createApiKey({
				...parsed.data,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return createApiKeyFailure(result);

			return json({ key: result.key, value: result.value }, { status: 201 });
		},
	});
}
