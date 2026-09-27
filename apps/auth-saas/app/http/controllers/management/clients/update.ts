/**
 * `PATCH /tenants/:tenantId/clients/:clientId` — applies an RFC 7396 merge patch to
 * a client's editable record, so a caller sends only what changes (a list replaces
 * the stored one whole), refusing a change to `kind`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { json } from "@sdxc/http/response";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { UpdateClientResult } from "~/database/clients";

import {
	CLIENT_BODY_SCHEMA,
	clientEntitlementRequired,
	clientIdParam,
	clientNotFound,
	clientRecordValidationFailure,
	writableClient,
} from "~/app/http/controllers/management/clients/shared";
import { patchResource } from "~/app/http/lib/merge-patch";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** Maps every `updateClient` refusal onto its own `problem+json` response. */
function updateClientFailure(result: Exclude<UpdateClientResult, { ok: true }>): Response {
	if (result.reason === "not-found") return clientNotFound();

	if (result.reason === "kind-immutable") {
		return managementProblem("kindImmutable");
	}

	if (result.reason === "entitlement-required") return clientEntitlementRequired();

	return clientRecordValidationFailure(result);
}

/**
 * Builds the `clientsUpdate` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsUpdate, createClientsUpdateAction(options));
 */
export function createClientsUpdateAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsUpdate, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "clients:write");
			if (refused) return refused;

			let clientId = clientIdParam(ctx);

			let current = await ctx.tenantStub.readClient({ clientId });
			if (!current.ok) return clientNotFound();

			let patched = await patchResource(
				ctx.request,
				writableClient(current.client),
				CLIENT_BODY_SCHEMA,
			);
			if (!patched.ok) return patched.response;

			let result = await ctx.tenantStub.updateClient({ clientId, ...patched.next });
			if (!result.ok) return updateClientFailure(result);

			return json(result.client, { status: 200 });
		},
	});
}
