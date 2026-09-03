/**
 * Tests the delivery store the billing webhook endpoint deduplicates against: a
 * redelivery replaces the row it already holds, the two verdicts survive the trip
 * through D1's integers, and an unrecorded id reads back as never having arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createD1Database, createEnv } from "@pkg/cloudflare-mocks";
import { beforeAll, expect, test, vi } from "vitest";

let database = createD1Database();

/** Precedes the dynamic import below, since the store reads `env` on load. */
vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Cloudflare.Env>({ PLATFORM_DB: database }),
	DurableObject: class {},
}));

let { deliveries } = await import("./webhook-delivery");

beforeAll(async () => {
	await database.exec(
		"CREATE TABLE billing_webhook_deliveries (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, valid INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0, received_at TEXT NOT NULL)",
	);
});

test("reports a delivery that has never arrived as absent", async () => {
	expect(await deliveries.find("wh_missing")).toBeNull();
});

test("reads back a recorded delivery with both verdicts", async () => {
	await deliveries.record({
		id: "wh_1",
		type: "subscription",
		payload: '{"type":"subscription.active"}',
		valid: true,
		processed: false,
	});

	expect(await deliveries.find("wh_1")).toEqual({
		id: "wh_1",
		type: "subscription",
		payload: '{"type":"subscription.active"}',
		valid: true,
		processed: false,
	});
});

test("marks a delivery processed, which is what a replay is measured against", async () => {
	await deliveries.record({
		id: "wh_2",
		type: "order",
		payload: "{}",
		valid: true,
		processed: false,
	});
	await deliveries.markProcessed("wh_2");

	expect((await deliveries.find("wh_2"))?.processed).toBe(true);
});

test("replaces the row a redelivery shares an id with", async () => {
	await deliveries.record({
		id: "wh_3",
		type: "order",
		payload: "{}",
		valid: false,
		processed: false,
	});
	await deliveries.record({
		id: "wh_3",
		type: "order",
		payload: '{"retried":true}',
		valid: true,
		processed: false,
	});

	expect(await deliveries.find("wh_3")).toMatchObject({
		payload: '{"retried":true}',
		valid: true,
	});
});
