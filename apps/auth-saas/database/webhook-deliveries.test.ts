/**
 * Drives `webhook-deliveries.ts` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `webhook-endpoints.test.ts` drives its
 * own module: nothing here can wire a new RPC method onto the tenant object,
 * so these functions are exercised the same way it will eventually call them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { importKey, randomToken } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v4";
import * as Webhooks from "@sdxc/webhooks";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuditActor } from "./audit-events";

import { runMigrations } from "./tenant-migrations";
import {
	claimDueDeliveries,
	prepareDelivery,
	readDeliveryPage,
	replayDelivery,
	settleDelivery,
	sweepWebhookDeliveries,
	webhookDeliveries,
} from "./webhook-deliveries";
import {
	registerWebhookEndpoint,
	rotateEndpointSecret,
	webhookEndpoints,
} from "./webhook-endpoints";

const T0 = 1_700_000_000_000;

let db: Database;
let sealKey: CryptoKey;

let ACTOR: AuditActor = { type: "platform", id: "system" };

let mintDeliveryId = typeid("whdl");

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);

	sealKey = unwrap(await importKey(randomToken({ bytes: 32 })));
});

/** Registers a test endpoint, throwing if the call was refused, and returns its one-time secret alongside the record. */
async function createTestEndpoint(eventTypes: string[] = ["*"]) {
	let result = await registerWebhookEndpoint(db, sealKey, {
		url: "https://example.com/hooks",
		description: "Test endpoint",
		eventTypes,
		actor: ACTOR,
	});
	if (!result.ok) throw new Error("setup failed");
	return result;
}

/** Inserts a delivery row directly, for tests that drive a specific lifecycle stage rather than the fan-out itself. */
async function insertDelivery(
	endpointId: string,
	overrides: Partial<{
		attempts: number;
		status: "pending" | "delivered" | "exhausted";
		nextAttemptAt: number | null;
		eventType: string;
		createdAt: number;
	}> = {},
) {
	let id = mintDeliveryId(generateUUID()).toString();
	let payload = JSON.stringify({
		type: overrides.eventType ?? "subject.blocked",
		timestamp: T0,
		sequence: 1,
		data: { targetType: "subject", targetId: "sub_1" },
	});

	await db.create(webhookDeliveries, {
		id,
		endpoint_id: endpointId,
		event_type: overrides.eventType ?? "subject.blocked",
		sequence: 1,
		payload,
		status: overrides.status ?? "pending",
		attempts: overrides.attempts ?? 0,
		next_attempt_at: overrides.nextAttemptAt === undefined ? T0 : overrides.nextAttemptAt,
		last_status: null,
		last_error: null,
		last_attempt_at: null,
		delivered_at: null,
		created_at: overrides.createdAt ?? T0,
		replay_of: null,
	});

	return id;
}

