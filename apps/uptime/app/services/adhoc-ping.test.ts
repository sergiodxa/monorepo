/**
 * Tests `recordAdhocPing`, the half of an ad-hoc ping that is the same whoever asked for
 * it: one Analytics Engine data point and one billed event. Both callers — the public
 * ping endpoint and the dashboard's quick check — go through this, so what is pinned here
 * is the shape neither of them may drift from: the point is written under the shared
 * `adhoc` monitor id and indexed by team, and the meter event is keyed on the ping's own
 * id, charged to the team's owner, and carries no `monitorId` key at all. That last one is
 * asserted as an absent key rather than a null, because a present-but-null key is what
 * would make the ping show up on a monitor's usage card that has no monitor behind it.
 *
 * The remaining two cases are about what a caller is made to wait for. Both callers are
 * holding a connection open for a result they already have, so the ingest goes out under
 * `waitUntil`: the double collects the deferred work instead of dropping it, which lets a
 * test assert the call returned while the ingest was still pending, and lets a rejected
 * ingest be shown to cost the caller nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";

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

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({ PING_RESULTS: pingResults }),
	waitUntil: (promise: Promise<unknown>) => {
		deferred.push(promise);
	},
}));

let { ADHOC_MONITOR_ID, recordAdhocPing } = await import("./adhoc-ping");

/**
 * The billing client the container hands the service, with the one call `ingestPings`
 * makes spied on. The client is real — only the request is intercepted — so the events
 * asserted below are the ones the service actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

/** `ingestPings` logs its own failures; the assertions read the calls instead. */
spyOn(console, "error").mockImplementation(() => {});

let container = new ServiceContainer();
container.singleton(PolarClient, () => polar);

beforeEach(() => {
	pingResults.reset();
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
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

/** Records `ping` inside a container scope, which is where the billing client lives. */
function record(ping: AdhocPing = adhocPing()): void {
	container.scope(() => recordAdhocPing(ping));
}

/** Every event the service handed Polar, flattened across the calls it made. */
function ingestedEvents(): IngestEvent[] {
	return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
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

		expect(ingestEventsSafeMock).toHaveBeenCalledTimes(1);
		expect(ingestedEvents()).toEqual([
			{
				name: "ping",
				externalCustomerId: "owner-1",
				externalId: "ping:ping-42",
				metadata: { teamId: "team-1", type: "adhoc" },
			},
		]);
	});

	test("carries no monitorId key at all, since there is no monitor", async () => {
		record();
		await Promise.all(deferred.splice(0));

		// A present-but-null key would put an ad-hoc ping on a monitor's usage card, which
		// filters the meter by `monitorId`; an absent one keeps it in the team total only.
		let [event] = ingestedEvents();
		expect(ingestedEvents()).toHaveLength(1);
		expect(event?.metadata).not.toHaveProperty("monitorId");
		expect(Object.keys(event?.metadata ?? {})).toEqual(["teamId", "type"]);
	});

	test("hands the ingest to waitUntil instead of making the caller wait for it", async () => {
		let release = () => {};
		let settled = false;
		ingestEventsSafeMock.mockImplementation(async () => {
			await new Promise<void>((resolve) => {
				release = resolve;
			});
			settled = true;
			return true;
		});

		record();

		// The call is back with the data point already written while the meter event is
		// still in flight — which is the whole reason it goes out under `waitUntil`.
		expect(pingResults.dataPoints).toHaveLength(1);
		expect(deferred).toHaveLength(1);
		expect(settled).toBe(false);

		release();
		await Promise.all(deferred.splice(0));
		expect(settled).toBe(true);
	});

	test("doesn't throw when the ingest is rejected", async () => {
		ingestEventsSafeMock.mockImplementation(async () => {
			throw new Error("polar unavailable");
		});

		// A billing outage must not turn a check the caller already paid for into an error.
		expect(() => record()).not.toThrow();
		expect(pingResults.dataPoints).toHaveLength(1);

		await expect(Promise.all(deferred.splice(0))).rejects.toThrow("polar unavailable");
	});

	test("doesn't throw when the ingest is refused", async () => {
		ingestEventsSafeMock.mockImplementation(async () => false);

		expect(() => record()).not.toThrow();

		// Best-effort by design: a refused event is logged and dropped, never retried.
		await expect(Promise.all(deferred.splice(0))).resolves.toBeDefined();
		expect(pingResults.dataPoints).toHaveLength(1);
	});
});
