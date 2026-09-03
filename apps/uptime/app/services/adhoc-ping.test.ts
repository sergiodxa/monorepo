/**
 * Tests `recordAdhocPing`: one Analytics Engine data point under the shared `adhoc`
 * monitor id, and one billed event keyed on the ping's own id and charged to the team's
 * owner, with no `monitorId` key so it never surfaces on a monitor's usage card. Both
 * are handed to `waitUntil` rather than awaited, since the caller already has its result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UsageEvent } from "@sdxc/billing";
import type { AnalyticsEngineMock } from "@sdxc/cloudflare-mocks";

import { BillingError } from "@sdxc/billing";
import { createAnalyticsEngine, createEnv } from "@sdxc/cloudflare-mocks";
import { failure } from "@sdxc/result";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { createTestBilling } from "~/app/lib/test/billing";

import type { AdhocPing } from "./adhoc-ping";

/**
 * The dataset `writePingResult` reports to. It lives at module scope because the module
 * under test captures `env` on import, and it enforces the platform's per-point limits, so
 * a point too large to be ingested fails here instead of vanishing in production.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/**
 * Work deferred past the caller's response. Held rather than dropped so a test can await
 * the ingestion the caller is deliberately not made to wait for.
 */
let deferred: Promise<unknown>[] = [];

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ PING_RESULTS: pingResults }),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

let { ADHOC_MONITOR_ID, recordAdhocPing } = await import("./adhoc-ping");

/**
 * The platform the service bills against, with the one call `ingestPings` makes spied on.
 * The platform is real — only the observation is added — so the events asserted below are
 * the ones the service actually built.
 */
let billing = createTestBilling();
let realIngest = billing.usage.ingest.bind(billing.usage);
let ingestMock = vi.spyOn(billing.usage, "ingest");

/** `ingestPings` logs its own failures; the assertions read the calls instead. */
vi.spyOn(console, "error").mockImplementation(() => {});

beforeEach(() => {
	pingResults.reset();
	ingestMock.mockClear();
	ingestMock.mockImplementation(realIngest);
	deferred = [];
});

/** One performed ad-hoc ping, up in 12ms unless a test says otherwise. */
function adhocPing(overrides: Partial<AdhocPing> = {}): AdhocPing {
	return {
		id: "ping-1",
		team: { id: "team-1", owner_id: "owner-1" },
		status: "up",
		responseTimeMs: 12,
		...overrides,
	};
}

/** Records `ping` against the platform the service is handed in production. */
function record(ping: AdhocPing = adhocPing()): void {
	recordAdhocPing(billing, ping);
}

/** Every event the service handed the platform, flattened across the calls it made. */
function ingestedEvents(): UsageEvent[] {
	return ingestMock.mock.calls.flatMap(([events]) => [...events]);
}

describe("recordAdhocPing analytics", () => {
	test("writes one data point under the shared adhoc monitor id, indexed by team", async () => {
		record();

		expect(pingResults.dataPoints).toEqual([
			{
				blobs: [ADHOC_MONITOR_ID, "adhoc", "up"],
				doubles: [12, 1, 0, 0],
				indexes: ["team-1"],
			},
		]);
	});

	test("records the ping's own status rather than a fixed one", async () => {
		record(adhocPing({ status: "down", responseTimeMs: 0 }));

		expect(pingResults.dataPoints).toEqual([
			{
				blobs: [ADHOC_MONITOR_ID, "adhoc", "down"],
				doubles: [0, 1, 0, 0],
				indexes: ["team-1"],
			},
		]);
	});
});

describe("recordAdhocPing billing", () => {
	test("bills one ping, keyed on the ping id and charged to the team's owner", async () => {
		record(adhocPing({ id: "ping-42" }));
		await Promise.all(deferred.splice(0));

		expect(ingestMock).toHaveBeenCalledTimes(1);
		expect(ingestedEvents()).toEqual([
			{
				name: "ping",
				customer: { externalId: "owner-1" },
				externalId: "ping:ping-42",
				metadata: { teamId: "team-1", type: "adhoc" },
			},
		]);
	});

	test("carries no monitorId key at all, since there is no monitor", async () => {
		record();
		await Promise.all(deferred.splice(0));

		let [event] = ingestedEvents();
		expect(ingestedEvents()).toHaveLength(1);
		expect(event?.metadata).not.toHaveProperty("monitorId");
		expect(Object.keys(event?.metadata ?? {})).toEqual(["teamId", "type"]);
	});

	test("hands the ingest to waitUntil instead of making the caller wait for it", async () => {
		let release = () => {};
		let settled = false;
		ingestMock.mockImplementation(async () => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			settled = true;
			return failure(
				new BillingError("nothing to report", { code: "invalid_request", connection: "memory" }),
			);
		});

		record();

		expect(pingResults.dataPoints).toHaveLength(1);
		expect(deferred).toHaveLength(1);
		expect(settled).toBe(false);

		release();
		await Promise.all(deferred.splice(0));
		expect(settled).toBe(true);
	});

	test("doesn't throw when the ingest is rejected", async () => {
		ingestMock.mockImplementation(async () => {
			throw new Error("platform unavailable");
		});

		/** The check the caller already paid for stays successful even when billing itself fails. */
		expect(() => record()).not.toThrow();
		expect(pingResults.dataPoints).toHaveLength(1);

		await expect(Promise.all(deferred.splice(0))).rejects.toThrow("platform unavailable");
	});

	test("doesn't throw when the ingest is refused", async () => {
		ingestMock.mockImplementation(async () =>
			failure(new BillingError("refused", { code: "invalid_request", connection: "memory" })),
		);

		expect(() => record()).not.toThrow();

		/** A refused event is logged once and the outcome stands as final. */
		await expect(Promise.all(deferred.splice(0))).resolves.toBeDefined();
		expect(pingResults.dataPoints).toHaveLength(1);
	});
});
