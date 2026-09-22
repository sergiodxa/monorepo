/**
 * Drives `management-client.ts` directly against the control-plane test database:
 * registration and its scope-ceiling refusal, secret rotation, revocation,
 * tenant-scoped listing, and the verify/rehash/throttle behavior
 * `database/clients.ts`'s `verifyClientSecret` established for the one credential
 * hash this repo stores every secret under.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scryptSync } from "node:crypto";

import type { Database } from "remix/data-table";

import { Base64Url, password, randomBytes } from "@sdxc/crypto";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Customer from "~/app/models/customer";
import Tenant from "~/app/models/tenant";
import { createTestDatabase } from "~/app/test/db";

import {
	listManagementClients,
	managementClients,
	readManagementClient,
	registerManagementClient,
	revokeManagementClient,
	rotateManagementClientSecret,
	verifyManagementClientSecret,
} from "./management-client";

let db: Database;
let TENANT_ID: string;

beforeEach(async () => {
	db = await createTestDatabase();
	let customer = await Customer.create(db, { name: "Acme, Inc." });
	let tenant = await Tenant.create(db, {
		customerId: customer.id,
		name: "Acme, Inc.",
		slug: "acme",
		issuer: "https://acme.auth.example.com",
	});
	TENANT_ID = tenant.id;
});

async function registerTestClient(scopes: string[] = ["subjects:read", "subjects:write"]) {
	let result = await registerManagementClient(db, {
		tenantId: TENANT_ID,
		name: "CI pipeline",
		scopes,
	});
	if (!result.ok) throw new Error("unreachable");
	return result;
}

describe("registerManagementClient", () => {
	test("mints a client bound to its tenant, with a one-time secret", async () => {
		let result = await registerTestClient(["subjects:read"]);

		expect(result.client).toMatchObject({
			tenantId: TENANT_ID,
			name: "CI pipeline",
			scopes: ["subjects:read"],
			revokedAt: null,
			lastUsedAt: null,
		});
		expect(result.secret).toMatch(/^mgmt_/);
		expect(result.client.hint).toBe(result.secret.slice(-4));

		let row = await db.find(managementClients, { id: result.client.id });
		expect(row?.secret_hash).not.toBe(result.secret);
	});

	test("refuses a scope outside the management API's vocabulary", async () => {
		let result = await registerManagementClient(db, {
			tenantId: TENANT_ID,
			name: "bad",
			scopes: ["subjects:read", "subjects:delete"],
		});

		expect(result).toEqual({ ok: false, reason: "unknown-scope", scope: "subjects:delete" });
	});
});

describe("verifyManagementClientSecret", () => {
	test("verifies the secret it was just minted with", async () => {
		let { client, secret } = await registerTestClient();

		let verified = await verifyManagementClientSecret(db, { clientId: client.id, secret });

		expect(verified).toEqual({ ok: true, client });
	});

	test("refuses a wrong secret", async () => {
		let { client } = await registerTestClient();

		let verified = await verifyManagementClientSecret(db, {
			clientId: client.id,
			secret: "wrong",
		});

		expect(verified).toEqual({ ok: false });
	});

	test("refuses an unknown client the same way as a wrong secret", async () => {
		let verified = await verifyManagementClientSecret(db, {
			clientId: "mgmt_does_not_exist",
			secret: "whatever",
		});

		expect(verified).toEqual({ ok: false });
	});

	test("refuses a revoked client even with its correct secret", async () => {
		let { client, secret } = await registerTestClient();
		await revokeManagementClient(db, { clientId: client.id });

		let verified = await verifyManagementClientSecret(db, { clientId: client.id, secret });

		expect(verified).toEqual({ ok: false });
	});

	test("stamps last_used_at at most once a minute", async () => {
		let { client, secret } = await registerTestClient();

		vi.useFakeTimers();
		try {
			vi.setSystemTime(1_000_000);
			await verifyManagementClientSecret(db, { clientId: client.id, secret });
			let first = await db.find(managementClients, { id: client.id });
			expect(first?.last_used_at).toBe(1_000_000);

			vi.setSystemTime(1_000_000 + 30_000);
			await verifyManagementClientSecret(db, { clientId: client.id, secret });
			let second = await db.find(managementClients, { id: client.id });
			expect(second?.last_used_at).toBe(1_000_000);

			vi.setSystemTime(1_000_000 + 90_000);
			await verifyManagementClientSecret(db, { clientId: client.id, secret });
			let third = await db.find(managementClients, { id: client.id });
			expect(third?.last_used_at).toBe(1_000_000 + 90_000);
		} finally {
			vi.useRealTimers();
		}
	});

	test("rehashes a secret stored under a weaker policy on the next successful verify", async () => {
		let { client, secret } = await registerTestClient();

		// A genuinely weak but verifiable hash, the same shape an older deploy's
		// policy would have written — a lower `logN` actually derived under it,
		// not merely relabeled.
		let salt = randomBytes(16);
		let key = scryptSync(secret, salt, 32, { N: 2 ** 12, r: 8, p: 1 });
		let weakened = `$scrypt$ln=12,r=8,p=1$${Base64Url.encode(salt)}$${Base64Url.encode(new Uint8Array(key))}`;
		await db.update(managementClients, { id: client.id }, { secret_hash: weakened });

		await verifyManagementClientSecret(db, { clientId: client.id, secret });

		let row = await db.find(managementClients, { id: client.id });
		expect(row?.secret_hash).not.toBe(weakened);
		expect(password.needsRehash(row!.secret_hash)).toBe(false);
	});
});

describe("rotateManagementClientSecret", () => {
	test("replaces the stored secret in place, invalidating the old one", async () => {
		let { client, secret } = await registerTestClient();

		let rotated = await rotateManagementClientSecret(db, { clientId: client.id });
		if (!rotated.ok) throw new Error("unreachable");

		expect(rotated.secret).not.toBe(secret);
		expect(await verifyManagementClientSecret(db, { clientId: client.id, secret })).toEqual({
			ok: false,
		});
		expect(
			(await verifyManagementClientSecret(db, { clientId: client.id, secret: rotated.secret })).ok,
		).toBe(true);
	});

	test("refuses an unknown client", async () => {
		let result = await rotateManagementClientSecret(db, { clientId: "mgmt_missing" });
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});

	test("refuses a revoked client", async () => {
		let { client } = await registerTestClient();
		await revokeManagementClient(db, { clientId: client.id });

		let result = await rotateManagementClientSecret(db, { clientId: client.id });
		expect(result).toEqual({ ok: false, reason: "revoked" });
	});
});

describe("revokeManagementClient", () => {
	test("marks the client revoked", async () => {
		let { client } = await registerTestClient();

		let result = await revokeManagementClient(db, { clientId: client.id });
		expect(result).toEqual({ ok: true });

		let read = await readManagementClient(db, { clientId: client.id });
		expect(read?.revokedAt).not.toBeNull();
	});

	test("refuses an unknown client", async () => {
		let result = await revokeManagementClient(db, { clientId: "mgmt_missing" });
		expect(result).toEqual({ ok: false, reason: "not-found" });
	});
});

describe("readManagementClient", () => {
	test("answers null for an unknown client", async () => {
		expect(await readManagementClient(db, { clientId: "mgmt_missing" })).toBeNull();
	});
});

describe("listManagementClients", () => {
	test("pages a tenant's own clients, most recently registered first", async () => {
		let first = await registerTestClient();
		await new Promise((resolve) => setTimeout(resolve, 2));
		let second = await registerTestClient();

		let page = await listManagementClients(db, { tenantId: TENANT_ID, limit: 10 });
		if (!page.ok) throw new Error("unreachable");

		expect(page.clients.map((client) => client.id)).toEqual([second.client.id, first.client.id]);
	});

	test("never lists another tenant's clients", async () => {
		await registerTestClient();

		let customer = await Customer.create(db, { name: "Other" });
		let other = await Tenant.create(db, {
			customerId: customer.id,
			name: "Other",
			slug: "other",
			issuer: "https://other.auth.example.com",
		});

		let page = await listManagementClients(db, { tenantId: other.id });
		if (!page.ok) throw new Error("unreachable");

		expect(page.clients).toEqual([]);
	});
});
