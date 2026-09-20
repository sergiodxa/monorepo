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
				"0014-audit",
				"0015-totp",
				"0016-second-factor-sign-in",
				"0017-step-up",
				"0018-connections",
			],
			issuer: "https://tenant-1.example.com",
			keys: { keys: [expect.objectContaining({ kty: "EC", alg: "ES256" })] },
		});

		let rows = [...state.storage.sql.exec(`SELECT * FROM settings`)];
		expect(rows).toEqual([
			{
				tenant_id: "tenant_1",
				issuer: "https://tenant-1.example.com",
				mfa_policy: "optional",
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
		expect(refused).toMatchObject({ ok: false, reason: "dau_cap_reached" });

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

describe("audit", () => {
	test("readAuditPage answers rows a wired operation already wrote", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let page = await tenant.readAuditPage({
			from: 0,
			to: Date.now() + 60_000,
			action: "subject.created",
		});

		expect(page).toMatchObject({
			ok: true,
			events: [{ targetId: created.subjectId, outcome: "succeeded" }],
		});
	});

	test("enforceAuditRetention enforces the Free tier's window by default, with no enforcement record ever written", async () => {
		// Any awaited RPC call waits on the schema this object's constructor is
		// still migrating, so calling one first is what makes the raw insert
		// below land on a database that already has the table.
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		state.storage.sql.exec(
			`INSERT INTO audit_events (id, at, action, actor_type, actor_id, target_type, target_id, outcome, context, detail)
			 VALUES ('000000000000000', ?, 'subject.created', 'platform', 'system', 'subject', 'sub_old', 'succeeded', '{}', '{}')`,
			eightDaysAgo,
		);

		let result = await tenant.enforceAuditRetention();

		expect(result.deleted).toBe(1);
	});

	test("enforceAuditRetention reads the tenant's own retention window once applyEntitlements has written one", async () => {
		await tenant.applyEntitlements({
			plan: "pro",
			features: {},
			dauCap: 2500,
			auditRetentionDays: 30,
			effectiveAt: Date.now(),
		});

		let eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
		state.storage.sql.exec(
			`INSERT INTO audit_events (id, at, action, actor_type, actor_id, target_type, target_id, outcome, context, detail)
			 VALUES ('000000000000001', ?, 'subject.created', 'platform', 'system', 'subject', 'sub_old', 'succeeded', '{}', '{}')`,
			eightDaysAgo,
		);

		// Eight days old is inside a 30-day window, so the Pro tier's own retention
		// keeps the row a default (Free) window would already have swept.
		let result = await tenant.enforceAuditRetention();

		expect(result.deleted).toBe(0);
	});

	test("drainAuditEvents answers rows after a position", async () => {
		let created = await tenant.createSubject({});
		if (!created.ok) throw new Error("unreachable");

		let drained = await tenant.drainAuditEvents({});

		expect(drained.events).toMatchObject([{ targetId: created.subjectId }]);
		expect(drained.next).toBe(drained.events[0]?.id);
	});
});

describe("cost envelope", () => {
	test("every RPC method's own result carries rowsRead, rowsWritten and durationMs", async () => {
		let result = await tenant.createSubject({});

		expect(result.ok).toBe(true);
		expect(result.cost.rowsWritten).toBeGreaterThanOrEqual(1);
		expect(result.cost.rowsRead).toBeGreaterThanOrEqual(0);
		expect(typeof result.cost.durationMs).toBe("number");
		expect(result.cost.durationMs).toBeGreaterThanOrEqual(0);
	});

	test("resets between calls rather than accumulating across the object's lifetime", async () => {
		let first = await tenant.createSubject({});
		let second = await tenant.createSubject({});

		expect(first.cost.rowsWritten).toBeGreaterThanOrEqual(1);
		expect(second.cost.rowsWritten).toBeGreaterThanOrEqual(1);

		// A second, independent create writes about the same number of rows as the
		// first — if counters leaked across calls, the second would report roughly
		// double what the first did instead.
		expect(second.cost.rowsWritten).toBeLessThan(first.cost.rowsWritten * 2);
	});

	test("a read-only call reports rows read and no rows written", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });

		let result = await tenant.readUsage({ from: 0, to: Date.now() });

		expect(Array.isArray(result)).toBe(true);
		expect(result.cost.rowsWritten).toBe(0);
		expect(typeof result.cost.durationMs).toBe("number");
	});
});

describe("reportStorageFootprint", () => {
	test("reports the right row count across at least two tables, and a positive database size", async () => {
		await tenant.provision({ tenantId: "tenant_1", issuer: "https://tenant-1.example.com" });

		let first = await tenant.createSubject({});
		if (!first.ok) throw new Error("unreachable");
		let second = await tenant.createSubject({});
		if (!second.ok) throw new Error("unreachable");

		await tenant.addIdentifier({
			subjectId: first.subjectId,
			kind: "email",
			value: "jane@example.com",
			actor: { kind: "subject" },
		});

		let report = await tenant.reportStorageFootprint();

		expect(report.rows.subjects).toBe(2);
		expect(report.rows.subject_identifiers).toBe(1);
		expect(report.databaseSize).toBeGreaterThan(0);
		expect(typeof report.cost.durationMs).toBe("number");
	});
});
