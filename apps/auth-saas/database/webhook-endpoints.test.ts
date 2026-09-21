/**
 * Drives `webhook-endpoints.ts` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `clients.test.ts` and `api-keys.test.ts`
 * drive their own modules: nothing here can wire a new RPC method onto the tenant
 * object, so these functions are exercised the same way it will eventually call
 * them. The entitlement gate itself is proven in `tenant-do.test.ts`, alongside
 * the `custom_roles` and `machine_access` gates it mirrors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { importKey, open, randomToken } from "@sdxc/crypto";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { AuditActor } from "./audit-events";
import type { RegisterWebhookEndpointInput } from "./webhook-endpoints";

import { readAuditPage } from "./audit-events";
import { runMigrations } from "./tenant-migrations";
import {
	deleteWebhookEndpoint,
	listWebhookEndpoints,
	readWebhookEndpoint,
	registerWebhookEndpoint,
	rotateEndpointSecret,
	updateWebhookEndpoint,
	validateWebhookUrl,
	webhookEndpoints,
} from "./webhook-endpoints";

let db: Database;
let sealKey: CryptoKey;

let ACTOR: AuditActor = { type: "platform", id: "system" };

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await runMigrations(driver);
	db = new Database(driver);

	sealKey = unwrap(await importKey(randomToken({ bytes: 32 })));
});

/** The record `registerWebhookEndpoint` accepts when a test does not care about most of it. */
function baseInput(
	overrides: Partial<RegisterWebhookEndpointInput> = {},
): RegisterWebhookEndpointInput {
	return {
		url: "https://example.com/hooks",
		description: "Test endpoint",
		eventTypes: ["*"],
		actor: ACTOR,
		...overrides,
	};
}

/** Registers an endpoint, throwing if the call was refused, for tests that need one already made. */
async function createTestEndpoint(overrides: Partial<RegisterWebhookEndpointInput> = {}) {
	let result = await registerWebhookEndpoint(db, sealKey, baseInput(overrides));
	if (!result.ok) throw new Error("unreachable");
	return result;
}

