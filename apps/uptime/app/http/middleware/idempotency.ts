/**
 * `Idempotency-Key` support for the API's create endpoints: a client that lost a response
 * retries with the same key and gets the original outcome, never a second resource.
 * Records live in D1, scoped to the API key that sent them, for 24 hours.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IdempotencyOptions, IdempotencyProblems } from "@sdxc/idempotency/middleware";

import { DataTableStore } from "@sdxc/idempotency/data-table";
import { idempotency } from "@sdxc/idempotency/middleware";

import { apiProblems, problemInstance } from "~/app/services/api-problems";

/**
 * The catalog's idempotency refusals, each with its own `instance` like every other API
 * problem.
 */
const PROBLEMS: IdempotencyProblems = {
	idempotencyKeyMissing: (options) =>
		apiProblems.idempotencyKeyMissing({ ...options, instance: problemInstance() }),
	idempotencyKeyInvalid: (options) =>
		apiProblems.idempotencyKeyInvalid({ ...options, instance: problemInstance() }),
	idempotencyKeyInUse: (options) =>
		apiProblems.idempotencyKeyInUse({ ...options, instance: problemInstance() }),
	idempotencyKeyReused: (options) =>
		apiProblems.idempotencyKeyReused({ ...options, instance: problemInstance() }),
};

/**
 * What every API registration shares. The key stays optional so clients that send none
 * behave as before, and the scope is the API key, so one key's records never answer another.
 */
const OPTIONS: IdempotencyOptions = {
	store: (ctx) => new DataTableStore(ctx.db),
	scope: (ctx) => `api-key:${ctx.apiKey.id}`,
	ttl: "24 hours",
	prefix: "uptime-api",
	problems: PROBLEMS,
};

/**
 * Claims, stores and replays a create endpoint's outcome. Every outcome below `500` is
 * replayed; a `5xx` releases the key. The create endpoints answer a `5xx` only when the
 * write itself fails, so a retry after one runs the write that never happened.
 *
 * @example monitorsCreate: { middleware: [requireApiKey("monitors:write"), idempotent], handler }
 */
export default idempotency(OPTIONS);

/**
 * For a create whose response carries a secret shown once: concurrent duplicates are still
 * refused while the first runs, and the response itself is never stored, so the secret
 * exists only in the one response. A retry after completion runs the create again.
 */
export const idempotentUnstored = idempotency({ ...OPTIONS, shouldStore: () => false });
