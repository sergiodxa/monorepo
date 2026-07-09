/**
 * Unit tests for the `ContentCheck` data-access model: monitor-scoped listing/lookup,
 * and the response-body evaluation logic (`contains`/`not_contains`/`regex`, ANDed
 * across every enabled check) that decides whether a monitor's content check passes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { SelectMonitorContentCheck } from "~/database/schema";

import ContentCheck from "~/app/data/content-check";
import { createTestDatabase } from "~/app/lib/test/db";
import { monitorContentChecks } from "~/database/schema";

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/**
 * Inserts a content-check row directly — `ContentCheck` exposes no `create` method
 * (checks are written as part of monitor creation elsewhere), so seeding fixtures for
 * `listByMonitor`/`findByIdForMonitor` requires writing straight to the table.
 */
async function createCheck(monitorId: string, overrides: Partial<SelectMonitorContentCheck> = {}) {
	return await db.create(
		monitorContentChecks,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			type: "contains",
			value: "OK",
			case_sensitive: false,
			is_enabled: true,
			...overrides,
		},
		{ touch: true, returnRow: true },
	);
}

describe("ContentCheck.listByMonitor", () => {
	test("lists only checks for the given monitor", async () => {
		let checkA = await createCheck("monitor-1");
		await createCheck("monitor-2");

		let checks = await ContentCheck.listByMonitor(db, "monitor-1");
		expect(checks.map((check) => check.id)).toEqual([checkA.id]);
	});

	test("returns an empty array for a monitor with no checks", async () => {
		expect(await ContentCheck.listByMonitor(db, "monitor-1")).toEqual([]);
	});
});

describe("ContentCheck.findByIdForMonitor", () => {
	test("finds a check scoped to its monitor", async () => {
		let check = await createCheck("monitor-1");

		expect(await ContentCheck.findByIdForMonitor(db, "monitor-1", check.id)).toEqual(check);
	});

	test("returns null when the check belongs to a different monitor", async () => {
		let check = await createCheck("monitor-1");

		expect(await ContentCheck.findByIdForMonitor(db, "monitor-2", check.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await ContentCheck.findByIdForMonitor(db, "monitor-1", "missing")).toBeNull();
	});
});

/** Builds an in-memory check without touching the database, for `evaluate()` tests. */
function check(overrides: Partial<SelectMonitorContentCheck>): SelectMonitorContentCheck {
	return {
		id: "check-1",
		created_at: 0,
		updated_at: 0,
		monitor_id: "monitor-1",
		type: "contains",
		value: "OK",
		case_sensitive: false,
		is_enabled: true,
		...overrides,
	};
}

describe("ContentCheck.evaluate", () => {
	test("passes when there are no checks at all", () => {
		expect(ContentCheck.evaluate([], "anything")).toBe(true);
	});

	test("`contains` passes when the body includes the value", () => {
		expect(ContentCheck.evaluate([check({ type: "contains", value: "OK" })], "Status: OK")).toBe(
			true,
		);
	});

	test("`contains` fails when the body doesn't include the value", () => {
		expect(ContentCheck.evaluate([check({ type: "contains", value: "OK" })], "Status: down")).toBe(
			false,
		);
	});

	test("`not_contains` passes when the body doesn't include the value", () => {
		let checks = [check({ type: "not_contains", value: "error" })];
		expect(ContentCheck.evaluate(checks, "all good")).toBe(true);
	});

	test("`not_contains` fails when the body includes the value", () => {
		let checks = [check({ type: "not_contains", value: "error" })];
		expect(ContentCheck.evaluate(checks, "an error occurred")).toBe(false);
	});

	test("`regex` passes when the pattern matches", () => {
		let checks = [check({ type: "regex", value: "^Status: (OK|UP)$" })];
		expect(ContentCheck.evaluate(checks, "Status: OK")).toBe(true);
	});

	test("`regex` fails when the pattern doesn't match", () => {
		let checks = [check({ type: "regex", value: "^Status: (OK|UP)$" })];
		expect(ContentCheck.evaluate(checks, "Status: DOWN")).toBe(false);
	});

	test("matching is case-insensitive by default", () => {
		let checks = [check({ type: "contains", value: "ok", case_sensitive: false })];
		expect(ContentCheck.evaluate(checks, "Status: OK")).toBe(true);
	});

	test("matching is case-sensitive when configured", () => {
		let checks = [check({ type: "contains", value: "ok", case_sensitive: true })];
		expect(ContentCheck.evaluate(checks, "Status: OK")).toBe(false);
	});

	test("regex respects case sensitivity too", () => {
		let insensitive = [check({ type: "regex", value: "status", case_sensitive: false })];
		let sensitive = [check({ type: "regex", value: "status", case_sensitive: true })];
		expect(ContentCheck.evaluate(insensitive, "Status: OK")).toBe(true);
		expect(ContentCheck.evaluate(sensitive, "Status: OK")).toBe(false);
	});

	test("disabled checks are ignored even when they would fail", () => {
		let checks = [check({ type: "contains", value: "never matches", is_enabled: false })];
		expect(ContentCheck.evaluate(checks, "anything")).toBe(true);
	});

	test("every enabled check must pass (logical AND)", () => {
		let checks = [
			check({ id: "c1", type: "contains", value: "OK" }),
			check({ id: "c2", type: "not_contains", value: "error" }),
		];
		expect(ContentCheck.evaluate(checks, "Status: OK, no problems")).toBe(true);
		expect(ContentCheck.evaluate(checks, "Status: OK, error occurred")).toBe(false);
	});
});
