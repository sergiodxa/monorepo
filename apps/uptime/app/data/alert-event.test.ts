/**
 * Unit tests for the `AlertEvent` data-access model: recording delivery outcomes, the
 * cooldown check `app/services/alerts.ts` uses to gate re-firing, the per-incident send
 * count and totals that bound and explain that repetition, and the recent-events listing
 * used by the alerts UI.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	Database,
	DataManipulationOperation,
	DataManipulationResult,
	DatabaseDriver,
} from "remix/data-table";

import { beforeEach, describe, expect, test } from "vitest";

import type { SelectAlertEvent } from "~/database/schema";

import AlertEvent from "~/app/data/alert-event";
import { createTestDatabase } from "~/app/lib/test/db";
import { alertEvents } from "~/database/schema";

/**
 * Patches a test database's driver so writes to the given JSON-typed columns are
 * `JSON.stringify`-d before binding and `JSON.parse`-d back on read. The SQLite
 * test adapter binds column values as-is with no column-type awareness, so passing a
 * plain object into a `c.json()` column (here, `snapshot`) throws at the SQLite
 * binding layer. This codec is required to exercise `record()`'s snapshot branch
 * against the real database instead of mocking the model away.
 */
function patchJsonColumns(adapter: DatabaseDriver, columns: string[]): void {
	let originalExecute = adapter.execute.bind(adapter);

	adapter.execute = async (request) => {
		let operation = encodeJsonColumns(request.operation, columns);
		let result = await originalExecute({ ...request, operation });
		return decodeJsonColumns(result, columns);
	};
}

function encodeRow(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
	let output = { ...row };
	for (let column of columns) {
		if (column in output && output[column] !== null && typeof output[column] !== "string") {
			output[column] = JSON.stringify(output[column]);
		}
	}
	return output;
}

function encodeJsonColumns(
	operation: DataManipulationOperation,
	columns: string[],
): DataManipulationOperation {
	if (operation.kind === "insert") {
		return { ...operation, values: encodeRow(operation.values, columns) };
	}
	if (operation.kind === "update") {
		return { ...operation, changes: encodeRow(operation.changes, columns) };
	}
	return operation;
}

function decodeJsonColumns(
	result: DataManipulationResult,
	columns: string[],
): DataManipulationResult {
	if (!result.rows) return result;

	return {
		...result,
		rows: result.rows.map((row) => {
			let output = { ...row };
			for (let column of columns) {
				if (column in output && typeof output[column] === "string") {
					try {
						output[column] = JSON.parse(output[column] as string);
					} catch {
						// Not JSON — leave the raw string as-is.
					}
				}
			}
			return output;
		}),
	};
}

let db: Database;

beforeEach(() => {
	let database = createTestDatabase();
	db = database.db;
	patchJsonColumns(database.adapter, ["snapshot"]);
});

/**
 * Records one event for `alert-1`/`monitor-1` backdated by `agoMs`, so a whole incident
 * can be laid out in order — `record()` always stamps `Date.now()`.
 */
async function recordAt(
	agoMs: number,
	event_type: SelectAlertEvent["event_type"],
	status: SelectAlertEvent["status"],
): Promise<void> {
	let row = await AlertEvent.record(db, {
		alert_id: "alert-1",
		monitor_id: "monitor-1",
		event_type,
		status,
		error_message: null,
		monitor_type: "http",
		monitor_name: "My site",
	});
	await db.update(alertEvents, row.id, { sent_at: Date.now() - agoMs });
}

describe("AlertEvent.record", () => {
	test("records a sent event and returns the created row", async () => {
		let row = await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		expect(row.id).toBeTruthy();
		expect(row.alert_id).toBe("alert-1");
		expect(row.monitor_id).toBe("monitor-1");
		expect(row.event_type).toBe("down");
		expect(row.status).toBe("sent");
		expect(row.monitor_type).toBe("http");
		expect(row.monitor_name).toBe("My site");
		expect(row.snapshot).toBeNull();
		expect(typeof row.sent_at).toBe("number");
		expect(typeof row.created_at).toBe("number");
	});

	test("records a snapshot and round-trips it as an object", async () => {
		let row = await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
			snapshot: {
				type: "http",
				responseStatus: 500,
				responseTimeMs: 1200,
				expectedStatus: 200,
				url: "https://example.com",
			},
		});

		expect(row.snapshot).toEqual({
			type: "http",
			responseStatus: 500,
			responseTimeMs: 1200,
			expectedStatus: 200,
			url: "https://example.com",
		});
	});

	test("records a failed delivery with an error message", async () => {
		let row = await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "up",
			status: "failed",
			error_message: "webhook timed out",
			monitor_type: null,
			monitor_name: null,
		});

		expect(row.status).toBe("failed");
		expect(row.error_message).toBe("webhook timed out");
	});
});

