/**
 * Unit tests for `ingestPings`, the one path a performed check takes to the billing meter.
 * The event has to name the meter the platform counts, carry the owner id it bills, keep the
 * caller's `externalId` so a redelivery deduplicates, and tag metadata with the keys the usage
 * cards filter on. It runs against a real in-memory platform, so what one call writes is what
 * the assertion reads back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Billing, UsageEvent } from "@sdxc/billing";

import { describe, expect, test, vi } from "vitest";

import type { BillablePing } from "~/app/services/ping-meter";

import { PING_METER } from "~/app/lib/billing";
import { createTestBilling } from "~/app/lib/test/billing";
import { ingestPings } from "~/app/services/ping-meter";

/** Silences the failure path's console noise so assertions can check the returned boolean. */
vi.spyOn(console, "error").mockImplementation(() => {});

/**
 * A platform recording every batch it was handed, since `usage.list` reports events one by one
 * and a whole call arriving as one request is itself an assertion below.
 */
function createRecordingBilling(accepted = true) {
	let billing = createTestBilling();
	let calls: UsageEvent[][] = [];

	let recording: Billing = billing.with({
		usage: {
			async ingest(events: readonly UsageEvent[]) {
				calls.push([...events]);
				if (!accepted) return await billing.usage.ingest([{ name: "", customer: { id: "x" } }]);

				return await billing.usage.ingest(events);
			},
			list: (query) => billing.usage.list(query),
		},
	});

	return { billing: recording, calls };
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
		let { billing, calls } = createRecordingBilling();

		let accepted = await ingestPings(billing, [ping()]);

		expect(accepted).toBe(true);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toEqual([
			{
				name: "ping",
				customer: { externalId: "owner-1" },
				externalId: "result-1",
				metadata: { teamId: "team-1", type: "http", monitorId: "monitor-1" },
			},
		]);
	});

	test("names the event the meter matches on", async () => {
		let { billing, calls } = createRecordingBilling();

		await ingestPings(billing, [ping({ type: "cron" })]);

		expect(PING_METER).toBe("ping");
		expect(calls[0]?.[0]?.name).toBe(PING_METER);
	});

	test("passes the caller's external id through, so a redelivery deduplicates", async () => {
		let { billing, calls } = createRecordingBilling();

		await ingestPings(billing, [ping({ externalId: "monitor-1:1700000000000" })]);

		expect(calls[0]?.[0]?.externalId).toBe("monitor-1:1700000000000");
	});

	test("tags a monitor's ping with the monitor its usage card filters on", async () => {
		let { billing, calls } = createRecordingBilling();

		await ingestPings(billing, [ping({ monitorId: "monitor-7", type: "tcp" })]);

		expect(calls[0]?.[0]?.metadata).toEqual({
			teamId: "team-1",
			type: "tcp",
			monitorId: "monitor-7",
		});
	});

	test("omits the monitor key entirely for an ad-hoc ping", async () => {
		let { billing, calls } = createRecordingBilling();

		await ingestPings(billing, [ping({ monitorId: null, type: "adhoc" })]);

		let metadata = calls[0]?.[0]?.metadata ?? {};
		expect("monitorId" in metadata).toBe(false);
		expect(metadata).toEqual({ teamId: "team-1", type: "adhoc" });
	});

	test("sends a whole unit of work's pings in one call, not one call each", async () => {
		let { billing, calls } = createRecordingBilling();
		let pings = Array.from({ length: 80 }, (_value, index) =>
			ping({ externalId: `result-${index}`, monitorId: `monitor-${index}` }),
		);

		await ingestPings(billing, pings);

		expect(calls).toHaveLength(1);
		expect(calls[0]).toHaveLength(80);
	});

	test("an empty batch is a no-op that makes no request", async () => {
		let { billing, calls } = createRecordingBilling();

		let accepted = await ingestPings(billing, []);

		expect(accepted).toBe(true);
		expect(calls).toHaveLength(0);
	});

	test("a refused ingest answers false rather than throwing", async () => {
		let { billing, calls } = createRecordingBilling(false);

		let accepted = await ingestPings(billing, [ping(), ping({ externalId: "result-2" })]);

		expect(accepted).toBe(false);
		expect(calls).toHaveLength(1);
	});
});

describe("PING_METER", () => {
	test("names the meter the usage cards query", () => {
		expect(PING_METER).toBe("ping");
	});
});
