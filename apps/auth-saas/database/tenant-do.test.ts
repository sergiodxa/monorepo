/**
 * Drives the tenant Durable Object by construction, against a real SQLite database, the
 * way other Durable Objects in this repo are tested: through `@sdxc/cloudflare-mocks`
 * rather than a stubbed namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Tenant from "./tenant-do";

let state: DurableObjectStateMock;
let tenant: Tenant;

beforeEach(() => {
	state = createDurableObjectState();
	tenant = new Tenant(state, {} as Cloudflare.Env);
});

describe("provision", () => {
	test("applies the schema and records the tenant's id and issuer", async () => {
		let result = await tenant.provision({
			tenantId: "tenant_1",
			issuer: "https://tenant-1.example.com",
		});

		expect(result).toEqual({
			applied: [
				"0001-init",
				"0002-subjects",
				"0003-passwords",
				"0004-passkeys",
				"0005-sessions",
				"0006-signing-keys",
				"0007-clients",
				"0008-consent",
				"0009-authorization",
				"0010-tokens",
				"0011-mail-rate-limit",
				"0012-entitlements",
				"0013-dau",
			],
			issuer: "https://tenant-1.example.com",
			keys: { keys: [expect.objectContaining({ kty: "EC", alg: "ES256" })] },
		});

		let rows = [...state.storage.sql.exec(`SELECT * FROM settings`)];
		expect(rows).toEqual([
			{
				tenant_id: "tenant_1",
				issuer: "https://tenant-1.example.com",
				created_at: expect.any(Number),
			},
		]);
	});

	test("updates the issuer on a later boot, applying no new migration", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://old.example.com" });

		// A later boot constructs a fresh object over the same storage, the way a real
		// cold start would; its own migration run finds nothing left to apply.
		let rebooted = new Tenant(state, {} as Cloudflare.Env);
		let result = await rebooted.provision({
			tenantId: "tenant_1",
			issuer: "https://new.example.com",
		});

		expect(result.applied).toEqual([]);
		expect(result.issuer).toBe("https://new.example.com");

		let rows = [...state.storage.sql.exec<{ issuer: string }>(`SELECT issuer FROM settings`)];
		expect(rows).toEqual([{ issuer: "https://new.example.com" }]);
	});

	test("generates no redundant signing key on a second call", async () => {
		let first = await tenant.provision({
			tenantId: "tenant_1",
			issuer: "https://tenant-1.example.com",
		});

		let second = await tenant.provision({
			tenantId: "tenant_1",
			issuer: "https://tenant-1.example.com",
		});

		expect(second.keys).toEqual(first.keys);

		let rows = [...state.storage.sql.exec(`SELECT id FROM signing_keys`)];
		expect(rows).toHaveLength(1);
	});
});

describe("erase", () => {
	test("destroys the object's storage", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });

		let deleteAll = vi.spyOn(state.storage, "deleteAll");
		await tenant.erase();

		expect(deleteAll).toHaveBeenCalledTimes(1);
	});
});

/** Creates a subject with a verified email and a set password, ready to sign in with. */
async function createSubjectWithPassword(email: string, password: string): Promise<string> {
	let created = await tenant.createSubject({ identifiers: [{ kind: "email", value: email }] });
	if (!created.ok) throw new Error("unreachable");

	let added = await tenant.addIdentifier({
		subjectId: created.subjectId,
		kind: "email",
		value: email,
		actor: { kind: "subject" },
	});
	if (!added.ok || added.kind !== "email") throw new Error("unreachable");

	await tenant.verifyIdentifier({ ticket: added.ticket });

	let written = await tenant.setPassword({
		subjectId: created.subjectId,
		password,
		actor: { kind: "subject" },
	});
	if (!written.ok) throw new Error("unreachable");

	return created.subjectId;
}

describe("daily active user metering", () => {
	test("enforces the free cap by default, with no enforcement record ever written", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });
		await createSubjectWithPassword("jane@example.com", "correct horse battery staple");

		let result = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});

		expect(result).toMatchObject({ ok: true, metering: { cap: 100, subjects: 1 } });
	});

	test("carries the isolate's own cache across separate RPC calls", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });
		await createSubjectWithPassword("jane@example.com", "correct horse battery staple");
		await tenant.applyEntitlements({
			plan: "free",
			features: {},
			dauCap: 1,
			auditRetentionDays: 7,
			effectiveAt: Date.now(),
		});

		let first = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		expect(first).toMatchObject({ ok: true, metering: { subjects: 1 } });

		// A second sign-in by the same, already-counted subject never refuses, even
		// though the cap of 1 has already been reached.
		let second = await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		expect(second).toMatchObject({ ok: true });
	});

	test("refuses a new subject past a hard cap, and admits one once applyEntitlements raises it", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });
		await createSubjectWithPassword("jane@example.com", "correct horse battery staple");
		await createSubjectWithPassword("john@example.com", "correct horse battery staple");
		await tenant.applyEntitlements({
			plan: "free",
			features: {},
			dauCap: 1,
			auditRetentionDays: 7,
			effectiveAt: Date.now(),
		});

		await tenant.signInWithPassword({
			identifier: "jane@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});

		let refused = await tenant.signInWithPassword({
			identifier: "john@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		expect(refused).toEqual({ ok: false, reason: "dau_cap_reached" });

		await tenant.applyEntitlements({
			plan: "pro",
			features: {},
			dauCap: 2500,
			auditRetentionDays: 30,
			effectiveAt: Date.now(),
		});

		let admitted = await tenant.signInWithPassword({
			identifier: "john@example.com",
			password: "correct horse battery staple",
			remembered: false,
		});
		expect(admitted).toMatchObject({ ok: true });
	});
});
