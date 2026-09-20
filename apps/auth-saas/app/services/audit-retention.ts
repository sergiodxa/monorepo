/**
 * Sweeps one tenant's audit log down to its own retention window, calling the
 * tenant object's own `enforceAuditRetention` repeatedly while a call reports a
 * full batch, the same shape `closeTenantMeteringDay` and the other per-tenant
 * jobs in this file's neighborhood already use.
 *
 * Nothing here runs on a schedule yet — a scheduled job, once one exists, calls
 * `sweepAuditRetention` for every tenant, the same way the mail rate limit's and
 * the entitlement projection's own sweeps are still waiting on one shared
 * trigger, and the tenant object's own alarm-driven sweeps already ship unwired
 * to any control-plane cron.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type Tenant from "~/database/tenant-do";

/** How many rows one call to the tenant object may remove, when a caller does not choose. */
const DEFAULT_LIMIT = 500;

/**
 * Caps how many times one sweep call re-enters the tenant object. A pathological
 * backlog stops here and waits for this function's own next call, rather than
 * holding a Worker request open indefinitely — the same bound the tenant
 * object's own alarm loop already applies to each of its sweeps.
 */
const MAX_ITERATIONS = 20;

export interface SweepAuditRetentionInput {
	/** How many rows one call to the tenant object may remove. */
	limit?: number;
	/** The clock to measure the tenant's retention window against; defaults to now. */
	now?: number;
}

export interface SweepAuditRetentionResult {
	/** Rows deleted across every call this sweep made. */
	deleted: number;
	/** The oldest row's `at` still on hand once the sweep stopped, or `null` when the table is now empty. */
	oldestRemaining: number | null;
}

/**
 * Sweeps one tenant's audit log, calling `enforceAuditRetention` again whenever
 * a call comes back with a full batch, so a backlog past the retention window
 * is cleared in one sweep rather than one row's worth per call.
 *
 * @param stub - The tenant's Durable Object stub.
 * @param input - How many rows one call may remove, and the clock to measure
 * the tenant's own retention window against.
 * @returns How many rows this sweep deleted in total, and the oldest row left.
 */
export async function sweepAuditRetention(
	stub: DurableObjectStub<Tenant>,
	input: SweepAuditRetentionInput = {},
): Promise<SweepAuditRetentionResult> {
	let limit = input.limit ?? DEFAULT_LIMIT;
	let deleted = 0;
	let oldestRemaining: number | null = null;

	for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
		let result = await stub.enforceAuditRetention({ now: input.now, limit });
		deleted += result.deleted;
		oldestRemaining = result.oldestRemaining;
		if (result.deleted < limit) break;
	}

	return { deleted, oldestRemaining };
}
