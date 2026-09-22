/**
 * `POST /tenants/:tenantId/clients/:clientId/secrets/:secretId/revoke` —
 * closes one secret's window immediately, refusing to take a confidential
 * client's last live secret.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { RevokeClientSecretResult } from "~/database/clients";

import { problem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import routes from "~/routes/management";

/** Parses and requires the `:clientId`/`:secretId` path params this route matches. */
function secretParams(ctx: { params: Record<string, string | undefined> }): {
	clientId: string;
	secretId: string;
} {
	return s.parse(s.object({ clientId: s.string(), secretId: s.string() }), ctx.params);
}

/** A secret named in this route's own path that this client does not hold. */
function secretNotFound(): Response {
	return problem({
		type: "https://docs.example.com/errors/not-found",
		title: "No such secret exists for this client",
		status: 404,
	});
}

/** Maps every `revokeClientSecret` refusal onto its own `problem+json` response. */
function revokeClientSecretFailure(
	result: Exclude<RevokeClientSecretResult, { ok: true }>,
): Response {
	if (result.reason === "not-found") return secretNotFound();

	return problem({
		type: "https://docs.example.com/errors/last-live-secret",
		title: "This client's last live secret may not be revoked",
		status: 409,
	});
}

/**
 * Builds the `clientsRevokeSecret` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.clientsRevokeSecret, createClientsRevokeSecretAction(options));
 */
export function createClientsRevokeSecretAction(options: ManagementControllerOptions) {
	return createAction(routes.clientsRevokeSecret, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx.managementCaller, "clients:write");
			if (refused) return refused;

			let { clientId, secretId } = secretParams(ctx);

			let result = await ctx.tenantStub.revokeClientSecret({ clientId, secretId });
			if (!result.ok) return revokeClientSecretFailure(result);

			return new Response(null, { status: 204 });
		},
	});
}