describe("AlertEvent.isInCooldown", () => {
	test("returns false immediately when cooldownMinutes is 0, without matching any row", async () => {
		await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "down", 0);
		expect(inCooldown).toBe(false);
	});

	test("returns false when no matching event exists", async () => {
		let inCooldown = await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});

	test("returns true when a matching sent event exists within the cooldown window", async () => {
		await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(true);
	});

	test("returns false when the matching event is outside the cooldown window", async () => {
		let row = await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		/**
		 * Backdate `sent_at` past the 30-minute cooldown window — `record()` always
		 * stamps `Date.now()`, so this is the only way to exercise the boundary.
		 */
		await db.update(alertEvents, row.id, { sent_at: Date.now() - 31 * 60_000 });

		let inCooldown = await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});

	test("ignores events for a different alert, monitor, or event type", async () => {
		await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});

		expect(await AlertEvent.isInCooldown(db, "alert-2", "monitor-1", "down", 30)).toBe(false);
		expect(await AlertEvent.isInCooldown(db, "alert-1", "monitor-2", "down", 30)).toBe(false);
		expect(await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "up", 30)).toBe(false);
	});

	test("ignores events whose status isn't sent", async () => {
		await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "skipped_cooldown",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});
		await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "failed",
			error_message: "boom",
			monitor_type: "http",
			monitor_name: "My site",
		});

		let inCooldown = await AlertEvent.isInCooldown(db, "alert-1", "monitor-1", "down", 30);
		expect(inCooldown).toBe(false);
	});
});

describe("AlertEvent.listByAlertIds", () => {
	test("returns an empty array for an empty id list without querying", async () => {
		expect(await AlertEvent.listByAlertIds(db, [], 10)).toEqual([]);
	});

	test("lists events across multiple alerts, newest first", async () => {
		let first = await AlertEvent.record(db, {
			alert_id: "alert-1",
			monitor_id: "monitor-1",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "My site",
		});
		let second = await AlertEvent.record(db, {
			alert_id: "alert-2",
			monitor_id: "monitor-2",
			event_type: "up",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Other site",
		});
		/** An event for an alert not in the requested list must never show up. */
		await AlertEvent.record(db, {
			alert_id: "alert-3",
			monitor_id: "monitor-3",
			event_type: "down",
			status: "sent",
			error_message: null,
			monitor_type: "http",
			monitor_name: "Excluded site",
		});

		await db.update(alertEvents, first.id, { sent_at: Date.now() - 60_000 });

		let events = await AlertEvent.listByAlertIds(db, ["alert-1", "alert-2"], 10);
		expect(events.map((event) => event.id)).toEqual([second.id, first.id]);
	});

	test("respects the limit argument", async () => {
		for (let index = 0; index < 3; index++) {
			let row = await AlertEvent.record(db, {
				alert_id: "alert-1",
				monitor_id: "monitor-1",
				event_type: "down",
				status: "sent",
				error_message: null,
				monitor_type: "http",
				monitor_name: "My site",
			});
			await db.update(alertEvents, row.id, { sent_at: Date.now() - index * 1000 });
		}

		let events = await AlertEvent.listByAlertIds(db, ["alert-1"], 2);
		expect(events).toHaveLength(2);
	});
});

describe("AlertEvent.countSentSinceRecovery", () => {
	test("returns 0 when the pair has no events at all", async () => {
		expect(await AlertEvent.countSentSinceRecovery(db, "alert-1", "monitor-1", "down", 10)).toBe(0);
	});

	test("counts every sent event when the pair has never recovered", async () => {
		await recordAt(3000, "down", "sent");
		await recordAt(2000, "down", "sent");

		expect(await AlertEvent.countSentSinceRecovery(db, "alert-1", "monitor-1", "down", 10)).toBe(2);
	});

	test("counts only the sent events after the last recovery", async () => {
		await recordAt(5000, "down", "sent");
		await recordAt(4000, "down", "sent");
		await recordAt(3000, "up", "sent");
		await recordAt(2000, "down", "sent");

		expect(await AlertEvent.countSentSinceRecovery(db, "alert-1", "monitor-1", "down", 10)).toBe(1);
	});

	test("ignores suppressed and failed attempts, and other event types", async () => {
		await recordAt(4000, "down", "skipped_cooldown");
		await recordAt(3000, "down", "skipped_cap");
		await recordAt(2000, "down", "failed");
		await recordAt(1000, "degraded", "sent");

		expect(await AlertEvent.countSentSinceRecovery(db, "alert-1", "monitor-1", "down", 10)).toBe(0);
	});

	test("stops counting at the limit instead of reading the whole incident", async () => {
		for (let index = 0; index < 5; index++) await recordAt(5000 - index * 100, "down", "sent");

		expect(await AlertEvent.countSentSinceRecovery(db, "alert-1", "monitor-1", "down", 3)).toBe(3);
	});
});

describe("AlertEvent.summarizeIncident", () => {
	test("reports zero for a monitor with no history", async () => {
		expect(await AlertEvent.summarizeIncident(db, "alert-1", "monitor-1")).toEqual({
			sent: 0,
			suppressed: 0,
		});
	});

	test("splits the current incident into sent and suppressed, ignoring the previous one", async () => {
		await recordAt(9000, "down", "sent");
		await recordAt(8000, "down", "skipped_cooldown");
		await recordAt(7000, "up", "sent");
		await recordAt(6000, "down", "sent");
		await recordAt(5000, "down", "skipped_cooldown");
		await recordAt(4000, "down", "skipped_cap");
		await recordAt(3000, "degraded", "skipped_cap");
		await recordAt(2000, "down", "failed");

		expect(await AlertEvent.summarizeIncident(db, "alert-1", "monitor-1")).toEqual({
			sent: 1,
			suppressed: 3,
		});
	});
});
