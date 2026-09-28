/**
 * Tests for the job cost-ledger middleware: a delivered job owns its share of the batch's
 * single request and batch log event, plus the queue operations and the log event that are
 * its alone, so the ledger's figures match what Cloudflare bills a queue batch for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";

import { createAnalyticsEngine, createEnv } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { beforeEach, describe, expect, test, vi } from "vitest";

/** The dataset the ledger flushes to, captured by the cost module on import. */
let costs: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ COSTS: costs }),
}));

let { COST_RESOURCES } = await import("~/app/lib/cost-rates");
let { default: jobs } = await import("~/app/jobs");
let { costLedger } = await import("./cost-ledger");

beforeEach(() => {
	costs.reset();
});

/** The quantity the one written point recorded for `resource`. */
function quantity(resource: (typeof COST_RESOURCES)[number]): number {
	return costs.dataPoints[0]?.doubles?.[COST_RESOURCES.indexOf(resource)] ?? 0;
}

describe("costLedger", () => {
	test("charges a job its own log event plus its share of the batch's", async () => {
		let ctx = createJobContext(jobs.clean, { id: "message-1", attempts: 1, batchSize: 4 });

		await costLedger()(ctx, async () => {});

		expect(quantity("workerRequest")).toBeCloseTo(0.25, 9);
		expect(quantity("workerLogEvent")).toBeCloseTo(1.25, 9);
		expect(quantity("queueOperation")).toBe(2);
	});
});