describe("prepareDelivery", () => {
	test("signs under the endpoint's one live secret, and the result verifies with Webhooks.verify", async () => {
		let { endpoint, secret } = await createTestEndpoint();
		let deliveryId = await insertDelivery(endpoint.id);

		let prepared = await prepareDelivery(db, sealKey, { deliveryId, now: T0 });
		expect(prepared).toMatchObject({ ok: true, url: endpoint.url, attempt: 1 });
		if (!prepared.ok) return;

		let request = new Request(endpoint.url, {
			method: "POST",
			headers: new Headers(prepared.headers),
			body: prepared.body,
		});

		let verified = await Webhooks.verify(request, { secret, tolerance: "3650 days" });
		expect(isSuccess(verified)).toBe(true);
		if (!isSuccess(verified)) return;
		expect(verified.data.payload).toMatchObject({ type: "subject.blocked" });
	});

	test("signs under both secrets during a rotation's overlap window, and the combined header verifies against either", async () => {
		let { endpoint, secret: originalSecret } = await createTestEndpoint();

		let rotated = await rotateEndpointSecret(db, sealKey, {
			endpointId: endpoint.id,
			actor: ACTOR,
			at: T0,
		});
		if (!rotated.ok) throw new Error("setup failed");

		let deliveryId = await insertDelivery(endpoint.id);

		let prepared = await prepareDelivery(db, sealKey, { deliveryId, now: T0 });
		expect(prepared.ok).toBe(true);
		if (!prepared.ok) return;

		// The header carries two space-separated `v1,...` values, one per live secret.
		expect(prepared.headers["webhook-signature"]?.split(" ")).toHaveLength(2);

		for (let secret of [rotated.secret, originalSecret]) {
			let request = new Request(endpoint.url, {
				method: "POST",
				headers: new Headers(prepared.headers),
				body: prepared.body,
			});

			let verified = await Webhooks.verify(request, { secret, tolerance: "3650 days" });
			expect(isSuccess(verified)).toBe(true);
		}
	});

	test("does not sign under a previous secret once its overlap window has closed", async () => {
		let { endpoint, secret: originalSecret } = await createTestEndpoint();

		await rotateEndpointSecret(db, sealKey, { endpointId: endpoint.id, actor: ACTOR, at: T0 });

		let deliveryId = await insertDelivery(endpoint.id);

		// Eight days after the rotation: past the week-long overlap window.
		let now = T0 + 8 * 24 * 60 * 60 * 1000;
		let prepared = await prepareDelivery(db, sealKey, { deliveryId, now });
		expect(prepared.ok).toBe(true);
		if (!prepared.ok) return;

		expect(prepared.headers["webhook-signature"]?.split(" ")).toHaveLength(1);

		let request = new Request(endpoint.url, {
			method: "POST",
			headers: new Headers(prepared.headers),
			body: prepared.body,
		});
		let verified = await Webhooks.verify(request, {
			secret: originalSecret,
			tolerance: "3650 days",
		});
		expect(isFailure(verified)).toBe(true);
	});

	test("answers not-found for an unknown delivery", async () => {
		expect(await prepareDelivery(db, sealKey, { deliveryId: "whdl_does_not_exist" })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});

	test("answers not-pending for a delivery already delivered", async () => {
		let { endpoint } = await createTestEndpoint();
		let deliveryId = await insertDelivery(endpoint.id, { status: "delivered" });

		expect(await prepareDelivery(db, sealKey, { deliveryId })).toEqual({
			ok: false,
			reason: "not-pending",
		});
	});

	test("answers the attempt number as one past the row's own attempts", async () => {
		let { endpoint } = await createTestEndpoint();
		let deliveryId = await insertDelivery(endpoint.id, { attempts: 3 });

		let prepared = await prepareDelivery(db, sealKey, { deliveryId, now: T0 });
		expect(prepared).toMatchObject({ ok: true, attempt: 4 });
	});
});

describe("settleDelivery", () => {
	test("a delivered outcome closes the row and resets the endpoint's failure streak", async () => {
		let { endpoint } = await createTestEndpoint();
		await db.update(webhookEndpoints, { id: endpoint.id }, { consecutive_failures: 5 });
		let deliveryId = await insertDelivery(endpoint.id);

		let result = await settleDelivery(db, {
			deliveryId,
			outcome: "delivered",
			status: 200,
			now: T0 + 1000,
		});
		expect(result).toEqual({ ok: true, status: "delivered", deliveredAt: T0 + 1000 });

		let row = await db.find(webhookDeliveries, { id: deliveryId });
		expect(row).toMatchObject({
			status: "delivered",
			attempts: 1,
			last_status: 200,
			last_error: null,
			delivered_at: T0 + 1000,
			next_attempt_at: null,
		});

		let endpointRow = await db.find(webhookEndpoints, { id: endpoint.id });
		expect(endpointRow?.consecutive_failures).toBe(0);
	});

	test("answers not-found for an unknown delivery", async () => {
		expect(
			await settleDelivery(db, { deliveryId: "whdl_does_not_exist", outcome: "timeout" }),
		).toEqual({ ok: false, reason: "not-found" });
	});

	test("a retryable outcome before the eighth attempt schedules the next one within the jittered base delay", async () => {
		let { endpoint } = await createTestEndpoint();

		// Base delays for attempts 1 through 7, in the order they are scheduled.
		let schedule = [
			15 * 1000,
			60 * 1000,
			5 * 60 * 1000,
			30 * 60 * 1000,
			2 * 60 * 60 * 1000,
			6 * 60 * 60 * 1000,
			12 * 60 * 60 * 1000,
		];

		for (let [index, base] of schedule.entries()) {
			let deliveryId = await insertDelivery(endpoint.id, { attempts: index });

			let result = await settleDelivery(db, {
				deliveryId,
				outcome: "http_error",
				status: 500,
				snippet: "server error",
				now: T0,
			});

			expect(result.ok).toBe(true);
			if (!result.ok || result.status !== "pending") throw new Error("expected a retry");

			let delay = result.nextAttemptAt - T0;
			expect(delay).toBeGreaterThanOrEqual(base * 0.8);
			expect(delay).toBeLessThanOrEqual(base * 1.2);

			let row = await db.find(webhookDeliveries, { id: deliveryId });
			expect(row).toMatchObject({
				status: "pending",
				attempts: index + 1,
				last_status: 500,
				last_error: "server error",
			});
		}
	});

	test("exhausts the row on the eighth attempt and increments the endpoint's failure streak", async () => {
		let { endpoint } = await createTestEndpoint();
		let deliveryId = await insertDelivery(endpoint.id, { attempts: 7 });

		let result = await settleDelivery(db, {
			deliveryId,
			outcome: "timeout",
			now: T0,
		});
		expect(result).toEqual({ ok: true, status: "exhausted" });

		let row = await db.find(webhookDeliveries, { id: deliveryId });
		expect(row).toMatchObject({ status: "exhausted", attempts: 8, next_attempt_at: null });

		let endpointRow = await db.find(webhookEndpoints, { id: endpoint.id });
		expect(endpointRow?.consecutive_failures).toBe(1);
		expect(endpointRow?.disabled_at).toBeNull();
	});

	test("disables the endpoint once its consecutive exhausted deliveries reach twenty", async () => {
		let { endpoint } = await createTestEndpoint();
		await db.update(webhookEndpoints, { id: endpoint.id }, { consecutive_failures: 19 });

		let deliveryId = await insertDelivery(endpoint.id, { attempts: 7 });
		await settleDelivery(db, { deliveryId, outcome: "timeout", now: T0 });

		let endpointRow = await db.find(webhookEndpoints, { id: endpoint.id });
		expect(endpointRow?.consecutive_failures).toBe(20);
		expect(endpointRow?.disabled_at).toBe(T0);
		expect(endpointRow?.disabled_reason).toContain("20 consecutive deliveries");
	});
});

describe("claimDueDeliveries", () => {
	test("answers pending deliveries at or before the clock, oldest-due first", async () => {
		let { endpoint } = await createTestEndpoint();

		let late = await insertDelivery(endpoint.id, { nextAttemptAt: T0 + 3000 });
		let early = await insertDelivery(endpoint.id, { nextAttemptAt: T0 + 1000 });
		let notYetDue = await insertDelivery(endpoint.id, { nextAttemptAt: T0 + 10_000 });
		let alreadyDelivered = await insertDelivery(endpoint.id, {
			nextAttemptAt: null,
			status: "delivered",
		});

		let claimed = await claimDueDeliveries(db, { before: T0 + 5000 });

		expect(claimed.deliveries.map((row) => row.deliveryId)).toEqual([early, late]);
		expect(claimed.more).toBe(false);
		expect(claimed.deliveries.map((row) => row.deliveryId)).not.toContain(notYetDue);
		expect(claimed.deliveries.map((row) => row.deliveryId)).not.toContain(alreadyDelivered);
	});

	test("answers more: true when the batch fills the limit", async () => {
		let { endpoint } = await createTestEndpoint();
		await insertDelivery(endpoint.id, { nextAttemptAt: T0 });
		await insertDelivery(endpoint.id, { nextAttemptAt: T0 });

		let claimed = await claimDueDeliveries(db, { before: T0 + 1000, limit: 1 });
		expect(claimed.deliveries).toHaveLength(1);
		expect(claimed.more).toBe(true);
	});
});

describe("replayDelivery", () => {
	test("writes a new row carrying the original's payload, with a fresh id and sequence and replayOf naming the original", async () => {
		let { endpoint } = await createTestEndpoint();
		let originalId = await insertDelivery(endpoint.id);
		let original = await db.find(webhookDeliveries, { id: originalId });

		let result = await replayDelivery(db, { deliveryId: originalId, actor: ACTOR, at: T0 + 5000 });
		expect(result.ok).toBe(true);
		if (!result.ok) return;

		expect(result.delivery.id).not.toBe(originalId);
		expect(result.delivery.replayOf).toBe(originalId);
		expect(result.delivery.status).toBe("pending");
		expect(result.delivery.attempts).toBe(0);
		expect(result.delivery.sequence).not.toBe(original?.sequence);

		let row = await db.find(webhookDeliveries, { id: result.delivery.id });
		expect(row?.payload).toBe(original?.payload);
		expect(row?.event_type).toBe(original?.event_type);
	});

	test("refuses when the original delivery does not exist", async () => {
		expect(await replayDelivery(db, { deliveryId: "whdl_does_not_exist", actor: ACTOR })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});

	test("refuses when the original delivery's endpoint no longer exists", async () => {
		let { endpoint } = await createTestEndpoint();
		let deliveryId = await insertDelivery(endpoint.id);
		await db.delete(webhookEndpoints, { id: endpoint.id });

		expect(await replayDelivery(db, { deliveryId, actor: ACTOR })).toEqual({
			ok: false,
			reason: "not-found",
		});
	});
});

describe("readDeliveryPage", () => {
	test("pages one endpoint's own deliveries, newest first, and never projects payload", async () => {
		let { endpoint } = await createTestEndpoint(["subject.blocked"]);
		let other = await createTestEndpoint(["subject.blocked"]);

		await insertDelivery(endpoint.id, { createdAt: T0 });
		await insertDelivery(endpoint.id, { createdAt: T0 + 1000 });
		await insertDelivery(other.endpoint.id, { createdAt: T0 + 2000 });

		let first = await readDeliveryPage(db, { endpointId: endpoint.id, limit: 1 });
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.deliveries).toHaveLength(1);
		expect(first.deliveries[0]?.createdAt).toBe(T0 + 1000);
		expect(first.deliveries[0]).not.toHaveProperty("payload");
		expect(first.cursors.next).not.toBeNull();

		let second = await readDeliveryPage(db, {
			endpointId: endpoint.id,
			limit: 1,
			cursor: first.cursors.next,
		});
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.deliveries[0]?.createdAt).toBe(T0);
	});

	test("answers bad-cursor for a cursor that no longer matches", async () => {
		let { endpoint } = await createTestEndpoint();
		expect(
			await readDeliveryPage(db, { endpointId: endpoint.id, cursor: "not-a-real-cursor" }),
		).toEqual({ ok: false, reason: "bad-cursor" });
	});
});

