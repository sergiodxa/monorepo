/**
 * Unit tests for the billing delivery log: that a redelivery replaces the row it shares an id
 * with, that marking one processed is what a later redelivery reads, that pruning keeps every
 * unprocessed row, and that the store adapter reads and writes through the model.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { WebhookDelivery } from "@sdxc/billing";

import { describe, expect, test } from "vitest";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { webhookStore } from "~/app/models/billing-webhook-deliveries";
import { billingWebhookDeliveries } from "~/database/schema";

/** Models over a fresh database, with the database itself for backdating rows. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

/** A signed, unprocessed delivery, with any field overridable per test. */
function delivery(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
	return {
		id: "dlv_1",
		type: "subscription",
		payload: '{"type":"subscription.created"}',
		valid: true,
		processed: false,
		...overrides,
	};
}

describe("billingWebhookDeliveries.record", () => {
	test("records a delivery the log can read back", async () => {
		let { models } = setup();

		await models.billingWebhookDeliveries.record(delivery());

		expect(await models.billingWebhookDeliveries.findDelivery("dlv_1")).toEqual(delivery());
	});

	test("replaces a row sharing its id with the bytes that arrived last", async () => {
		let { db, models } = setup();
		await models.billingWebhookDeliveries.record(delivery({ valid: false }));

		await models.billingWebhookDeliveries.record(delivery({ payload: "{}" }));

		expect(await models.billingWebhookDeliveries.findDelivery("dlv_1")).toEqual(
			delivery({ payload: "{}" }),
		);
		expect(await db.count(billingWebhookDeliveries)).toBe(1);
	});

	test("answers null for a delivery that never arrived", async () => {
		let { models } = setup();
		expect(await models.billingWebhookDeliveries.findDelivery("dlv_missing")).toBeNull();
	});
});

describe("billingWebhookDeliveries.markProcessed", () => {
	test("marks the delivery handled", async () => {
		let { models } = setup();
		await models.billingWebhookDeliveries.record(delivery());

		await models.billingWebhookDeliveries.markProcessed("dlv_1");

		expect((await models.billingWebhookDeliveries.findDelivery("dlv_1"))?.processed).toBe(true);
	});
});

describe("billingWebhookDeliveries.prune", () => {
	test("drops only handled deliveries older than the cutoff", async () => {
		let { db, models } = setup();
		await models.billingWebhookDeliveries.record(delivery({ id: "old-done", processed: true }));
		await models.billingWebhookDeliveries.record(delivery({ id: "old-pending" }));
		await models.billingWebhookDeliveries.record(delivery({ id: "new-done", processed: true }));
		await db.exec("UPDATE billing_webhook_deliveries SET created_at = ? WHERE id <> ?", [
			1_000,
			"new-done",
		]);

		expect(await models.billingWebhookDeliveries.prune(2_000)).toBe(1);

		let left = await models.billingWebhookDeliveries.query().orderBy("id", "asc").all();
		expect(left.map((row) => row.id)).toEqual(["new-done", "old-pending"]);
	});
});

describe("webhookStore", () => {
	test("reads and writes the log through the model it is handed", async () => {
		let { models } = setup();
		let store = webhookStore(() => models.billingWebhookDeliveries);

		await store.record(delivery());
		await store.markProcessed("dlv_1");

		expect(await store.find("dlv_1")).toEqual(delivery({ processed: true }));
	});
});
