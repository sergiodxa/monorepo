/**
 * Exercises `sweepAuditRetention`: it calls the tenant's own
 * `enforceAuditRetention` again whenever a call reports a full batch, and
 * stops as soon as one does not.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import { sweepAuditRetention } from "./audit-retention";

/** A stub answering `enforceAuditRetention` from a fixed queue of batch sizes, recording every call. */
function stubDeleting(batches: number[], limit: number) {
	let calls: Array<{ limit?: number; now?: number }> = [];
	let remaining = [...batches];

	let stub = {
		enforceAuditRetention: async (input: { limit?: number; now?: number }) => {
			calls.push(input);
			let deleted = remaining.shift() ?? 0;
			return { deleted, oldestRemaining: deleted > 0 ? 1_700_000_000_000 : null };
		},
	} as unknown as DurableObjectStub<Tenant>;

	return { stub, calls, limit };
}

describe("sweepAuditRetention", () => {
	test("stops after one call when the batch was not full", async () => {
		let { stub, calls } = stubDeleting([10], 500);

		let result = await sweepAuditRetention(stub);

		expect(result).toEqual({ deleted: 10, oldestRemaining: 1_700_000_000_000 });
		expect(calls).toHaveLength(1);
	});

	test("calls again while a batch comes back full, until one does not", async () => {
		let { stub, calls } = stubDeleting([5, 5, 2], 5);

		let result = await sweepAuditRetention(stub, { limit: 5 });

		expect(result).toEqual({ deleted: 12, oldestRemaining: 1_700_000_000_000 });
		expect(calls).toHaveLength(3);
		expect(calls.every((call) => call.limit === 5)).toBe(true);
	});

	test("answers deleted: 0 and no oldest row when there is nothing to sweep", async () => {
		let { stub } = stubDeleting([0], 500);

		let result = await sweepAuditRetention(stub);

		expect(result).toEqual({ deleted: 0, oldestRemaining: null });
	});

	test("passes the given clock through to every call", async () => {
		let { stub, calls } = stubDeleting([1], 500);

		await sweepAuditRetention(stub, { now: 1_800_000_000_000 });

		expect(calls).toEqual([{ limit: 500, now: 1_800_000_000_000 }]);
	});
});