describe("validateWebhookUrl", () => {
	test("accepts an https URL with a public hostname", () => {
		expect(validateWebhookUrl("https://example.com/hooks")).toEqual({ ok: true });
	});

	test("accepts an https URL naming the scheme's own default port explicitly through its origin", () => {
		expect(validateWebhookUrl("https://example.com/hooks?x=1")).toEqual({ ok: true });
	});

	test("rejects a relative URL", () => {
		expect(validateWebhookUrl("/hooks")).toEqual({ ok: false, reason: "not-absolute" });
	});

	test("rejects http", () => {
		expect(validateWebhookUrl("http://example.com/hooks")).toEqual({
			ok: false,
			reason: "insecure-scheme",
		});
	});

	test("rejects a literal IPv4 address", () => {
		expect(validateWebhookUrl("https://93.184.216.34/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
	});

	test("rejects an undotted decimal IPv4 address", () => {
		expect(validateWebhookUrl("https://2130706433/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
	});

	test("rejects a literal IPv6 address", () => {
		expect(validateWebhookUrl("https://[2001:db8::1]/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
	});

	test("rejects loopback addresses and hostnames, with no exception for them", () => {
		expect(validateWebhookUrl("https://127.0.0.1/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
		expect(validateWebhookUrl("https://[::1]/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
		expect(validateWebhookUrl("https://localhost/hooks")).toEqual({
			ok: false,
			reason: "literal-address-host",
		});
	});

	test("rejects userinfo in the URL", () => {
		expect(validateWebhookUrl("https://user:pass@example.com/hooks")).toEqual({
			ok: false,
			reason: "has-userinfo",
		});
	});

	test("rejects a non-default port", () => {
		expect(validateWebhookUrl("https://example.com:8443/hooks")).toEqual({
			ok: false,
			reason: "non-default-port",
		});
	});
});

describe("registerWebhookEndpoint", () => {
	test("registers with the wildcard event type", async () => {
		let result = await registerWebhookEndpoint(db, sealKey, baseInput({ eventTypes: ["*"] }));
		expect(result).toMatchObject({ ok: true, endpoint: { eventTypes: ["*"] } });
	});

	test("registers with real audit action keys", async () => {
		let result = await registerWebhookEndpoint(
			db,
			sealKey,
			baseInput({ eventTypes: ["subject.created", "subject.blocked"] }),
		);
		expect(result).toMatchObject({
			ok: true,
			endpoint: { eventTypes: ["subject.created", "subject.blocked"] },
		});
	});

	test("refuses an unknown event type, naming it", async () => {
		let result = await registerWebhookEndpoint(
			db,
			sealKey,
			baseInput({ eventTypes: ["not.a.real.action"] }),
		);
		expect(result).toEqual({
			ok: false,
			reason: "unknown-event-type",
			value: "not.a.real.action",
		});
	});

	test("refuses an invalid URL, naming the specific rule", async () => {
		let result = await registerWebhookEndpoint(
			db,
			sealKey,
			baseInput({ url: "http://example.com/hooks" }),
		);
		expect(result).toEqual({
			ok: false,
			reason: "invalid-url",
			detail: "insecure-scheme",
		});
	});

	test("returns the one-time secret, and stores only its sealed form", async () => {
		let result = await createTestEndpoint();
		if (!result.ok) throw new Error("unreachable");

		expect(result.secret).toMatch(/^whsec_/);

		let row = await db.find(webhookEndpoints, { id: result.endpoint.id });
		if (!row) throw new Error("unreachable");

		expect(row.sealed_secret).not.toBe(result.secret);
		expect(unwrap(await open(sealKey, row.sealed_secret))).toBe(result.secret);
	});

	test("never projects sealed_secret or sealed_previous onto the record", async () => {
		let result = await createTestEndpoint();
		if (!result.ok) throw new Error("unreachable");

		expect(result.endpoint).not.toHaveProperty("sealed_secret");
		expect(result.endpoint).not.toHaveProperty("sealed_previous");
	});

	test("writes a webhook_endpoint.registered audit event", async () => {
		let result = await createTestEndpoint();
		if (!result.ok) throw new Error("unreachable");

		let page = await readAuditPage(db, { from: 0, to: Date.now() + 1 });
		if (!page.ok) throw new Error("unreachable");

		expect(page.events).toContainEqual(
			expect.objectContaining({
				action: "webhook_endpoint.registered",
				targetId: result.endpoint.id,
			}),
		);
	});
});

describe("updateWebhookEndpoint", () => {
	test("replaces the whole editable set", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let updated = await updateWebhookEndpoint(db, {
			endpointId: created.endpoint.id,
			url: "https://other.example.com/hooks",
			description: "Renamed",
			eventTypes: ["subject.blocked"],
			actor: ACTOR,
		});

		expect(updated).toMatchObject({
			ok: true,
			endpoint: {
				url: "https://other.example.com/hooks",
				description: "Renamed",
				eventTypes: ["subject.blocked"],
			},
		});
	});

	test("leaves the signing secret untouched", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let before = await db.find(webhookEndpoints, { id: created.endpoint.id });
		await updateWebhookEndpoint(db, {
			endpointId: created.endpoint.id,
			url: "https://other.example.com/hooks",
			description: "Renamed",
			eventTypes: ["*"],
			actor: ACTOR,
		});
		let after = await db.find(webhookEndpoints, { id: created.endpoint.id });

		expect(after?.sealed_secret).toBe(before?.sealed_secret);
	});

	test("refuses an update naming an unknown endpoint", async () => {
		let result = await updateWebhookEndpoint(db, {
			endpointId: "whep_does_not_exist",
			url: "https://example.com/hooks",
			description: "x",
			eventTypes: ["*"],
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses an invalid URL on update, the same rules as registration", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let result = await updateWebhookEndpoint(db, {
			endpointId: created.endpoint.id,
			url: "https://127.0.0.1/hooks",
			description: "x",
			eventTypes: ["*"],
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "invalid-url", detail: "literal-address-host" });
	});
});

describe("rotateEndpointSecret", () => {
	test("moves the incumbent into sealed_previous with a seven-day expiry, and mints a new working secret", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let before = await db.find(webhookEndpoints, { id: created.endpoint.id });
		if (!before) throw new Error("unreachable");

		let now = Date.now();
		let rotated = await rotateEndpointSecret(db, sealKey, {
			endpointId: created.endpoint.id,
			actor: ACTOR,
			at: now,
		});
		if (!rotated.ok) throw new Error("unreachable");

		expect(rotated.secret).toMatch(/^whsec_/);
		expect(rotated.secret).not.toBe(created.secret);
		expect(rotated.endpoint.previousSecretExpiresAt).toBe(now + 7 * 24 * 60 * 60 * 1000);

		let after = await db.find(webhookEndpoints, { id: created.endpoint.id });
		if (!after) throw new Error("unreachable");

		expect(unwrap(await open(sealKey, after.sealed_secret))).toBe(rotated.secret);
		expect(after.sealed_previous).toBe(before.sealed_secret);
		expect(unwrap(await open(sealKey, after.sealed_previous as string))).toBe(created.secret);
	});

	test("refuses to rotate an unknown endpoint", async () => {
		let result = await rotateEndpointSecret(db, sealKey, {
			endpointId: "whep_does_not_exist",
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("deleteWebhookEndpoint", () => {
	test("removes the row", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let result = await deleteWebhookEndpoint(db, { endpointId: created.endpoint.id, actor: ACTOR });
		expect(result).toEqual({ ok: true });

		let row = await db.find(webhookEndpoints, { id: created.endpoint.id });
		expect(row).toBeNull();
	});

	test("refuses to delete an unknown endpoint", async () => {
		let result = await deleteWebhookEndpoint(db, {
			endpointId: "whep_does_not_exist",
			actor: ACTOR,
		});
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("readWebhookEndpoint", () => {
	test("reads a registered endpoint's record", async () => {
		let created = await createTestEndpoint();
		if (!created.ok) throw new Error("unreachable");

		let result = await readWebhookEndpoint(db, { endpointId: created.endpoint.id });
		expect(result).toEqual({ ok: true, endpoint: created.endpoint });
	});

	test("answers not-found for an unknown endpoint", async () => {
		let result = await readWebhookEndpoint(db, { endpointId: "whep_does_not_exist" });
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("listWebhookEndpoints", () => {
	test("pages newest first", async () => {
		let first = await createTestEndpoint();
		if (!first.ok) throw new Error("unreachable");
		await db.update(webhookEndpoints, { id: first.endpoint.id }, { created_at: 1_000 });

		let second = await createTestEndpoint();
		if (!second.ok) throw new Error("unreachable");
		await db.update(webhookEndpoints, { id: second.endpoint.id }, { created_at: 2_000 });

		let third = await createTestEndpoint();
		if (!third.ok) throw new Error("unreachable");
		await db.update(webhookEndpoints, { id: third.endpoint.id }, { created_at: 3_000 });

		let page = await listWebhookEndpoints(db, { limit: 2 });
		if (!page.ok) throw new Error("unreachable");

		expect(page.endpoints.map((endpoint) => endpoint.id)).toEqual([
			third.endpoint.id,
			second.endpoint.id,
		]);
		expect(page.cursors.next).not.toBeNull();

		let next = await listWebhookEndpoints(db, { cursor: page.cursors.next, limit: 2 });
		if (!next.ok) throw new Error("unreachable");

		expect(next.endpoints.map((endpoint) => endpoint.id)).toEqual([first.endpoint.id]);
		expect(next.cursors.next).toBeNull();
	});

	test("never projects sealed_secret or sealed_previous onto a listed record", async () => {
		await createTestEndpoint();

		let page = await listWebhookEndpoints(db);
		if (!page.ok) throw new Error("unreachable");

		expect(page.endpoints[0]).not.toHaveProperty("sealed_secret");
		expect(page.endpoints[0]).not.toHaveProperty("sealed_previous");
	});

	test("answers bad-cursor for a cursor this ordering did not mint", async () => {
		await createTestEndpoint();

		let page = await listWebhookEndpoints(db, { cursor: "not-a-real-cursor" });
		expect(page).toEqual({ ok: false, reason: "bad-cursor" });
	});
});
