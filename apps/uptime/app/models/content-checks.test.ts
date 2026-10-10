/**
 * Tests the content checks model: monitor-scoped listing and lookup, and the response-body
 * evaluation (`contains`/`not_contains`/`regex`, ANDed across every enabled check), over both
 * a stored row and an ad-hoc rule, since evaluation takes the structural `ContentCheckRule`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";
import type { ContentCheckRule } from "~/app/models/content-checks";
import type { SelectMonitorContentCheck } from "~/database/schema";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels } from "~/app/lib/test/models";
import { evaluateContentChecks } from "~/app/models/content-checks";
import { monitorContentChecks } from "~/database/schema";

let db: Database;
let models: UptimeModels;

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db);
});

/**
 * Seeds a content-check row straight into the table, so the monitor-scoped reads
 * have fixtures independent of the monitor-creation path.
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

describe("contentChecks.ofMonitor", () => {
	test("lists only checks for the given monitor", async () => {
		let checkA = await createCheck("monitor-1");
		await createCheck("monitor-2");

		let checks = await models.contentChecks.ofMonitor("monitor-1").all();
		expect(checks.map((check) => check.id)).toEqual([checkA.id]);
	});

	test("returns an empty array for a monitor with no checks", async () => {
		expect(await models.contentChecks.ofMonitor("monitor-1").all()).toEqual([]);
	});
});

describe("contentChecks.ofMonitor().find", () => {
	test("finds a check scoped to its monitor", async () => {
		let check = await createCheck("monitor-1");

		expect(await models.contentChecks.ofMonitor("monitor-1").find(check.id)).toEqual(check);
	});

	test("returns null when the check belongs to a different monitor", async () => {
		let check = await createCheck("monitor-1");

		expect(await models.contentChecks.ofMonitor("monitor-2").find(check.id)).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(await models.contentChecks.ofMonitor("monitor-1").find("missing")).toBeNull();
	});
});

/** Builds a fully shaped check in memory, for the evaluation tests. */
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

describe("evaluateContentChecks", () => {
	test("passes when there are no checks at all", () => {
		expect(evaluateContentChecks([], "anything")).toBe(true);
	});

	test("`contains` passes when the body includes the value", () => {
		expect(evaluateContentChecks([check({ type: "contains", value: "OK" })], "Status: OK")).toBe(
			true,
		);
	});

	test("`contains` fails when the body doesn't include the value", () => {
		expect(evaluateContentChecks([check({ type: "contains", value: "OK" })], "Status: down")).toBe(
			false,
		);
	});

	test("`not_contains` passes when the body doesn't include the value", () => {
		let checks = [check({ type: "not_contains", value: "error" })];
		expect(evaluateContentChecks(checks, "all good")).toBe(true);
	});

	test("`not_contains` fails when the body includes the value", () => {
		let checks = [check({ type: "not_contains", value: "error" })];
		expect(evaluateContentChecks(checks, "an error occurred")).toBe(false);
	});

	test("`regex` passes when the pattern matches", () => {
		let checks = [check({ type: "regex", value: "^Status: (OK|UP)$" })];
		expect(evaluateContentChecks(checks, "Status: OK")).toBe(true);
	});

	test("`regex` fails when the pattern doesn't match", () => {
		let checks = [check({ type: "regex", value: "^Status: (OK|UP)$" })];
		expect(evaluateContentChecks(checks, "Status: DOWN")).toBe(false);
	});

	test("matching is case-insensitive by default", () => {
		let checks = [check({ type: "contains", value: "ok", case_sensitive: false })];
		expect(evaluateContentChecks(checks, "Status: OK")).toBe(true);
	});

	test("matching is case-sensitive when configured", () => {
		let checks = [check({ type: "contains", value: "ok", case_sensitive: true })];
		expect(evaluateContentChecks(checks, "Status: OK")).toBe(false);
	});

	test("regex respects case sensitivity too", () => {
		let insensitive = [check({ type: "regex", value: "status", case_sensitive: false })];
		let sensitive = [check({ type: "regex", value: "status", case_sensitive: true })];
		expect(evaluateContentChecks(insensitive, "Status: OK")).toBe(true);
		expect(evaluateContentChecks(sensitive, "Status: OK")).toBe(false);
	});

	test("disabled checks are ignored even when they would fail", () => {
		let checks = [check({ type: "contains", value: "never matches", is_enabled: false })];
		expect(evaluateContentChecks(checks, "anything")).toBe(true);
	});

	test("every enabled check must pass (logical AND)", () => {
		let checks = [
			check({ id: "c1", type: "contains", value: "OK" }),
			check({ id: "c2", type: "not_contains", value: "error" }),
		];
		expect(evaluateContentChecks(checks, "Status: OK, no problems")).toBe(true);
		expect(evaluateContentChecks(checks, "Status: OK, error occurred")).toBe(false);
	});

	test("an unrecognized type fails rather than passing silently", () => {
		expect(evaluateContentChecks([check({ type: "jsonpath", value: "OK" })], "Status: OK")).toBe(
			false,
		);
	});

	test("a rule that was never persisted evaluates exactly like the stored row would", () => {
		/**
		 * The bare shape an ad-hoc ping supplies in its request body, which stays in memory. It
		 * has to reach the same verdict as the stored check beside it, or the endpoint and the
		 * monitor would disagree about the same response body.
		 */
		let rule: ContentCheckRule = {
			type: "contains",
			value: "OK",
			case_sensitive: false,
			is_enabled: true,
		};
		let stored = check({ type: "contains", value: "OK" });

		expect(evaluateContentChecks([rule], "Status: OK")).toBe(
			evaluateContentChecks([stored], "Status: OK"),
		);
		expect(evaluateContentChecks([rule], "Status: down")).toBe(
			evaluateContentChecks([stored], "Status: down"),
		);
		expect(evaluateContentChecks([rule], "Status: OK")).toBe(true);
		expect(evaluateContentChecks([rule], "Status: down")).toBe(false);
	});

	test("mixes a persisted row and a bare rule in one evaluation", () => {
		let rules: ContentCheckRule[] = [
			check({ type: "contains", value: "OK" }),
			{ type: "not_contains", value: "error", case_sensitive: false, is_enabled: true },
		];

		expect(evaluateContentChecks(rules, "Status: OK")).toBe(true);
		expect(evaluateContentChecks(rules, "Status: OK, error occurred")).toBe(false);
	});
});
