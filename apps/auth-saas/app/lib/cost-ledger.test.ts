/**
 * Exercises the async-local ledger: `recordCost` is a no-op outside one and accumulates
 * inside one, `flush` writes one data point Analytics Engine accepts with the priced totals
 * and logs the same, and swallows a write failure rather than failing the request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAnalyticsEngine } from "@sdxc/cloudflare-mocks";
import { Log } from "@sdxc/logger";
import { describe, expect, test, vi } from "vitest";

import type { FlushEnv } from "./cost-ledger";

import { flush, recordCost, runWithLedger } from "./cost-ledger";
import {
	COST_RESOURCES,
	createCostQuantities,
	MODELLED_CPU_MS_PER_HANDLER,
	MODELLED_LOG_EVENTS_PER_HANDLER,
	priceCostQuantities,
	RATE_CARD_VERSION,
} from "./cost-rates";

/** A `FlushEnv` over a recording dataset that enforces Analytics Engine's per-point limits. */
function createFlushEnv() {
	let analytics = createAnalyticsEngine();
	let env: FlushEnv = { ANALYTICS: analytics };
	return { env, analytics };
}

/** The one data point `flush` wrote, throwing when it wrote none or more than one. */
function onlyDataPoint(analytics: ReturnType<typeof createAnalyticsEngine>) {
	let points = analytics.dataPoints;
	if (points.length !== 1) throw new Error(`expected one data point, got ${points.length}`);
	let [point] = points;
	if (!point) throw new Error("expected one data point");
	return point;
}

/** The quantities a data point carries in `blob4`, keyed by resource. */
function quantitiesOf(point: AnalyticsEngineDataPoint): Record<string, number> {
	let encoded = point.blobs?.[3];
	if (typeof encoded !== "string") throw new Error("data point carries no quantities");
	let values = encoded.split(",").map(Number);
	return Object.fromEntries(
		COST_RESOURCES.map((resource, index) => [resource, values[index] ?? Number.NaN]),
	);
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
		let { env, analytics } = createFlushEnv();

		runWithLedger("tenant_1", "fetch", () => {
			recordCost({ doRowsWritten: 3, doRowsRead: 5 });
			recordCost({ doRowsWritten: 2 });
			flush(env);
		});

		let point = onlyDataPoint(analytics);
		let expectedQuantities = {
			...createCostQuantities(),
			workerRequests: 1,
			workerCpuMs: MODELLED_CPU_MS_PER_HANDLER.fetch,
			workerLogEvents: MODELLED_LOG_EVENTS_PER_HANDLER.fetch,
			doRowsRead: 5,
			doRowsWritten: 5,
		};

		expect(quantitiesOf(point)).toEqual(expectedQuantities);
		expect(point.doubles).toHaveLength(1);
		expect(point.doubles?.[0]).toBeCloseTo(priceCostQuantities(expectedQuantities), 12);
		expect(point.indexes).toEqual(["tenant_1"]);
		expect(point.blobs?.slice(0, 3)).toEqual(["fetch", "tenant_1", RATE_CARD_VERSION]);
	});

	test("writes a point within Analytics Engine's limits with every resource metered", () => {
		let { env, analytics } = createFlushEnv();
		let everyResource = Object.fromEntries(COST_RESOURCES.map((resource) => [resource, 1e9]));

		runWithLedger("tenant_1", "scheduled", () => {
			recordCost(everyResource);
			flush(env);
		});

		expect(COST_RESOURCES.length).toBeGreaterThan(19);
		expect(quantitiesOf(onlyDataPoint(analytics)).d1RowsRead).toBe(1e9);
	});

	test("a recordCost call made before any ledger opens never reaches a later one", () => {
		let { env, analytics } = createFlushEnv();

		recordCost({ doRowsWritten: 100 });

		runWithLedger("tenant_1", "fetch", () => {
			flush(env);
		});

		expect(quantitiesOf(onlyDataPoint(analytics)).doRowsWritten).toBe(0);
	});

	test("logs the same totals flush writes to analytics", async () => {
		let { env } = createFlushEnv();
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
		let { env, analytics } = createFlushEnv();
		expect(() => flush(env)).not.toThrow();
		expect(analytics.dataPoints).toHaveLength(0);
	});

	test("flush swallows a write failure rather than letting it propagate", () => {
		let writeDataPoint = vi.fn(() => {
			throw new Error("analytics unavailable");
		});
		let env: FlushEnv = { ANALYTICS: { writeDataPoint } };

		expect(() => {
			runWithLedger("tenant_1", "fetch", () => {
				flush(env);
			});
		}).not.toThrow();
	});
});
