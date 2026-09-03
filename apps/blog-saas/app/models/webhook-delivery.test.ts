/**
 * Unit tests for the `WebhookDelivery` control-plane model: a delivery round-trips
 * with its signature verdict, a redelivery replaces the stored body, and marking one
 * processed is what a later replay is measured against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { type TestDatabase, createTestDatabase } from "~/app/test/db";

import WebhookDelivery from "./webhook-delivery";

let harness: TestDatabase;

beforeEach(() => {
	harness = createTestDatabase();
});

afterEach(() => {
	harness.sqliteDb.close();
});

describe("WebhookDelivery", () => {
	test("round-trips a delivery with its verdict", async () => {
		await WebhookDelivery.record(harness.db, {
			id: "dlv_1",
			type: "subscription",
			payload: '{"type":"subscription.updated"}',
			valid: true,
			processed: false,
		});

		expect(await WebhookDelivery.find(harness.db, "dlv_1")).toEqual({
			id: "dlv_1",
			type: "subscription",
			payload: '{"type":"subscription.updated"}',
			valid: true,
			processed: false,
		});
	});

	test("keeps a forged delivery as evidence", async () => {
		await WebhookDelivery.record(harness.db, {
			id: "dlv_2",
			type: "unknown",
			payload: "{}",
			valid: false,
			processed: false,
		});

		expect((await WebhookDelivery.find(harness.db, "dlv_2"))?.valid).toBe(false);
	});

	test("replaces the stored body when the same delivery arrives again", async () => {
		await WebhookDelivery.record(harness.db, {
			id: "dlv_3",
			type: "order",
			payload: "first",
			valid: true,
			processed: false,
		});
		await WebhookDelivery.record(harness.db, {
			id: "dlv_3",
			type: "order",
			payload: "second",
			valid: true,
			processed: false,
		});

		expect((await WebhookDelivery.find(harness.db, "dlv_3"))?.payload).toBe("second");
	});

	test("marks a delivery processed", async () => {
		await WebhookDelivery.record(harness.db, {
			id: "dlv_4",
			type: "order",
			payload: "{}",
			valid: true,
			processed: false,
		});

		await WebhookDelivery.markProcessed(harness.db, "dlv_4");

		expect((await WebhookDelivery.find(harness.db, "dlv_4"))?.processed).toBe(true);
	});

	test("ignores marking an id that never arrived", async () => {
		await WebhookDelivery.markProcessed(harness.db, "dlv_missing");

		expect(await WebhookDelivery.find(harness.db, "dlv_missing")).toBeNull();
	});
});
