/**
 * Exercises `audit-events.ts` directly against a `Database` over a real
 * SQLite-backed `SqlStorage`, the way `mail-rate-limit.test.ts` drives its own
 * leaf module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createDurableObjectState } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import {
	auditEvents,
	drainAuditEvents,
	enforceAuditRetention,
	readAuditPage,
	writeAuditEvent,
} from "./audit-events";
import auditMigration from "./tenant-migrations/0014-audit.sql?raw";

const T0 = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
	let state = createDurableObjectState();
	let driver = createSQLStorageDatabaseAdapter(state.storage.sql);
	await driver.executeScript(auditMigration);
	db = new Database(driver);
});

describe("writeAuditEvent", () => {
	test("inserts a well-formed row", async () => {
		await writeAuditEvent(db, {
			action: "subject.blocked",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "sub_1",
			outcome: "succeeded",
			context: { ip: "203.0.113.9" },
			detail: { reason: "fraud" },
			at: T0,
		});

		let rows = await db.findMany(auditEvents);
		expect(rows).toEqual([
			{
				id: expect.stringMatching(/^\d{15}$/),
				at: T0,
				action: "subject.blocked",
				actor_type: "platform",
				actor_id: "system",
				target_type: "subject",
				target_id: "sub_1",
				outcome: "succeeded",
				context: { ip: "203.0.113.9" },
				detail: { reason: "fraud" },
			},
		]);
	});

	test("defaults context and detail to an empty object when omitted", async () => {
		await writeAuditEvent(db, {
			action: "subject.unblocked",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "sub_1",
			outcome: "succeeded",
		});

		let [row] = await db.findMany(auditEvents);
		expect(row?.context).toEqual({});
		expect(row?.detail).toEqual({});
	});

	test("mints ids that are monotonic in insertion order", async () => {
		for (let index = 0; index < 5; index++) {
			await writeAuditEvent(db, {
				action: "subject.updated",
				actor: { type: "platform", id: "system" },
				targetType: "subject",
				targetId: `sub_${index}`,
				outcome: "succeeded",
				at: T0,
			});
		}

		let rows = await db.findMany(auditEvents, { orderBy: ["id", "asc"] });
		let ids = rows.map((row) => row.id);

		expect(ids).toEqual([...ids].sort());
		expect(new Set(ids).size).toBe(5);
		expect(rows.map((row) => row.target_id)).toEqual(["sub_0", "sub_1", "sub_2", "sub_3", "sub_4"]);
	});
});

describe("readAuditPage", () => {
	async function seed(count: number): Promise<void> {
		for (let index = 0; index < count; index++) {
			await writeAuditEvent(db, {
				action: index % 2 === 0 ? "subject.updated" : "subject.blocked",
				actor: { type: "platform", id: "system" },
				targetType: "subject",
				targetId: `sub_${index}`,
				outcome: "succeeded",
				at: T0 + index,
			});
		}
	}

	test("answers a full page, newest first", async () => {
		await seed(3);

		let page = await readAuditPage(db, { from: T0, to: T0 + 1000, limit: 10 });
		expect(page.ok).toBe(true);
		if (!page.ok) return;

		expect(page.events.map((event) => event.targetId)).toEqual(["sub_2", "sub_1", "sub_0"]);
		expect(page.cursors.next).toBeNull();
	});

	test("walks a cursor across pages without repeating or skipping rows", async () => {
		await seed(5);

		let first = await readAuditPage(db, { from: T0, to: T0 + 1000, limit: 2 });
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		expect(first.events.map((event) => event.targetId)).toEqual(["sub_4", "sub_3"]);
		expect(first.cursors.next).not.toBeNull();

		let second = await readAuditPage(db, {
			from: T0,
			to: T0 + 1000,
			limit: 2,
			cursor: first.cursors.next,
		});
		expect(second.ok).toBe(true);
		if (!second.ok) return;
		expect(second.events.map((event) => event.targetId)).toEqual(["sub_2", "sub_1"]);

		let third = await readAuditPage(db, {
			from: T0,
			to: T0 + 1000,
			limit: 2,
			cursor: second.cursors.next,
		});
		expect(third.ok).toBe(true);
		if (!third.ok) return;
		expect(third.events.map((event) => event.targetId)).toEqual(["sub_0"]);
		expect(third.cursors.next).toBeNull();
	});

	test("answers an empty page past the end", async () => {
		await seed(1);

		let page = await readAuditPage(db, { from: T0, to: T0 + 1000, limit: 10 });
		expect(page.ok).toBe(true);
		if (!page.ok || page.cursors.next === null) return;

		let next = await readAuditPage(db, {
			from: T0,
			to: T0 + 1000,
			limit: 10,
			cursor: page.cursors.next,
		});
		expect(next).toEqual({
			ok: true,
			events: [],
			cursors: { next: null, prev: expect.any(String) },
		});
	});

	test("narrows by action", async () => {
		await seed(4);

		let page = await readAuditPage(db, {
			from: T0,
			to: T0 + 1000,
			action: "subject.blocked",
			limit: 10,
		});
		expect(page.ok).toBe(true);
		if (!page.ok) return;

		expect(page.events.every((event) => event.action === "subject.blocked")).toBe(true);
		expect(page.events.map((event) => event.targetId).sort()).toEqual(["sub_1", "sub_3"]);
	});

	test("narrows by actorId and targetId", async () => {
		await writeAuditEvent(db, {
			action: "client.created",
			actor: { type: "platform", id: "system" },
			targetType: "client",
			targetId: "client_1",
			outcome: "succeeded",
			at: T0,
		});
		await writeAuditEvent(db, {
			action: "client.created",
			actor: { type: "member", id: "member_9" },
			targetType: "client",
			targetId: "client_2",
			outcome: "succeeded",
			at: T0 + 1,
		});

		let byActor = await readAuditPage(db, { from: T0, to: T0 + 1000, actorId: "member_9" });
		expect(byActor.ok && byActor.events.map((event) => event.targetId)).toEqual(["client_2"]);

		let byTarget = await readAuditPage(db, { from: T0, to: T0 + 1000, targetId: "client_1" });
		expect(byTarget.ok && byTarget.events.map((event) => event.actorId)).toEqual(["system"]);
	});

	test("refuses a cursor that does not decode", async () => {
		let page = await readAuditPage(db, { from: T0, to: T0 + 1000, cursor: "not-a-cursor" });
		expect(page).toEqual({ ok: false, reason: "bad-cursor" });
	});
});

describe("enforceAuditRetention", () => {
	test("deletes only rows older than the retention window", async () => {
		let now = T0 + 30 * 24 * 60 * 60 * 1000;

		await writeAuditEvent(db, {
			action: "subject.updated",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "old",
			outcome: "succeeded",
			at: T0,
		});
		await writeAuditEvent(db, {
			action: "subject.updated",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "recent",
			outcome: "succeeded",
			at: now - 60 * 60 * 1000,
		});

		let result = await enforceAuditRetention(db, { retentionDays: 7, now });
		expect(result.deleted).toBe(1);

		let remaining = await db.findMany(auditEvents);
		expect(remaining.map((row) => row.target_id)).toEqual(["recent"]);
		expect(result.oldestRemaining).toBe(now - 60 * 60 * 1000);
	});

	test("respects the batch limit", async () => {
		let now = T0 + 30 * 24 * 60 * 60 * 1000;

		for (let index = 0; index < 5; index++) {
			await writeAuditEvent(db, {
				action: "subject.updated",
				actor: { type: "platform", id: "system" },
				targetType: "subject",
				targetId: `sub_${index}`,
				outcome: "succeeded",
				at: T0 + index,
			});
		}

		let result = await enforceAuditRetention(db, { retentionDays: 7, now, limit: 2 });
		expect(result.deleted).toBe(2);

		let remaining = await db.count(auditEvents);
		expect(remaining).toBe(3);
	});

	test("is safe to call repeatedly, answering deleted: 0 once nothing is left to prune", async () => {
		let now = T0 + 30 * 24 * 60 * 60 * 1000;

		await writeAuditEvent(db, {
			action: "subject.updated",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "old",
			outcome: "succeeded",
			at: T0,
		});

		let first = await enforceAuditRetention(db, { retentionDays: 7, now });
		expect(first.deleted).toBe(1);

		let second = await enforceAuditRetention(db, { retentionDays: 7, now });
		expect(second).toEqual({ deleted: 0, oldestRemaining: null });
	});
});

describe("drainAuditEvents", () => {
	test("answers rows after a position, and the position to resume from", async () => {
		for (let index = 0; index < 3; index++) {
			await writeAuditEvent(db, {
				action: "subject.updated",
				actor: { type: "platform", id: "system" },
				targetType: "subject",
				targetId: `sub_${index}`,
				outcome: "succeeded",
				at: T0 + index,
			});
		}

		let first = await drainAuditEvents(db, {});
		expect(first.events.map((event) => event.targetId)).toEqual(["sub_0", "sub_1", "sub_2"]);
		expect(first.next).toBe(first.events[2]?.id);

		let second = await drainAuditEvents(db, { after: first.next });
		expect(second).toEqual({ events: [], next: first.next });

		await writeAuditEvent(db, {
			action: "subject.updated",
			actor: { type: "platform", id: "system" },
			targetType: "subject",
			targetId: "sub_3",
			outcome: "succeeded",
			at: T0 + 3,
		});

		let third = await drainAuditEvents(db, { after: first.next });
		expect(third.events.map((event) => event.targetId)).toEqual(["sub_3"]);
	});
});
