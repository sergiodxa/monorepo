/**
 * `POST /tenants/:tenantId/session-policy` — writes a partial update to the
 * five knobs governing this tenant's own session, idle and refresh-token
 * lifetimes, gated on the paid entitlement that sells the ability to shorten
 * the platform defaults to a number a tenant's own compliance obligation
 * names. A field left out of the body leaves that column untouched.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntitlementSnapshot } from "@sdxc/billing/middleware";
import type { RequestContext } from "remix/router";

import billing, { requireEntitlement } from "@sdxc/billing/middleware";
import { MemoryBilling } from "@sdxc/billing/providers/memory";
import { NoopProvider } from "@sdxc/flags/provider/noop";
import { json } from "@sdxc/http/response";
import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import type { ManagementControllerOptions } from "~/app/http/controllers/management/shared";
import type { SetSessionPolicyResult } from "~/database/tenant-do";

import { operationInputProblem } from "~/app/http/lib/parse-body";
import { managementProblem } from "~/app/http/lib/problem";
import { requireScope } from "~/app/http/lib/require-scope";
import { managementAuth } from "~/app/http/middleware/management-auth";
import { managementRateLimit } from "~/app/http/middleware/management-rate-limit";
import { managementTenant } from "~/app/http/middleware/management-tenant";
import { TENANT_SESSION_POLICY_SET } from "~/app/http/openapi/tenants";
import { EntitlementProvider } from "~/app/lib/entitlement-provider";
import Tenant from "~/app/models/tenant";
import TenantEntitlement from "~/app/models/tenant-entitlement";
import { buildTenantFlagContext, entitlementFlags } from "~/app/services/billing/entitlement-flags";
import routes from "~/routes/management";

/**
 * The entitlement-namespace resolver alone, evaluating straight over whatever
 * `EvaluationContext` a caller hands it rather than a rule set read from a
 * store — the same resolution `entitlement.*` keys get everywhere else in the
 * catalog, reused here without pulling in the platform's own KV-backed
 * engine, which a route gating on one boolean has no other reason to open.
 */
let entitlementProvider = new EntitlementProvider(new NoopProvider());

/**
 * A billing platform this route mounts only to satisfy `billing()`'s own
 * required option — nothing here ever reads `ctx.billing`, since this route
 * gates on an entitlement rather than performing a billing operation of its
 * own.
 */
let noopBillingProvider = new MemoryBilling();

/**
 * Resolves the `session_policy` entitlement `requireEntitlement` gates this
 * route on, reading the tenant and its entitlement projection straight off
 * the control plane and evaluating the catalog's own flag over them, so an
 * "internal" segment override or a future kill switch on this flag governs
 * the gate the same way it already governs everywhere else the catalog is
 * read.
 *
 * @param ctx - The request context `managementAuth` has already resolved a caller onto.
 * @returns The snapshot `requireEntitlement` checks, or `null` for a tenant no longer on the control plane.
 */
async function resolveSessionPolicyEntitlements(
	ctx: RequestContext,
): Promise<EntitlementSnapshot | null> {
	let tenant = await Tenant.findById(ctx.db, ctx.managementCaller.tenantId);
	if (!tenant) return null;

	let entitlement = await TenantEntitlement.findByTenant(ctx.db, tenant.id);

	let flag = entitlementFlags.session_policy;
	if (!flag)
		throw new Error('entitlementFlags carries no flag for the "session_policy" feature slug.');

	let context = buildTenantFlagContext(tenant, entitlement);
	let resolution = await entitlementProvider.resolveBoolean(flag.key, flag.defaultValue, context);
	let entitled = resolution.value;

	return { products: entitlement?.products ?? [], features: { session_policy: entitled } };
}

/** A caller whose tenant's plan does not include customizing session lifetimes. */
function sessionPolicyNotEntitled(): Response {
	return managementProblem("entitlementRequired", {
		detail: "This tenant is not entitled to customize its session policy on its current plan.",
	});
}

/** Maps a `setSessionPolicy` refusal onto the same `problem+json` validation failure a refused body answers with. */
function setSessionPolicyFailure(result: Extract<SetSessionPolicyResult, { ok: false }>): Response {
	return managementProblem("validationFailed", {
		detail: "The request body did not pass validation.",
		extensions: {
			errors: [{ pointer: `/policy/${result.field}`, code: "invalid", message: result.message }],
		},
	});
}

/**
 * Builds the `tenantSessionPolicySet` action.
 *
 * @param options - The auth, rate-limit and tenant-stub options every
 * management resource controller shares.
 * @returns The action, ready for `router.map`.
 * @example
 * router.map(routes.tenantSessionPolicySet, createTenantSessionPolicySetAction(options));
 */
export function createTenantSessionPolicySetAction(options: ManagementControllerOptions) {
	return createAction(routes.tenantSessionPolicySet, {
		middleware: [
			managementAuth({
				issuer: options.issuer,
				resolveDashboardSubjectId: options.resolveDashboardSubjectId,
			}),
			managementTenant(options.resolveStub),
			managementRateLimit(options.limiter, { bucket: "write" }),
			billing({ provider: noopBillingProvider, entitlements: resolveSessionPolicyEntitlements }),
			requireEntitlement("session_policy", { onDenied: sessionPolicyNotEntitled }),
		],
		handler: async (ctx) => {
			let refused = requireScope(ctx, "tenant:write");
			if (refused) return refused;

			let input = await TENANT_SESSION_POLICY_SET.parse(ctx.request, ctx.params);
			if (isFailure(input)) return operationInputProblem(input.error);

			let result = await ctx.tenantStub.setSessionPolicy({
				policy: input.data.body.policy,
				actor: ctx.managementCaller.actor,
			});
			if (!result.ok) return setSessionPolicyFailure(result);

			return json(
				{ policy: result.policy, sessionsShortened: result.sessionsShortened },
				{ status: 200 },
			);
		},
	});
}
