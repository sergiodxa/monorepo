/**
 * The management API's Idempotency-Key handling: a retried `POST` carrying the same key
 * is answered with the first attempt's stored response for 24 hours. Records live in the
 * caller's own tenant Durable Object, next to the data the requests change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ClaimOutcome, IdempotencyStore, IdempotencyStoreError } from "@sdxc/idempotency";
import type { IdempotencyProblems } from "@sdxc/idempotency/middleware";
import type { Result } from "@sdxc/result";

import { idempotency } from "@sdxc/idempotency/middleware";

import { managementProblem } from "~/app/http/lib/problem";

/** The catalog's four refusals, each carrying an `instance` like every management problem. */
const PROBLEMS: IdempotencyProblems = {
	idempotencyKeyMissing: (options) => managementProblem("idempotencyKeyMissing", options),
	idempotencyKeyInvalid: (options) => managementProblem("idempotencyKeyInvalid", options),
	idempotencyKeyInUse: (options) => managementProblem("idempotencyKeyInUse", options),
	idempotencyKeyReused: (options) => managementProblem("idempotencyKeyReused", options),
};

/**
 * Mounted after `managementTenant` and `managementRateLimit`, so the tenant stub is
 * published and a replay still spends budget. The tenant is fixed by which object holds
 * the record, so the scope names only the actor; the key is optional.
 *
 * @example
 * middleware: [managementAuth(auth), managementTenant(resolveStub), managementRateLimit(limiter, { bucket: "write" }), managementIdempotency]
 */
export const managementIdempotency = idempotency({
	store: (ctx): IdempotencyStore => ({
		/** The RPC stub types each answer as disposable; the value is the store's own `Result`. */
		claim: async (request) =>
			(await ctx.tenantStub.idempotencyClaim(request)) as Result<
				ClaimOutcome,
				IdempotencyStoreError
			>,
		complete: async (id, lease, response, expiresAt) =>
			(await ctx.tenantStub.idempotencyComplete(id, lease, response, expiresAt)) as Result<
				void,
				IdempotencyStoreError
			>,
		release: async (id, lease) =>
			(await ctx.tenantStub.idempotencyRelease(id, lease)) as Result<void, IdempotencyStoreError>,
	}),
	scope: (ctx) => `${ctx.managementCaller.actor.type}:${ctx.managementCaller.actor.id}`,
	ttl: "24 hours",
	prefix: "management",
	problems: PROBLEMS,
});