describe("sweepWebhookDeliveries", () => {
	test("deletes delivered and exhausted rows older than the retention window", async () => {
		let { endpoint } = await createTestEndpoint();

		let stale = await insertDelivery(endpoint.id, {
			status: "delivered",
			createdAt: T0 - 40 * 24 * 60 * 60 * 1000,
		});
		let recent = await insertDelivery(endpoint.id, {
			status: "exhausted",
			createdAt: T0 - 1000,
		});

		let result = await sweepWebhookDeliveries(db, { retentionDays: 30, now: T0 });
		expect(result).toEqual({ deleted: 1, more: false });

		expect(await db.find(webhookDeliveries, { id: stale })).toBeNull();
		expect(await db.find(webhookDeliveries, { id: recent })).not.toBeNull();
	});

	test("never deletes a pending row regardless of age", async () => {
		let { endpoint } = await createTestEndpoint();
		let old = await insertDelivery(endpoint.id, {
			status: "pending",
			createdAt: T0 - 365 * 24 * 60 * 60 * 1000,
		});

		let result = await sweepWebhookDeliveries(db, { retentionDays: 30, now: T0 });
		expect(result).toEqual({ deleted: 0, more: false });
		expect(await db.find(webhookDeliveries, { id: old })).not.toBeNull();
	});

	test("respects a shorter retention window", async () => {
		let { endpoint } = await createTestEndpoint();
		let borderline = await insertDelivery(endpoint.id, {
			status: "delivered",
			createdAt: T0 - 2 * 24 * 60 * 60 * 1000,
		});

		expect(await sweepWebhookDeliveries(db, { retentionDays: 30, now: T0 })).toEqual({
			deleted: 0,
			more: false,
		});

		expect(await sweepWebhookDeliveries(db, { retentionDays: 1, now: T0 })).toEqual({
			deleted: 1,
			more: false,
		});
		expect(await db.find(webhookDeliveries, { id: borderline })).toBeNull();
	});
});
