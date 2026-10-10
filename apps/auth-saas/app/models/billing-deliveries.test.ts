/**
 * Drives the billing deliveries model against the control-plane test database: `record`
 * writes a replay over its first arrival, keeping when that arrival was received, and
 * `markProcessed` succeeds for an id that was never recorded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isSuccess, unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { Models } from "~/app/models";

import { createTestDatabase } from "~/app/test/db";
import { bindModels } from "~/app/test/models";

let models: Models;

beforeEach(async () => {
	models = bindModels(await createTestDatabase());
});

describe("billingDeliveries.record", () => {
	test("writes a first arrival unprocessed", async () => {
		let row = unwrap(
			await models.billingDeliveries.record({ id: "d1", type: "x", payload: "{}", valid: true }),
		);
		expect(row).toMatchObject({ id: "d1", type: "x", valid: true, processed: false });
	});

	test("writes a replay over the first arrival, keeping its received_at", async () => {
		let first = unwrap(
			await models.billingDeliveries.record({ id: "d1", type: "x", payload: "{}", valid: false }),
		);
		unwrap(await models.billingDeliveries.markProcessed("d1"));

		let replay = unwrap(
			await models.billingDeliveries.record({ id: "d1", type: "y", payload: "[]", valid: true }),
		);

		expect(replay).toMatchObject({
			type: "y",
			payload: "[]",
			valid: true,
			processed: false,
			received_at: first.received_at,
		});
	});
});

describe("billingDeliveries.markProcessed", () => {
	test("marks a recorded delivery processed", async () => {
		unwrap(
			await models.billingDeliveries.record({ id: "d1", type: "x", payload: "{}", valid: true }),
		);
		unwrap(await models.billingDeliveries.markProcessed("d1"));

		expect(await models.billingDeliveries.find("d1")).toMatchObject({ processed: true });
	});

	test("succeeds for an id that was never recorded", async () => {
		expect(isSuccess(await models.billingDeliveries.markProcessed("missing"))).toBe(true);
		expect(await models.billingDeliveries.find("missing")).toBeNull();
	});
});
