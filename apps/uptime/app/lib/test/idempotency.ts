/**
 * Test helper for the `Idempotency-Key` refusals a create endpoint documents. A request
 * still in flight cannot be held open inside one test, so the helper turns the stored
 * outcome back into a live claim, which is exactly what a concurrent retry would find.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { idempotencyKeys } from "@sdxc/idempotency/data-table";

/**
 * Marks every idempotency record as claimed by a request that is still running, so the
 * next request carrying one of those keys answers `409 idempotency-key-in-use`.
 *
 * @param db - The test database the endpoint wrote its records to.
 * @example await dispatch(db, create('"k"')); await markInFlight(db); await dispatch(db, create('"k"')); // 409
 */
export async function markInFlight(db: Database): Promise<void> {
	await db.updateMany(
		idempotencyKeys,
		{ state: "in-flight", response: null, lease_expires_at: Date.now() + 60_000 },
		{ where: {} },
	);
}
