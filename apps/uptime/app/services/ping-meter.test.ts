/**
 * Unit tests for `ingestPings`, the one path a performed check takes to the billing
 * meter. The event name has to match what the meter counts, `externalCustomerId` has to
 * carry the owner id Polar bills, `externalId` has to survive so a redelivery
 * deduplicates, and the metadata keys have to match what the usage cards filter on. A
 * structural stand-in records what the client was handed, standing in for Polar itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { IngestEvent, PolarClient } from "@pkg/polar";

import { describe, expect, test, vi } from "vitest";

import type { BillablePing } from "~/app/services/ping-meter";

import { ingestPings, PING_EVENT_NAME, PING_METER_ID } from "~/app/services/ping-meter";

/** Silences the failure path's console noise so assertions can check the returned boolean. */
vi.spyOn(console, "error").mockImplementation(() => {});

function createFakePolar(accepted = true) {
	let calls: IngestEvent[][] = [];
	let polar = {
		async ingestEventsSafe(events: IngestEvent[]) {
			calls.push(events);
			return accepted;
		},
	} as unknown as PolarClient;

	return { polar, calls };
}

function ping(overrides: Partial<BillablePing> = {}): BillablePing {
	return {
		externalId: "result-1",
		ownerId: "owner-1",
		teamId: "team-1",
		monitorId: "monitor-1",
		type: "http",
		...overrides,
	};
}

describe("ingestPings", () => {
	test("builds one event per ping in the shape the meter reads", async () => {
		let { polar, calls } = createFakePolar();

		let accepted = await ingestPings(polar, [ping()]);

		expect(accepted).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([
			{
				name: "ping",
				externalCustomerId: "owner-1",
				externalId: "result-1",
				metadata: { teamId: "team-1", type: "http", monitorId: "monitor-1" },
			},
		]);
	});

	test("names the event the meter matches on", async () => {
		let { polar, calls } = createFakePolar();

		await ingestPings(polar, [ping({ type: "cron" })]);

		expect(PING_EVENT_NAME).toBe("ping");
		expect(calls[0]?.[0]?.name).toBe(PING_EVENT_NAME);
	});

	test("passes the caller's external id through, so a redelivery deduplicates", async () => {
		let { polar, calls } = createFakePolar();

		await ingestPings(polar, [ping({ externalId: "monitor-1:1700000000000" })]);

		expect(calls[0]?.[0]?.externalId).toBe("monitor-1:1700000000000");
	});

	test("tags a monitor's ping with the monitor its usage card filters on", async () => {
		let { polar, calls } = createFakePolar();

		await ingestPings(polar, [ping({ monitorId: "monitor-7", type: "tcp" })]);

		expect(calls[0]?.[0]?.metadata).toEqual({
			teamId: "team-1",
			type: "tcp",
			monitorId: "monitor-7",
		});
	});

	test("omits the monitor key entirely for an ad-hoc ping", async () => {
		let { polar, calls } = createFakePolar();

		await ingestPings(polar, [ping({ monitorId: null, type: "adhoc" })]);

		let metadata = calls[0]?.[0]?.metadata ?? {};
		expect("monitorId" in metadata).toBe(false);
		expect(metadata).toEqual({ teamId: "team-1", type: "adhoc" });
	});

	test("sends a whole unit of work's pings in one call, not one call each", async () => {
		let { polar, calls } = createFakePolar();
		let pings = Array.from({ length: 80 }, (_value, index) =>
			ping({ externalId: `result-${index}`, monitorId: `monitor-${index}` }),
		);

		await ingestPings(polar, pings);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toHaveLength(80);
	});

	test("an empty batch is a no-op that makes no request", async () => {
		let { polar, calls } = createFakePolar();

		let accepted = await ingestPings(polar, []);

		expect(accepted).toBe(true);
		expect(calls).toHaveLength(0);
	});

	test("a refused ingest answers false rather than throwing", async () => {
		let { polar, calls } = createFakePolar(false);

		let accepted = await ingestPings(polar, [ping(), ping({ externalId: "result-2" })]);

		expect(accepted).toBe(false);
		expect(calls).toHaveLength(1);
	});
});

describe("PING_METER_ID", () => {
	test("is the meter the usage cards query", () => {
		expect(PING_METER_ID).toBe("22fabd9b-8b03-4cc2-8981-230717267cd5");
	});
});
