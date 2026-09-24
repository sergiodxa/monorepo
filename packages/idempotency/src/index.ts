/**
 * Public surface of the idempotency package: the `Idempotency-Key` field, the request
 * fingerprint, the store contract the middleware claims through, and the problem entries
 * an API's catalog adopts. The middleware, stores and client helpers live on subpaths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { ReadIdempotencyKeyOptions } from "./header.js";
export type { ClaimOutcome, ClaimRequest, IdempotencyStore, StoredResponse } from "./types.js";

export { IdempotencyKeyError, IdempotencyStoreError } from "./errors.js";
export { fingerprint } from "./fingerprint.js";
export { formatIdempotencyKey, IDEMPOTENCY_KEY_HEADER, readIdempotencyKey } from "./header.js";
export { IDEMPOTENCY_PROBLEM_ENTRIES } from "./problems.js";
