/**
 * Exercises the async-local ledger: `recordCost` is a no-op outside one and accumulates
 * across calls inside one, `flush` writes exactly one analytics data point with the
 * accumulated, priced totals and logs the same, and `flush` swallows a write failure
 * rather than letting instrumentation fail the request it measures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { describe, expect, test, vi } from "vitest";

import type { FlushEnv } from "./cost-ledger";

import { flush, recordCost, runWithLedger } from "./cost-ledger";
import {
	COST_RESOURCES,
	MODELLED_CPU_MS_PER_HANDLER,
	priceCostQuantities,
	RATE_CARD_VERSION,
} from "./cost-rates";

/** A `FlushEnv` whose `writeDataPoint` is a spy, so a test can assert what it was called with. */
function createFlushEnv(): FlushEnv & { writeDataPoint: ReturnType<typeof vi.fn> } {
	let writeDataPoint = vi.fn();
	return { ANALYTICS: { writeDataPoint }, writeDataPoint };
}

/** The single argument a mock function's first call was made with, throwing if it was never called. */
function firstCallArg<T>(mock: { mock: { calls: T[][] } }): T {
	let call = mock.mock.calls[0];
	if (!call) throw new Error("mock was never called");
	let [arg] = call;
	if (arg === undefined) throw new Error("mock was called with no arguments");
	return arg;
}

describe("recordCost", () => {
	test("does nothing outside a ledger", () => {
		expect(() => recordCost({ doRowsWritten: 1 })).not.toThrow();
	});
});

describe("runWithLedger and flush", () => {
	test("accumulates quantities from multiple recordCost calls inside the ledger", () => {
		let env = createFlushEnv();

		runWithLedger("tenant_1", "fetch", () => {
			recordCost({ doRowsWritten: 3, doRowsRead: 5 });
			recordCost({ doRowsWritten: 2 });
			flush(env);
		});

		expect(env.writeDataPoint).toHaveBeenCalledTimes(1);
		let point = firstCallArg(env.writeDataPoint);

		// One Worker request (the request's own share) and the fetch handler's modelled
		// CPU are folded in on top of whatever recordCost accumulated.
		let expectedQuantities = {
			workerRequests: 1,
			workerCpuMs: MODELLED_CPU_MS_PER_HANDLER.fetch,
			doRequests: 0,
			doDurationMs: 0,
			doRowsRead: 5,
			doRowsWritten: 5,
			doStorageGbDays: 0,
			d1Rows: 0,
			d1StorageGbDays: 0,
			kvReads: 0,
			kvMutations: 0,
			kvStorageGbDays: 0,
			analyticsPoints: 0,
			analyticsQueries: 0,
			queueOperations: 0,
			emailSent: 0,
		};

		expect(point.doubles.at(-1)).toBeCloseTo(priceCostQuantities(expectedQuantities), 12);
		expect(point.indexes).toEqual(["tenant_1"]);
		expect(point.blobs).toEqual(["fetch", "tenant_1", RATE_CARD_VERSION]);
	});

	test("a recordCost call made before any ledger opens never reaches a later one", () => {
		let env = createFlushEnv();

		// No ledger is open yet, so this is a no-op — nothing for a ledger opened
		// afterwards to have inherited.
		recordCost({ doRowsWritten: 100 });

		runWithLedger("tenant_1", "fetch", () => {
			flush(env);
		});

		let point = firstCallArg(env.writeDataPoint);
		let doRowsWrittenIndex = COST_RESOURCES.indexOf("doRowsWritten");
		expect(point.doubles[doRowsWrittenIndex]).toBe(0);
	});

	test("logs the same totals flush writes to analytics", async () => {
		let env = createFlushEnv();
		let sink = vi.fn();
		let log = new Log({ kind: "request", sink });

		await log.run(() => {
			return runWithLedger("tenant_2", "queue", () => {
				recordCost({ kvReads: 4 });
				flush(env);
			});
		});

		expect(sink).toHaveBeenCalledTimes(1);
		let record = firstCallArg(sink);
		expect(record["cost.tenantId"]).toBe("tenant_2");
		expect(record["cost.source"]).toBe("queue");
		expect(record["cost.rateCardVersion"]).toBe(RATE_CARD_VERSION);
		expect(record["cost.cents"]).toBeGreaterThan(0);
	});

	test("flush does nothing outside a ledger", () => {
		let env = createFlushEnv();
		expect(() => flush(env)).not.toThrow();
		expect(env.writeDataPoint).not.toHaveBeenCalled();
	});

	test("flush swallows a write failure rather than letting it propagate", () => {
		let env = createFlushEnv();
		env.writeDataPoint.mockImplementation(() => {
			throw new Error("analytics unavailable");
		});

		expect(() => {
			runWithLedger("tenant_1", "fetch", () => {
				flush(env);
			});
		}).not.toThrow();
	});
});
