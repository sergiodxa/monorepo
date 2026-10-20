/**
 * Tests for flow Performance-trace storage: key shape, upload/read/delete, the
 * seven-day clean sweep, and the daily-digest listing of yesterday's traces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid/v4";
import { createMemoryFileStorage } from "remix/file-storage/memory";
import { beforeEach, describe, expect, test } from "vitest";

import {
	deleteExpiredFlowTraces,
	flowTraceKey,
	listDigestFlowTraces,
	readFlowTrace,
	storeFlowTrace,
} from "~/app/models/flow-traces";
import { createTestDatabase } from "~/app/test/db";
import { flowMonitorResults, flowMonitors } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

describe("flowTraceKey", () => {
	test("scopes the object by team, monitor and result", () => {
		expect(flowTraceKey("team-1", "monitor-1", "result-1")).toBe(
			"flow-traces/team-1/monitor-1/result-1.json",
		);
	});
});

describe("storeFlowTrace / readFlowTrace", () => {
	test("round-trips chrome://tracing JSON through the store", async () => {
		let storage = createMemoryFileStorage();
		let key = flowTraceKey("team-1", "monitor-1", "result-1");
		let json = '{"traceEvents":[{"name":"EvaluateScript"}]}';

		await storeFlowTrace(storage, key, json);

		let bytes = await readFlowTrace(storage, key);
		expect(bytes).not.toBeNull();
		expect(new TextDecoder().decode(bytes ?? undefined)).toBe(json);
	});

	test("returns null when the key was never written", async () => {
		let storage = createMemoryFileStorage();

		expect(await readFlowTrace(storage, "missing.json")).toBeNull();
	});
});

describe("deleteExpiredFlowTraces", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];
	let storage: ReturnType<typeof createMemoryFileStorage>;

	beforeEach(() => {
		({ db } = createTestDatabase());
		storage = createMemoryFileStorage();
	});

	async function seedResult(id: string, checkedAt: number, key: string | null) {
		await db.create(flowMonitorResults, {
			id,
			flow_monitor_id: "monitor-1",
			status: "up",
			tests_total: 1,
			tests_passed: 1,
			tests_failed: 0,
			requests_made: 1,
			failed_test: null,
			failed_at_line: null,
			failure_detail: null,
			duration_ms: 10,
			error_message: null,
			trace_key: key,
			checked_at: checkedAt,
		});
		if (key !== null) await storeFlowTrace(storage, key, '{"traceEvents":[]}');
	}

	test("removes objects older than seven days and nulls their keys", async () => {
		let now = Date.now();
		let expired = "flow-traces/team-1/monitor-1/old.json";
		let recent = "flow-traces/team-1/monitor-1/recent.json";
		await seedResult("old", now - 8 * MS_PER_DAY, expired);
		await seedResult("recent", now - 1 * MS_PER_DAY, recent);

		let swept = await deleteExpiredFlowTraces(db, storage, now);

		expect(swept).toMatchObject({ rowsAffected: 1, reachedCeiling: false });
		expect(await readFlowTrace(storage, expired)).toBeNull();
		expect(await readFlowTrace(storage, recent)).not.toBeNull();
		expect((await db.find(flowMonitorResults, "old"))?.trace_key).toBeNull();
		expect((await db.find(flowMonitorResults, "recent"))?.trace_key).toBe(recent);
	});

	test("keeps the result row itself after the object is gone", async () => {
		let now = Date.now();
		await seedResult("old", now - 8 * MS_PER_DAY, "flow-traces/team-1/monitor-1/old.json");

		await deleteExpiredFlowTraces(db, storage, now);

		expect(await db.find(flowMonitorResults, "old")).not.toBeNull();
	});
});

describe("listDigestFlowTraces", () => {
	let db: ReturnType<typeof createTestDatabase>["db"];

	beforeEach(() => {
		({ db } = createTestDatabase());
	});

	async function seedMonitor(teamId: string, name: string) {
		return await db.create(
			flowMonitors,
			{
				id: generateUUID(),
				team_id: teamId,
				name,
				source: 'get "https://example.com"',
				is_enabled: true,
			},
			{ touch: true, returnRow: true },
		);
	}

	async function seedResult(monitorId: string, checkedAt: number, traceKey: string | null) {
		return await db.create(
			flowMonitorResults,
			{
				id: generateUUID(),
				flow_monitor_id: monitorId,
				status: "up",
				tests_total: 1,
				tests_passed: 1,
				tests_failed: 0,
				requests_made: 1,
				failed_test: null,
				failed_at_line: null,
				failure_detail: null,
				duration_ms: 10,
				error_message: null,
				trace_key: traceKey,
				checked_at: checkedAt,
			},
			{ returnRow: true },
		);
	}

	test("lists yesterday's traced runs for one team, newest first", async () => {
		let dayStart = Date.parse("2026-08-02T00:00:00.000Z");
		let dayEnd = dayStart + MS_PER_DAY;
		let checkout = await seedMonitor("team-1", "Checkout");
		let signup = await seedMonitor("team-1", "Signup");
		let otherTeam = await seedMonitor("team-2", "Other");
		let older = await seedResult(checkout.id, dayStart + 1_000, "k-old");
		let newer = await seedResult(signup.id, dayStart + 3_600_000, "k-new");
		await seedResult(checkout.id, dayStart + 2_000, null);
		await seedResult(checkout.id, dayStart - 1, "k-before");
		await seedResult(checkout.id, dayEnd, "k-after");
		await seedResult(otherTeam.id, dayStart + 2_000, "k-other");

		let listed = await listDigestFlowTraces(db, "team-1", dayStart, dayEnd);

		expect(listed).toEqual([
			{ resultId: newer.id, monitorId: signup.id, monitorName: "Signup" },
			{ resultId: older.id, monitorId: checkout.id, monitorName: "Checkout" },
		]);
	});
});
